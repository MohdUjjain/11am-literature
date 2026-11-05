// Headless regression for the independent book rail and per-reading ring.
// Uses only Node built-ins and a synthetic document: no network/browser dependency.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function initReadingProgress(){');
const end=html.indexOf('  function positionScreenNotes()',start);
assert.ok(start>=0&&end>start,'Expected in-page reading progress controller');
const code=html.slice(start,end);
const create=new Function('document','window','getComputedStyle','requestAnimationFrame',
  code+'\nreturn initReadingProgress;');

function indicator(){
  const values={};
  const custom={};
  return {
    textContent:'',
    style:{
      width:'',color:'',
      setProperty:(key,value)=>{custom[key]=value;},
      getPropertyValue:key=>custom[key]
    },
    setAttribute:(key,value)=>{values[key]=value;},
    values
  };
}
const ids=['rh-chapter-tag','rh-chapter-title','progress-fill',
  'rh-book-track','rh-book-percent','rh-chapter-ring','rh-chapter-percent'];
const refs=Object.fromEntries(ids.map(id=>[id,indicator()]));
const listeners={};
const win={scrollY:0,innerHeight:800,innerWidth:390,
  addEventListener:(name,fn)=>{listeners[name]=fn;}};
function chapter(number,start,height,revisionStart){
  return {
    getAttribute:key=>key==='data-chapter'?String(number):null,
    getBoundingClientRect:()=>({top:start-win.scrollY,height}),
    querySelector:selector=>{
      if(selector.includes('reading-eyebrow'))
        return {textContent:'Reading '+String(number).padStart(2,'0')+' · Literature Dossier'};
      if(selector.includes(' h1'))return {textContent:'Title '+number};
      if(selector==='.revision-zone')
        return {getClientRects:()=>[1],
                getBoundingClientRect:()=>({top:revisionStart-win.scrollY})};
      return null;
    }
  };
}
// The second available reading deliberately has number 20; missing numbers
// must not introduce phantom stops or affect progress percentage.
const chapters=[chapter(1,1000,2500,3200),chapter(20,3500,4300,7000)];
const document={
  documentElement:{scrollHeight:7800},
  getElementById:id=>refs[id]||null,
  querySelectorAll:selector=>selector==='#book > .chapter'?chapters:[],
  fonts:{}
};
const init=create(document,win,()=>({getPropertyValue:()=> '#747B32'}),
  callback=>{callback();return 1;});
init();
const track=refs['rh-book-track'];
const ring=refs['rh-chapter-ring'];
const percent=refs['rh-chapter-percent'];
const label=refs['rh-chapter-tag'];
const title=refs['rh-chapter-title'];
function move(top){
  win.scrollY=top;
  listeners.scroll();
  return Number(refs['rh-book-percent'].textContent.replace('%',''));
}
assert.equal(move(0),0);
assert.equal(percent.textContent,'—','Cover should not indicate a reading');
assert.equal(ring.values['aria-valuetext'],'No reading selected');
const book1=move(1500);
const reading1=Number(percent.textContent.replace('%',''));
assert.equal(book1,21);
assert.equal(reading1,32);
assert.equal(label.textContent,'01','Reading header must use the number only');
assert.equal(title.textContent,'Title 1');
assert.equal(track.values['aria-valuenow'],'21');
assert.equal(ring.values['aria-valuenow'],'32');
const bookRevision=move(3200);
assert.ok(bookRevision>book1,'Book progress must be continuous');
assert.equal(title.textContent,'Title 1 — Revision');
assert.equal(Number(percent.textContent.replace('%','')),100);
const bookNext=move(3300);
assert.ok(bookNext>bookRevision,'Whole-book bar must not reset for the next reading');
assert.equal(label.textContent,'20');
assert.equal(title.textContent,'Title 20');
assert.equal(Number(percent.textContent.replace('%','')),2,'Chapter ring should reset');
win.innerWidth=1200;
listeners.resize();
assert.equal(label.textContent,'20',
  'Desktop must also use only the reading number');
assert.equal(move(7000),100);
assert.equal(percent.textContent,'100%','Last reading must reach completion');
assert.equal(track.values['aria-valuenow'],'100');
assert.equal(ring.values['aria-valuenow'],'100');
assert.equal(refs['progress-fill'].style.width,'100%');
assert.ok(html.includes('#rh-book-percent{font-size:11px;}'),
  'Mobile book percentage must be visible');
assert.ok(html.includes('@media print{#edition-notice{display:none!important}}'),
  'Existing print rules must remain present');
console.log('PASS: continuous whole-book rail, chapter ring, revision sections, cover, final completion, mobile/desktop labels');
