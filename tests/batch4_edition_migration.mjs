// Batch D: actual inserted/moved edition content, older checkpoints, visibility.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const key='11am-literature-reading-position-v1',pref='11am-literature-show-revisions-v1';
const port=8776,url='http://127.0.0.1:'+port+'/index.html';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
function editSource(){
 const target=document.getElementById('s3-4');
 if(!target)throw Error('Saved anchor s3-4 missing in test fixture');
 const parent=target.parentElement;
 const others=[...parent.children].filter(x=>x.matches('.section[id]'));
 const ordinal=others.indexOf(target);
 if(ordinal<1)throw Error('Test needs a preceding sibling section');
 parent.insertBefore(target,others[0]);
 const added=document.createElement('div');added.className='section';added.id='lit-d-inserted';
 added.innerHTML='<h2 lang="ar" dir="rtl">منهج القراءة — Bilingual interpretation</h2>'+
   '<p>Additional newly inserted discussion in the revised edition.</p>'.repeat(7);
 parent.insertBefore(added,target);
 window.__batchD={before:ordinal,after:[...parent.children].filter(x=>x.matches('.section[id]')).indexOf(target),
   inserted:!!document.getElementById('lit-d-inserted')};
}
const injection='<script>document.addEventListener("DOMContentLoaded",('+editSource.toString()+'),{once:true});</script>';
const modified=html.replace('</head>',injection+'</head>');
assert.notEqual(modified,html);
let browser;
async function visit(saved,width=390){
 const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 await ctx.addInitScript(({key,pref,saved})=>{localStorage.setItem(key,JSON.stringify(saved));localStorage.setItem(pref,'false');},{key,pref,saved});
 const page=await ctx.newPage();
 await page.route('**/index.html',route=>route.fulfill({status:200,contentType:'text/html',body:modified}));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#panel-toggle').waitFor();
 const m=await page.evaluate(()=>window.__batchD);
 assert(m?.inserted&&m.before!==m.after,'Fixture must move a real section and insert a bilingual section: '+JSON.stringify(m));
 assert(await page.locator('#lit-d-inserted h2[lang="ar"][dir="rtl"]').count());
 assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),saved,
   'Loading a revised edition must preserve the old checkpoint until reader action');
 await page.locator('#panel-toggle').click();
 const btn=page.locator('.reader-resume-button').first();
 assert(await btn.isEnabled());
 return {page,ctx,btn};
}
try{
 let ready=false;
 for(let i=0;i<50;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}
 assert(ready,'HTTP fixture not ready');
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280]){
  const saved={version:2,chapter:'3',anchor:{kind:'section',key:'s3-4',ratio:.42},revision:false,savedAt:1730000000000};
  let {page,ctx,btn}=await visit(saved,width);
  await btn.click();
  await page.waitForFunction(()=>scrollY>100);
  const at=await page.evaluate(()=>{
   const n=document.getElementById('s3-4'),r=n.getBoundingClientRect(),ch=n.closest('.chapter');
   return {actual:scrollY,expected:Math.max(0,r.top+scrollY+.42*r.height-innerHeight*.36),
      chapter:ch?.dataset.chapter,focus:document.activeElement?.id};
  });
  assert.equal(at.chapter,'3');
  assert(Math.abs(at.actual-at.expected)<65,'Reordered section restoration: '+JSON.stringify(at));
  assert.equal(at.focus,'s3-4','Saved section should retain focus');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),pref),'false');
  await ctx.close();

  const old={chapter:'3',fraction:.58,savedAt:1730000000000};
  ({page,ctx,btn}=await visit(old,width));
  await btn.click();await page.waitForFunction(()=>scrollY>100);
  const loc=await page.evaluate(()=>{
   const r=document.getElementById('chapter-3').getBoundingClientRect();
   return {actual:scrollY,expected:Math.max(0,r.top+scrollY+.58*r.height-innerHeight*.36)};
  });
  assert(Math.abs(loc.actual-loc.expected)<70,'Older percentage checkpoint: '+JSON.stringify(loc));
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),pref),'false');
  await ctx.close();
 }
 const revision={version:2,chapter:'3',anchor:{kind:'section',key:'s3-rev-3',ratio:.2},revision:true,savedAt:1730000000000};
 const {page,ctx,btn}=await visit(revision);
 await btn.click();
 await page.waitForFunction(()=>document.querySelector('#chapter-3 .revision-zone')?.classList.contains('lit-temporary-revision'));
 assert.equal(await page.locator('#lit-show-revisions').isChecked(),false);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),pref),'false');
 await ctx.close();
 console.log('PASS Batch D Literature: actual section insertion/reordering, anchored + older percentage checkpoints, RTL/English headings, hidden revision preference');
}finally{await browser?.close();server.kill();}
