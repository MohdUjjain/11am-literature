/* Browser contract: hidden Literature revision content never appears in search. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://local/').pathname);
  const filename=path.resolve(root,'.'+pathname);
  if(!filename.startsWith(root)){res.writeHead(403).end();return;}
  try{
    const data=await readFile(filename);
    res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript':
      pathname.endsWith('.css')?'text/css':'text/html'}).end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},
    reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.addInitScript(()=>localStorage.setItem('11am-literature-show-revisions-v1','false'));
  const page=await ctx.newPage();
  const url='http://127.0.0.1:'+server.address().port+'/index.html';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const query=await page.evaluate(()=>{
    const entries=window.LiteratureSearch.buildIndex(document);
    const part=entries.find(e=>e.revision && e.text.length>18);
    if(!part)throw Error('No indexed revision passage');
    return part.text.trim().split(/\s+/).slice(0,4).join(' ');
  });
  const input=page.locator('#reader-search-input');
  await page.locator('#reader-search-toggle').click();
  await input.fill(query);
  await page.waitForFunction(()=>!document.querySelector('#reader-search-results').hidden);
  const filter=async()=>{
    const labels=await page.locator('.reader-result-section').allTextContents();
    assert.ok(labels.every(t=>!t.includes('Revision')),labels.join('|'));
  };
  await filter();
  assert.equal(await page.locator('#lit-show-revisions').isChecked(),false);
  assert.equal(await page.locator('.revision-zone.lit-temporary-revision').count(),0);
  // Changing visibility with the query open must recompute its results.
  await page.evaluate(()=>{
    const box=document.getElementById('lit-show-revisions');
    box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.reader-result-section')]
    .some(e=>e.textContent.includes('Revision')));
  await page.evaluate(()=>{
    const box=document.getElementById('lit-show-revisions');
    box.checked=false;box.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await filter();
  assert.equal(await page.evaluate(()=>localStorage.getItem('11am-literature-show-revisions-v1')),'false');
  const hit=page.locator('.reader-result').first();
  if(await hit.count()){
    await hit.click();
    assert.equal(await page.locator('.revision-zone.lit-temporary-revision').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement.closest('.revision-zone')!==null),false);
  }
  await ctx.close();
  console.log('PASS Literature: hidden revisions filtered, immediately refreshed, never revealed by search');
}finally{
  await browser.close();await new Promise(r=>server.close(r));
}
