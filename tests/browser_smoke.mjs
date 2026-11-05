// Real Chromium smoke checks for the complete published dossier.
// Test-only Playwright dependency; the reader remains dependency-free.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],
  {stdio:'ignore'});
const url='http://127.0.0.1:8765/';
let browser;
try {
  for (let i=0;i<30;i++) {
    try {const response=await fetch(url);if(response.ok)break;}
    catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  browser=await chromium.launch({headless:true});
  await mkdir('test-artifacts',{recursive:true});
  for(const width of [320,375,390,430,768,1024,1440]){
    const context=await browser.newContext({viewport:{width,height:850},
      reducedMotion:'reduce'});
    const page=await context.newPage();
    page.setDefaultTimeout(12000);
    console.log('Chromium viewport',width);
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('#reader-search-input').waitFor({state:'attached'});
    const viewport=await page.evaluate(()=>({
      doc:document.documentElement.scrollWidth,viewport:window.innerWidth
    }));
    if(viewport.doc>viewport.viewport+3) {
      const horizontal=await page.evaluate(()=>{
        const width=window.innerWidth;
        const chapters=Array.from(document.querySelectorAll('#book > .chapter'))
          .map(ch=>({number:ch.getAttribute('data-chapter'),
            width:ch.clientWidth,scroll:ch.scrollWidth,
            leaf:ch.querySelector('.leaf')?.scrollWidth,
            revision:ch.querySelector('.revision-zone')?.scrollWidth}))
          .filter(ch=>ch.scroll>width+3);
        const worst=chapters.slice().sort((a,b)=>b.scroll-a.scroll)[0];
        const chapter=worst && document.querySelector(
          '#book > .chapter[data-chapter="'+worst.number+'"]');
        const detailed=chapter?Array.from(chapter.querySelectorAll('*'))
          .filter(el=>!el.closest('table'))
          .map(el=>({el,r:el.getBoundingClientRect()}))
          .filter(x=>x.r.width>0 && x.r.left<width && x.r.right>width+4)
          .sort((a,b)=>b.r.right-a.r.right).slice(0,16)
          .map(x=>({tag:x.el.tagName,cls:String(x.el.className).slice(0,70),
            parent:x.el.parentElement?.className,
            left:Math.round(x.r.left),right:Math.round(x.r.right),
            text:x.el.textContent?.slice(0,65)})):null;
        return {viewport:width,doc:document.documentElement.scrollWidth,
          chapters,detailed,book:document.getElementById('book').scrollWidth};
      });
      assert.fail('Unexpected horizontal overflow at '+width+'px: '+
        JSON.stringify(horizontal));
    }
    await page.locator('#panel-toggle').click();
    await assert.doesNotReject(()=>page.locator('#panel-tools').count());
    assert.equal(await page.locator('#side-panel').getAttribute('aria-hidden'),'false');
    assert.equal(await page.locator('#book').evaluate(el=>el.inert),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#side-panel').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('#book').evaluate(el=>el.inert),false);
    if(width===390 || width===1440) {
      if(width<=850) await page.locator('#reader-search-toggle').click();
      const search=page.locator('#reader-search-input');
      await search.fill('fatimid');
      await page.locator('.reader-result').first().waitFor({timeout:12000});
      const result=page.locator('.reader-result').first();
      assert.ok(await result.locator('mark.reader-result-match').count()>0,
        'Search term must be visibly highlighted');
      if(width===390) {
        await search.focus();
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(()=>
          document.activeElement?.classList.contains('reader-result')),true);
        await page.keyboard.press('ArrowUp');
        assert.equal(await search.evaluate(el=>document.activeElement===el),true);
        await page.evaluate(()=>{
          const original=Element.prototype.scrollIntoView;
          Element.prototype.scrollIntoView=function(opts){
            window.__litScrollBehavior=opts?.behavior;
            return original.call(this,opts);
          };
        });
      }
      await result.click();
      const hash=new URL(page.url()).hash;
      assert.ok(hash.startsWith('#lit-'),'Search result must have stable URL');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),
        decodeURIComponent(hash.slice(1)),'Search jump should focus its passage');
      if(width===390) {
        assert.equal(await page.evaluate(()=>window.__litScrollBehavior),'instant',
          'Reduced motion should disable animated search jumps');
        await page.goBack();
        assert.equal(new URL(page.url()).hash,'',
          'Browser Back must reverse search-history navigation');
      }
    }
    await page.screenshot({path:'test-artifacts/reader-'+width+'.png'});
    await context.close();
    console.log('PASS viewport',width);
  }
  // Arabic search, revision visibility and persisted preference on real DOM.
  const context=await browser.newContext({viewport:{width:390,height:844},
    reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#reader-search-toggle').click();
  await page.locator('#reader-search-input').fill('اثبتت الحجج');
  await page.locator('.reader-result').first().waitFor({timeout:12000});
  assert.ok(await page.locator('.reader-result-snippet mark.reader-result-match').first().count()>0,
    'Arabic query must highlight its actual scholarly text even inside mixed-direction cells');
  await context.close();
  // Real browser shutdown/restart: local checkpoints must remain usable.
  const profile='/tmp/literature-c3-profile';
  let installed=await chromium.launchPersistentContext(profile,{
    headless:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
  let reading=installed.pages()[0] || await installed.newPage();
  await reading.goto(url,{waitUntil:'domcontentloaded'});
  await reading.locator('#chapter-12 .section[id]').first()
    .evaluate(el=>el.scrollIntoView({block:'start'}));
  await reading.waitForTimeout(1500);
  await reading.evaluate(()=>window.dispatchEvent(new Event('scroll')));
  const checkpoint=await reading.evaluate(()=>
    JSON.parse(localStorage.getItem('11am-literature-reading-position-v1')));
  assert.equal(checkpoint?.chapter,'12');
  assert.equal(checkpoint?.version,2);
  await installed.close();

  installed=await chromium.launchPersistentContext(profile,{
    headless:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
  reading=installed.pages()[0] || await installed.newPage();
  await reading.goto(url,{waitUntil:'domcontentloaded'});
  await reading.locator('#panel-toggle').click();
  const resume=reading.locator('.reader-resume-button').first();
  assert.equal(await resume.isDisabled(),false);
  await resume.click();
  await reading.waitForTimeout(250);
  const resumedY=await reading.evaluate(()=>window.scrollY);
  assert.ok(resumedY>1000,'Resume did not leave the cover after full browser restart');

  // Two controlled tabs must reopen the complete text without a network.
  await reading.evaluate(async()=>{await navigator.serviceWorker.ready;});
  const another=await installed.newPage();
  await another.goto(url,{waitUntil:'domcontentloaded'});
  await installed.setOffline(true);
  await reading.reload({waitUntil:'domcontentloaded'});
  await another.reload({waitUntil:'domcontentloaded'});
  for(const tab of [reading,another]) {
    assert.equal(await tab.locator('#book > .chapter').count(),25,
      'Offline multi-tab reopened an incomplete dossier');
  }
  await installed.close();
  console.log('PASS: Chromium responsive layout, drawer, Arabic/Latin search and stable passages, browser restart and two-tab offline reading');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
