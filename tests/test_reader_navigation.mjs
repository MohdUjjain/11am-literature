// Reader search: complete text units, Arabic/Latin normalization and offline UI invariants.
// Runs on Node without downloading the notes, fonts or any browser dependencies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const searchCode=readFileSync(new URL('../reader-search.js',import.meta.url),'utf8');
const uiCode=readFileSync(new URL('../reader-ui.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const skin=readFileSync(new URL('../reader-ui.css',import.meta.url),'utf8');
const root={};
runInNewContext(searchCode,{window:root});
assert.ok(root.LiteratureSearch,'Local full-text search engine should initialize');
const engine=root.LiteratureSearch;
assert.equal(engine.normalize('Fāṭimid'),'fatimid');
assert.equal(engine.normalize('Muḥammad'),'muhammad');
assert.equal(engine.normalize('بِسْمِ اللَّهِ'),'بسم الله');
assert.equal(engine.normalize('إِمَام'),'امام');
assert.equal(engine.normalize('  Multiple \n spaces  '),'multiple spaces');

function textNode(tag,text,revision=false,sectionTitle='Analysis'){
  const heading={textContent:sectionTitle};
  const section={querySelector:sel=>sel===':scope > h2'?heading:null};
  return {
    tagName:tag, textContent:text,children:[],parentElement:null,
    querySelector:()=>null,
    closest:selector=>selector==='.revision-zone'?(revision?{}:null):
      selector==='.section'?section:null
  };
}
function chapter(num,title,nodes){
  return {
    getAttribute:name=>name==='data-chapter'?String(num):null,
    querySelector:sel=>sel==='.chapter-title-page h1'?{textContent:title}:null,
    querySelectorAll:()=>nodes
  };
}
const chapterOne=chapter(1,'A Petition to the Fāṭimid Caliph',[
  textNode('H1','A Petition to the Fāṭimid Caliph'),
  textNode('P','The Cairo Genizah petition discusses legal proofs, petitions and authority.'),
  textNode('P','Central thesis: a petition reveals a system of justice.'),
  textNode('LI','The debt of 241 dinars'),
  textNode('TD','Manuscript classification: chancery petition'),
  textNode('P','Revision: legal petition, proof and remedy.',true,'Revision notes')
]);
const chapterTwenty=chapter(20,'Arabic and Persians',[
  textNode('H2','Arabic literature and identity'),
  textNode('P','The Persian voice in Abbasid macaronics'),
  textNode('P','بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',true,'Memory aid')
]);
const doc={querySelectorAll:selector=>
  selector==='#book > .chapter'?[chapterOne,chapterTwenty]:[]};
const index=engine.buildIndex(doc);
assert.equal(index.length,9);
assert.ok(index.some(x=>x.heading&&x.chapter==='1'));
assert.ok(index.some(x=>x.revision&&x.chapter==='20'));
assert.ok(engine.find(index,'FATIMID').some(x=>x.entry.title.includes('Petition')));
assert.equal(engine.find(index,'241 dinars').length,1);
assert.equal(engine.find(index,'chancery petition').length,1);
assert.ok(engine.find(index,'legal remedy').some(x=>x.entry.revision),
  'Multi-term search must find revision material');
assert.ok(engine.find(index,'بسم الله').some(x=>x.entry.chapter==='20'),
  'Arabic search must ignore optional harakat');
assert.equal(engine.find(index,'').length,0);
assert.equal(engine.find(index,'nonexistent academic expression').length,0);
assert.ok(engine.excerpt('Long example '.repeat(40),'example',90).length<=92);

// Pass C1: stable, distinct anchors and Unicode-accurate match offsets.
assert.equal(new Set(index.map(x=>x.anchorId)).size,index.length);
assert.ok(index.every(x=>/^lit-hit-/.test(x.anchorId)));
const arabic=engine.excerptMatch('Before بِسْمِ اللَّهِ after','بسم الله',100);
assert.ok(arabic.parts.some(x=>x.match && x.text.includes('بِسْمِ اللَّه')));
const latin=engine.excerptMatch('An important Fāṭimid petition','fatimid',100);
assert.ok(latin.parts.some(x=>x.match && x.text==='Fāṭimid'));
const compound=engine.excerptMatch('A muḥammad and a Muḥammad','muhammad',100);
assert.equal(compound.parts.filter(x=>x.match).length,2);
assert.ok(uiCode.includes('renderedQuery!==searchBox.value.trim()'),
  'Enter and result selection must reject old search state');
assert.ok(uiCode.includes('window.history.pushState'),
  'Search navigation must produce a browser-history fragment');
assert.ok(skin.includes('.reader-result-match'));

// The search must live in the sticky header rather than in the side drawer.
const header=html.slice(html.indexOf('<header id="reading-header"'),
                        html.indexOf('</header>')+9);
const sidebar=html.slice(html.indexOf('<div class="panel-widget app-chrome no-print">'),
                         html.indexOf('<main id="book">'));
assert.ok(header.includes('id="reader-search-input"'));
assert.ok(header.includes('id="reader-search-results"'));
assert.ok(!sidebar.includes('id="reader-search-input"'));
assert.ok(sidebar.includes('id="panel-index"'));
assert.ok(sidebar.includes('id="panel-tools"'));
assert.ok(sidebar.includes('id="lit-show-revisions"'));
assert.ok(sidebar.includes('id="btn-print"'));
assert.ok(sidebar.includes('id="pwa-save"'));
assert.equal(sidebar.match(/class="reader-resume-button"/g)?.length,2);
assert.ok(!html.includes('var coverLink = document.createElement'));
assert.ok(html.includes("headerTag.textContent = String(active.num).padStart(2, '0')"));
assert.ok(skin.includes('body.lit-revisions-hidden #book > .chapter > .revision-zone'));
assert.ok(skin.includes('.reader-search-hit-target{outline:none!important;'),
  'Search highlighting must not hide any material in print');

// Syntax verification catches dangling blocks and bad quotes in the client UI.
assert.doesNotThrow(()=>new Script(uiCode));
assert.ok(uiCode.includes('setStored(STORE_VISIBILITY'));
assert.ok(uiCode.includes('setStored(STORE_POSITION'));
assert.ok(uiCode.includes('revealRevisionTarget(target)'),
  'Opening a hidden revision result should temporarily reveal the target');
assert.ok(uiCode.includes("version:2,chapter:active.getAttribute('data-chapter')"),
  'Resume checkpoints must use stable section/passages, not chapter percentages');
assert.ok(uiCode.includes("setStored(STORE_VISIBILITY,show ? 'true' : 'false')"),
  'Revision preference must persist independently of temporary reveals');
assert.ok(skin.includes('.revision-zone.lit-temporary-revision'),
  'Hidden revision destinations must be temporarily visible');
assert.ok(skin.includes('--lit-header-offset'),
  'Index anchor offsets must adapt to sticky header height');
assert.ok(sidebar.includes('aria-modal="true"') && sidebar.includes(' inert>'),
  'Closed drawer should be unfocusable and identified as modal');
assert.ok(html.includes('function focusableControls()') &&
          html.includes("panel.inert = true"),
  'Drawer focus must be trapped and restored on close');
assert.ok(uiCode.includes('recordPosition(true)'),
  'Resume position must persist on page hide');

console.log('PASS: complete Literature text search, Latin/Arabic matching, ranked results, tabbed sidebar, persistent visibility/resume and unchanged printing');
