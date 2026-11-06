// Browser-level regression for the actual failed 22 note and the exact
// chapter selection reported by the reader. No PDF is generated in CI.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base='http://127.0.0.1:8766/';
const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],
  {stdio:'ignore'});
let browser;
const selected=[13,14,15,16,17,18,20,21,22,23,24,25,26];
try {
  for(let i=0;i<40;i++){
    try {const response=await fetch(base);if(response.ok)break;}catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1250,height:900},
    reducedMotion:'reduce'});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    if(document.fonts?.ready)
      await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);
  });
  const metadata=await page.evaluate(()=>{
    const chapters=[...document.querySelectorAll('#book > .chapter')];
    return {total:chapters.length,sourceNotices:document.querySelectorAll(
      '.chapter-title-page .source-cite').length,
      sourceLabels:chapters.filter(c=>c.querySelector('.source-cite')).length,
      openerCount:chapters.filter(c=>c.querySelector('.chapter-title-page h1')).length,
      oldCheck:!!document.getElementById('toggle-revision')?.checked};
  });
  assert.equal(metadata.total,25);
  assert.equal(metadata.openerCount,25);
  assert.equal(metadata.sourceNotices,0,'No title-page source paragraph may remain');
  assert.equal(metadata.sourceLabels,0,'No chapter may retain a source notice');
  assert.equal(metadata.oldCheck,true,'Revision pages must default to included');

  await mkdir('test-artifacts',{recursive:true});
  for(const selection of [[22],selected]){
    const test=await page.evaluate(numbers=>{
      const input=document.getElementById('range-spec');
      input.value=numbers.join(',');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('toggle-revision').checked=true;
      const t=performance.now();
      try {window.DossierPrint.build();}
      catch(error){return {error:String(error),diagnostics:window.__dossierPrintDiagnostics};}
      const pages=[...document.querySelectorAll('#print-root > .printed-page')];
      const summaries=numbers.map(n=>{
        const chapter=document.querySelector('.chapter[data-chapter="'+n+'"]');
        const summary=chapter?.querySelector('.revision-zone .section h2')?.textContent.trim();
        const revisions=pages.filter(p=>p.matches('.theme-ink')&&
          p.dataset.printChapter===String(n));
        const complete=revisions.map(p=>p.textContent).join(' ');
        return {chapter:n,count:revisions.length,hasSummary:!!summary&&
          complete.includes(summary)};
      });
      const studyNotes=pages.flatMap(p=>[...p.querySelectorAll('.side-note-card')]);
      const relevant=studyNotes.filter(n=>n.getAttribute('data-note-id')==='s22-4-p1-n0');
      const openers=numbers.map(n=>({
        reading:n,exists:!!document.getElementById('print-chapter-'+n)
      }));
      return {pages:pages.length,ms:Math.round(performance.now()-t),
        diagnostics:window.__dossierPrintDiagnostics,
        summaries,openers,
        noteIds:studyNotes.map(n=>n.dataset.noteId),
        reportedNoteCount:relevant.length,
        sourceParagraphs:document.querySelectorAll('#print-root .source-cite').length,
        missingSummary:summaries.filter(s=>!s.hasSummary||s.count===0),
        noteCount:studyNotes.length};
    },selection);
    console.log('Print '+selection.join(',')+': '+JSON.stringify({
      pages:test.pages,ms:test.ms,diagnostics:test.diagnostics,
      missingSummary:test.missingSummary,
      noteCount:test.noteCount,reportedNoteCount:test.reportedNoteCount,
      error:test.error
    }));
    assert.ok(!test.error,'Compositor error: '+(test.error||''));
    assert.ok(test.pages>0,'No pages composed');
    assert.equal(test.sourceParagraphs,0,'Title-page notices reappeared in print');
    assert.deepEqual(test.missingSummary,[],'Selected revision/summary pages missing');
    assert.ok(test.openers.every(x=>x.exists),'Selected reading opener missing');
    assert.equal(test.reportedNoteCount,1,
      'Jeton note s22-4-p1-n0 must appear once and only once');
    assert.equal(test.diagnostics.notesUnplaced,0,'Unplaced study note detected');
    assert.equal(test.diagnostics.notesPlaced,test.diagnostics.expectedNotes,
      'No source note may be omitted from the composed document');
    assert.equal(test.diagnostics.pages,test.pages,
      'Printed pages and tracked physical page count differ');
    const stats=await page.evaluate(()=>({
      pages:[...document.querySelectorAll('#print-root > .printed-page')],
      onlyVisible:!document.querySelector('#print-root .source-cite')
    }));
    // Do not serialize the actual DOM into this test process.
    assert.equal(stats.onlyVisible,true);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#print-root > .printed-page').count(),test.pages);
    await page.emulateMedia({media:'screen'});
    await page.screenshot({path:'test-artifacts/print-selected-'+selection.length+'.png',
      fullPage:false});
  }
  console.log('PASS: title pages clean; Reading 22 note preserved; exact 13-reading range includes every revision/summary and study note');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
