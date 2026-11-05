// Pass A interaction regression: stable checkpoints, hidden-revision navigation,
// sticky-header offset, and drawer focus. Pure Node; no browser/network required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../reader-ui.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../reader-ui.css',import.meta.url),'utf8');
const listeners={},local={},added=[],captions=[],scrolls=[];
let time=5000,revisionVisible=true,chapterHeight=3400,chapterTop=1000;
let activeElement=null;
function classList(){
  const members=new Set();
  return {add(k){members.add(k)},remove(k){members.delete(k)},
    contains(k){return members.has(k)},toggle(k,v){
      if(v===undefined)v=!members.has(k);
      if(v)members.add(k);else members.delete(k);return v;
    }};
}
function node(id=''){
  const attrs={},handlers={},classes=classList();
  return {id,attrs,handlers,classList:classes,
    textContent:'',disabled:false,checked:true,hidden:false,scrollTop:0,
    style:{setProperty(k,v){this[k]=v}},
    setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];},getAttribute:k=>attrs[k],
    hasAttribute:k=>Object.hasOwn(attrs,k),
    addEventListener(k,f){handlers[k]=f;},
    getClientRects:()=>[1],getBoundingClientRect:()=>({top:0,height:80}),
    closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[],
    contains:()=>false,
    focus(){activeElement=this;},blur(){if(activeElement===this)activeElement=null},
    click(){handlers.click?.({target:this,preventDefault(){}})}
  };
}
const section1=node('sec-one'),section2=node('sec-two'),revSection=node('rev-one');
section1.textContent='First theme';section2.textContent='Second theme';
const passage1=node(''),passage2=node(''),revPassage=node('');
passage1.setAttribute('data-anchor','p-one');passage2.setAttribute('data-anchor','p-two');
revPassage.setAttribute('data-anchor','p-revision');
const revision=node('revision');
revision.closest=s=>s==='.revision-zone'?revision:null;
revision.getClientRects=()=>revisionVisible?[1]:[];
revision.getBoundingClientRect=()=>({top:2800-win.scrollY,height:950});
const positions=new Map([[section1,1120],[passage1,1240],[section2,1550],
  [passage2,1550],[revSection,2810],[revPassage,2880]]);
for(const [el,y] of positions){
  el.getBoundingClientRect=()=>({top:y-win.scrollY,height:el===revPassage?300:350});
  el.getClientRects=()=> (positions.get(el)>=2800&&!revisionVisible)?[]:[1];
  el.hasAttribute=k=>k==='data-anchor' && el.getAttribute('data-anchor')!=null ||
                     k==='tabindex' && !!el.attrs.tabindex;
  el.closest=selector=>{
    if(selector==='.revision-zone')return positions.get(el)>=2800?revision:null;
    if(selector==='.section')return positions.get(el)>=2800?revSection:
      positions.get(el)>=1550?section2:section1;
    if(selector==='.section[id]')return positions.get(el)>=2800?revSection:
      positions.get(el)>=1550?section2:section1;
    return null;
  };
}
section1.querySelector=section2.querySelector=revSection.querySelector=selector=>
  selector===':scope > h2'?{textContent:selector&&section1===null?'':'Theme heading'}:null;
const chapter=node('chapter-12');
chapter.setAttribute('data-chapter','12');
chapter.getBoundingClientRect=()=>({top:chapterTop-win.scrollY,height:chapterHeight});
chapter.querySelector=sel=>sel==='.revision-zone'?revision:
  sel==='[data-anchor="p-one"]'?passage1:
  sel==='[data-anchor="p-two"]'?passage2:
  sel==='[data-anchor="p-revision"]'?revPassage:null;
chapter.querySelectorAll=sel=>sel==='.section[id], .passage[data-anchor]'?
  [section1,passage1,section2,passage2,revSection,revPassage]:[];
chapter.contains=el=>[section1,passage1,section2,passage2,revSection,revPassage].includes(el);
const indexTab=node('tab-index'),toolsTab=node('tab-tools');
indexTab.setAttribute('data-tab','index');toolsTab.setAttribute('data-tab','tools');
const indexPane=node('panel-index'),toolsPane=node('panel-tools'),drawer=node('side-panel');
const checkbox=node('lit-show-revisions'),toc=node('toc-list'),header=node('reading-header');
header.getBoundingClientRect=()=>({top:0,height:92});
const resume=[node('continue-one'),node('continue-two')];
const descriptions=[node('caption-one'),node('caption-two')];
const ids={'panel-index':indexPane,'panel-tools':toolsPane,'side-panel':drawer,
  'lit-show-revisions':checkbox,'toc-list':toc,'reading-header':header,
  'panel-close':node('panel-close'), 'rev-one':revSection};
const body={classList:classList()};
const document={
  readyState:'complete',body,visibilityState:'visible',
  documentElement:{style:{setProperty(k,v){this[k]=v}},
    scrollHeight:5600},
  getElementById:id=>ids[id]||null,
  querySelectorAll:q=>q==='#book > .chapter'?[chapter]:
    q==='.panel-tab'?[indexTab,toolsTab]:
    q==='.reader-resume-button'?resume:
    q==='.reader-resume-caption'?descriptions:
    q==='.lit-temporary-revision'?
      (revision.classList.contains('lit-temporary-revision')?[revision]:[]):[],
  addEventListener:(name,handler)=>{listeners['doc:'+name]=handler}
};
const win={
  scrollY:1400,innerHeight:600,innerWidth:375,
  localStorage:{getItem:k=>local[k]??null,setItem:(k,v)=>{local[k]=v}},
  addEventListener:(name,handler)=>listeners[name]=handler,
  dispatchEvent:()=>{},scrollTo:opts=>scrolls.push(opts)
};
class Clock {static now(){return time;}}
new Function('document','window','Date','Event','setTimeout','clearTimeout',
  ui)(document,win,Clock,class FakeEvent{},()=>1,()=>{});

assert.equal(document.documentElement.style['--lit-header-offset'],'106px');
assert.equal(indexPane.hidden,false);
assert.equal(toolsPane.hidden,true);
toolsTab.click();
assert.equal(toolsPane.hidden,false);
assert.equal(indexPane.hidden,true);
assert.ok(css.includes('scroll-padding-top:var(--lit-header-offset'));
assert.ok(ui.includes("kind:opener ? 'opener'"),
  'Title page positions should also have a stable opener checkpoint');
assert.ok(ui.includes("window.matchMedia('print').matches"),
  'Printing must not overwrite a reading checkpoint');

assert.ok(css.includes('.revision-zone.lit-temporary-revision'));

// Save a checkpoint at the second passage, then change chapter height.
listeners.scroll();
let saved=JSON.parse(local['11am-literature-reading-position-v1']);
assert.equal(saved.version,2);
assert.equal(saved.chapter,'12');
assert.equal(saved.anchor.kind,'passage');
assert.equal(saved.anchor.key,'p-two');
assert.equal(resume[0].textContent,'↪ Continue Reading 12');
assert.ok(descriptions[0].textContent.includes('Reading 12'));
assert.equal(resume[0].disabled,false);

// Hiding revision sections must not affect the stored passage location.
checkbox.checked=false;
checkbox.handlers.change();
assert.equal(local['11am-literature-show-revisions-v1'],'false');
assert.ok(body.classList.contains('lit-revisions-hidden'));
chapterHeight=2400;
resume[1].click();
assert.ok(scrolls.length);
assert.ok(Math.abs(scrolls.at(-1).top-1400)<5,
  'Stable passage offset must not depend on a shortened chapter height');

// Save in a revision, hide it, resume and temporarily reveal the target.
time+=3000;
win.scrollY=2800;
revisionVisible=true;
listeners.scroll();
saved=JSON.parse(local['11am-literature-reading-position-v1']);
assert.equal(saved.anchor.key,'p-revision');
assert.equal(saved.revision,true);
revisionVisible=false;
resume[0].click();
assert.ok(revision.classList.contains('lit-temporary-revision'));
assert.equal(local['11am-literature-show-revisions-v1'],'false',
  'Temporary reveal must never alter the stored preference');

// Index link to a hidden revision must reveal content before fragment scroll.
revision.classList.remove('lit-temporary-revision');
const link={getAttribute:()=> '#rev-one'};
toc.handlers.click({target:{closest:()=>link}});
assert.ok(revision.classList.contains('lit-temporary-revision'));
assert.equal(local['11am-literature-show-revisions-v1'],'false');
checkbox.checked=true;checkbox.handlers.change();
assert.ok(!revision.classList.contains('lit-temporary-revision'));

// An older percentage-only checkpoint inside revisions must still reopen it.
checkbox.checked=false;checkbox.handlers.change();
revision.classList.remove('lit-temporary-revision');
local['11am-literature-reading-position-v1']=JSON.stringify({
  chapter:'12',fraction:0.85,revision:true,savedAt:100
});
resume[1].click();
assert.ok(revision.classList.contains('lit-temporary-revision'),
  'Legacy checkpoint must reveal hidden revision content');
assert.equal(local['11am-literature-show-revisions-v1'],'false');

// Drawer focus should be managed, including the keyboard Tab cycle.
const s=html.indexOf('  function initPanel(){');
const e=html.indexOf('  // Distinct progress indicators:',s);
assert.ok(s>=0&&e>s);
const panelCode=html.slice(s,e);
const trigger=node('panel-toggle'),backdrop=node('panel-backdrop'),close=node('panel-close');
const controls=[close,indexTab,toolsTab,resume[0]];
drawer.querySelector=sel=>sel.includes('[aria-selected')?indexTab:null;
drawer.querySelectorAll=()=>controls;
drawer.contains=el=>controls.includes(el);
for(const el of controls){el.getClientRects=()=>[1];el.tabIndex=0;
  el.closest=selector=>selector==='[hidden]'?null:null;}
const panelDoc={
  getElementById:id=>id==='panel-toggle'?trigger:id==='side-panel'?drawer:
    id==='panel-backdrop'?backdrop:id==='panel-close'?close:
    id==='toc-list'?toc:id==='rev-one'?revSection:null,
  addEventListener:(name,fn)=>{listeners['panel:'+name]=fn},
  get activeElement(){return activeElement;}
};
new Function('document','requestAnimationFrame',panelCode+'return initPanel;')(
  panelDoc,fn=>fn())();
assert.equal(drawer.inert,true);
trigger.click();
assert.equal(drawer.inert,false);
assert.equal(drawer.getAttribute('aria-hidden'),'false');
assert.equal(activeElement,indexTab);
activeElement=resume[0];
let prevented=false;
listeners['panel:keydown']({key:'Tab',shiftKey:false,
  preventDefault(){prevented=true}});
assert.ok(prevented);
assert.equal(activeElement,close,'Tab must wrap to the first control');
listeners['panel:keydown']({key:'Escape',preventDefault(){}});
assert.equal(drawer.inert,true);
assert.equal(drawer.getAttribute('aria-hidden'),'true');
assert.equal(activeElement,trigger,'Escape restores launcher focus');
console.log('PASS: stable passage checkpoint, hidden-revision navigation, live header offset, focus-trapped drawer');
