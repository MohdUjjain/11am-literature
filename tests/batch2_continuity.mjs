/* Batch 2: modified-edition anchored continuation + hidden summary safety. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/batch2_modified_edition.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=spawn('python3',['-m','http.server','8768','--bind','127.0.0.1'],{stdio:'ignore'});
const url='http://127.0.0.1:8768/index.html';
let browser;
try{
 for(let k=0;k<60;k++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 async function visit(saved,modified){
   const context=await browser.newContext({viewport:{width:1040,height:800},reducedMotion:'reduce',serviceWorkers:'block'});
   await context.addInitScript(({f,s})=>{
     localStorage.setItem(f.key,JSON.stringify(s));
     localStorage.setItem(f.visibilityKey,f.hidden);
   },{f:fixture,s:saved});
   const page=await context.newPage();
   if(modified){
     const old='id="'+fixture.deletedId+'"',replacement='id="'+fixture.newId+'"';
     assert.ok(html.includes(old));
     await page.route('**/index.html',route=>route.fulfill({status:200,contentType:'text/html',body:html.replace(old,replacement)}));
   }
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#panel-toggle').waitFor();
   await page.locator('#panel-toggle').click();
   await page.locator('.reader-resume-button').first().waitFor({state:'visible'});
   assert.ok(await page.locator('.reader-resume-button').first().isEnabled(),'saved chapter remains continuable');
   return {page,context};
 }
 {
  const {page,context}=await visit(fixture.changed,true);
  assert.equal(await page.locator('#'+fixture.deletedId).count(),0);
  assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),fixture.key)).anchor.key,fixture.deletedId);
  await page.locator('.reader-resume-button').first().click();
  await page.waitForFunction(()=>window.scrollY>100);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),fixture.visibilityKey),'false');
  const bounds=await page.locator('#chapter-3').boundingBox();
  assert.ok(bounds && bounds.y<850 && bounds.y+ bounds.height>0,'continuation must stay inside the saved chapter');
  await context.close();
 }
 {
  const {page,context}=await visit(fixture.hiddenRevision,false);
  await page.locator('.reader-resume-button').first().click();
  await page.waitForFunction(()=>document.querySelector('#chapter-3 .revision-zone')?.classList.contains('lit-temporary-revision'));
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),fixture.visibilityKey),'false');
  assert.equal(await page.locator('#lit-show-revisions').isChecked(),false);
  await context.close();
 }
 console.log('PASS Batch 2: missing section migrates to chapter; hidden saved revision reopens temporarily');
}finally{if(browser)await browser.close();server.kill();}
