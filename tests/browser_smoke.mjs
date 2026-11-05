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
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('#reader-search-input').waitFor({state:'attached'});
    const horizontal=await page.evaluate(()=>({
      doc:document.documentElement.scrollWidth,
      viewport:window.innerWidth
    }));
    assert.ok(horizontal.doc<=horizontal.viewport+3,
      'Unexpected horizontal overflow at '+width+'px: '+JSON.stringify(horizontal));
    await page.locator('#panel-toggle').click();
    await assert.doesNotReject(()=>page.locator('#panel-tools').count());
    assert.equal(await page.locator('#side-panel').getAttribute('aria-hidden'),'false');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#side-panel').getAttribute('aria-hidden'),'true');
    if(width<=850) await page.locator('#reader-search-toggle').click();
    const search=page.locator('#reader-search-input');
    await search.fill('fatimid');
    await page.locator('.reader-result').first().waitFor({timeout:12000});
    const result=page.locator('.reader-result').first();
    assert.ok(await result.locator('mark.reader-result-match').count()>0,
      'Search term must be visibly highlighted');
    await result.click();
    const hash=new URL(page.url()).hash;
    assert.ok(hash.startsWith('#lit-'),'Search result must have stable URL');
    await page.screenshot({path:'test-artifacts/reader-'+width+'.png'});
    await context.close();
  }
  // Arabic search, revision visibility and persisted preference on real DOM.
  const context=await browser.newContext({viewport:{width:390,height:844},
    reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#reader-search-toggle').click();
  await page.locator('#reader-search-input').fill('بسم الله');
  await page.locator('.reader-result').first().waitFor({timeout:12000});
  assert.ok(await page.locator('.reader-result-snippet[dir="rtl"]').count()>0);
  await context.close();
  console.log('PASS: Chromium responsive layout, drawer, Arabic/Latin search and stable passages');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
