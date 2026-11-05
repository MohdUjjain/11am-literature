// Pass B polish: check ALL actual chapter pigments, mobile search behavior,
// unified inline icons, touch targets, RTL snippets and print isolation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../reader-ui.css',import.meta.url),'utf8');
const ui=readFileSync(new URL('../reader-ui.js',import.meta.url),'utf8');
const accents=[...html.matchAll(/<section class="chapter" data-chapter="(\d+)"[^>]*style="--chapter-accent:(#[\dA-Fa-f]{6})/g)]
  .map(x=>({number:Number(x[1]),hex:x[2]}));
assert.equal(accents.length,25);
assert.ok(!accents.some(x=>x.number===19),'Reserved Reading 19 must not be inserted');

// CSS color-mix uses sRGB channel interpolation. Check both derived text
// roles against the actual chapter-opener tint and ink header for all chapters.
function rgb(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16));}
function mix(a,b,weight){
  const x=rgb(a),y=rgb(b);
  return x.map((v,i)=>Math.round(v*weight+y[i]*(1-weight)));
}
function channels(x){return Array.isArray(x)?x:rgb(x);}
function luminance(color){
  const v=channels(color).map(c=>c/255).map(c=>
    c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
  return v[0]*0.2126+v[1]*0.7152+v[2]*0.0722;
}
function contrast(a,b){
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
const ink='#2A2016',parchment='#F3E9D2';
const onLight=48/100,onDark=40/100;
assert.ok(css.includes('var(--chapter-accent) 48%,var(--ink)'));
assert.ok(css.includes('var(--chapter-accent) 40%,var(--parchment)'));
for(const accent of accents){
  const tinted=mix(accent.hex,parchment,.2);
  assert.ok(contrast(mix(accent.hex,ink,onLight),tinted)>=4.5,
    'Reading '+accent.number+' must use contrast-safe opener text');
  assert.ok(contrast(mix(accent.hex,parchment,onDark),ink)>=4.5,
    'Reading '+accent.number+' must use contrast-safe dark text');
}
assert.ok(css.includes('#book .revision-zone .revision-kicker'));
assert.ok(css.includes('#book .chapter-title-page .reading-eyebrow'));
assert.ok(css.includes('#side-panel .hint')&&css.includes('color:var(--ink-soft)'));

// The old inline decorative glyphs have one consistent 24px SVG icon family.
const symbols=new Set([...html.matchAll(/<symbol id="(lit-icon-[\w-]+)"/g)].map(x=>x[1]));
const referenced=[...html.matchAll(/<use href="#(lit-icon-[\w-]+)"/g)].map(x=>x[1]);
assert.ok(symbols.size>=8);
assert.ok(referenced.length>=10);
for(const name of referenced)assert.ok(symbols.has(name),'Missing icon '+name);
assert.ok(html.includes('id="panel-toggle"'));
assert.ok(html.includes('id="panel-close"'));
assert.ok(html.includes('id="reader-search-toggle"'));
assert.ok(html.includes('id="reader-search-close"'));
assert.ok(html.includes('class="reader-resume-label"'));

// Sticky drawer header and tabs must remain visible as user scrolls.
assert.ok(css.includes('.panel-heading{'));
assert.ok(css.includes('position:sticky;top:0'));
assert.ok(css.includes('position:sticky;top:56px'));
assert.ok(css.includes('height:100dvh'));
assert.ok(css.includes('env(safe-area-inset-bottom'));
assert.ok(css.includes('#toc-list .toc-toggle{'));
assert.ok(css.includes('width:44px;height:44px;min-width:44px;'));
assert.ok(css.includes('.reader-resume-button{'));
assert.ok(css.includes('min-height:46px'));
assert.ok(css.includes('#side-panel .toggle-row{min-height:44px'));

// Search is compact by default on mobile and expands into the header when used.
assert.ok(css.includes('.reader-search-wrap{display:none;grid-column:1/-1;grid-row:2;}'));
assert.ok(css.includes('#reading-header.search-open .reader-search-wrap{'));
assert.ok(css.includes('#reader-search-input{font-size:16px'));
assert.ok(css.includes('max-height:min(55dvh,450px)'));
assert.ok(html.includes('role="region" aria-label="Literature search results"'));

const begin=ui.indexOf('  function resultDirection(');
const end=ui.indexOf('  function resultButton(',begin);
assert.ok(begin>0&&end>begin);
const component=ui.slice(begin,end);
function directionTest(text){
  const props={};
  const target={setAttribute:(key,value)=>props[key]=value};
  const fn=new Function(component+'return resultDirection;')();
  fn(target,text);
  return props;
}
assert.deepEqual(directionTest('بِسْمِ اللَّهِ'),{dir:'rtl',lang:'ar'});
assert.deepEqual(directionTest('שלום'),{dir:'rtl',lang:'he'});
assert.deepEqual(directionTest('Fatimid petitions العربية'),{dir:'auto'});
assert.ok(css.includes('.reader-result-snippet[lang="ar"]'));
assert.ok(css.includes('.reader-result-snippet[dir="rtl"]'));
assert.ok(!ui.includes("button.setAttribute('role','option')"),
  'Native result buttons should not use orphan listbox options');
assert.ok(ui.includes('resultDirection(snippet,snippet.textContent)'));

// Exercise the expand/collapse logic at mobile and desktop breakpoints.
function responsive(width){
  const attrs={},classes=new Set(),search={focused:false,
    focus(){this.focused=true},blur(){this.focused=false}};
  const toggle={setAttribute:(k,v)=>attrs[k]=v};
  const header={classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
  let closed=0;
  const f=new Function('window','searchToggle','searchHeader','searchBox','closeResults',
    component+'return {expandMobileSearch,collapseMobileSearch};');
  const runtime=f({innerWidth:width,matchMedia:()=>({matches:width<=850})},
    toggle,header,search,()=>{closed++});
  return {runtime,attrs,classes,search,get closed(){return closed;}};
}
const mobile=responsive(390);
mobile.runtime.expandMobileSearch();
assert.equal(mobile.attrs['aria-expanded'],'true');
assert.ok(mobile.classes.has('search-open'));
assert.equal(mobile.search.focused,true);
mobile.runtime.collapseMobileSearch();
assert.equal(mobile.attrs['aria-expanded'],'false');
assert.ok(!mobile.classes.has('search-open'));
assert.ok(mobile.closed>0);
const desktop=responsive(1200);
desktop.runtime.expandMobileSearch();
assert.ok(!desktop.classes.has('search-open'));

// Shared print compositor & its content are not affected by the overlay rules.
assert.ok(html.includes('window.DossierPrint={build:Print.build'));
assert.ok(css.includes('@media print{'));
assert.ok(css.includes('.reader-search-hit-target{outline:none!important'));
console.log('PASS: 25 contrast-safe chapter accents, sticky drawer, 44px controls, responsive search, bidi search results and icon family');
