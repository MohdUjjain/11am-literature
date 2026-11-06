/**
 * Exhaustive 320/390px authored-table accessibility audit for the Literature reader.
 * Checks every source table in #book (not merely document overflow).
 * Writes per-table geometry/content reports and screenshot samples to test-artifacts/.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 8774;
const url = 'http://127.0.0.1:' + PORT + '/';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {stdio:'ignore'});
let browser;
const report = {name:'Literature exhaustive mobile table audit', version:1, widths:[], issues:[]};

function measureAtWidth() {
  const viewport = innerWidth;
  const book = document.getElementById('book');
  const tables = [...book.querySelectorAll('.chapter table')];
  const normal = text => (text || '').replace(/\s+/g,' ').trim();
  const fingerprint = text => {
    let h = 2166136261;
    for (let i=0; i<text.length; i++) h = Math.imul(h ^ text.charCodeAt(i),16777619);
    return (h>>>0).toString(16).padStart(8,'0');
  };
  const hidden = element => {
    for (let p=element; p && p!==document; p=p.parentElement) {
      const s = getComputedStyle(p);
      if (p.hidden || s.display==='none' || s.visibility==='hidden' ||
          s.visibility==='collapse' || Number(s.opacity)===0) return true;
    }
    return false;
  };
  const entries = [];
  let totalCells=0, totalTextNodes=0;
  for (const [index,table] of tables.entries()) {
    table.setAttribute('data-lit-audit-table',String(index));
    const chapter = table.closest('.chapter');
    const chapterTables = [...chapter.querySelectorAll('table')];
    const chapterNumber = chapter.getAttribute('data-chapter') || chapter.id;
    const item = {
      index, chapter:chapterNumber,
      inChapter:chapterTables.indexOf(table)+1,
      caption:normal(table.querySelector('caption')?.textContent).slice(0,100),
      rows:table.rows.length,
      cells:table.querySelectorAll('th,td').length,
      contentChars:normal(table.textContent).length,
      fingerprint:fingerprint(normal(table.textContent)),
      minCellWidth:null,
      tableWidth:Math.round(table.getBoundingClientRect().width),
      scrollingRegions:[],
      issues:[]
    };
    if (hidden(table) || table.getClientRects().length===0) {
      item.issues.push('Whole table is hidden at '+viewport+'px');
    }

    let scroller=null;
    for (let parent=table;parent && parent!==document.documentElement;parent=parent.parentElement) {
      const s=getComputedStyle(parent);
      const x=s.overflowX;
      const excessive=parent.scrollWidth>parent.clientWidth+3 && parent.clientWidth>0;
      if (excessive && (x==='auto'||x==='scroll'||x==='hidden')) {
        const key='t'+index+'-'+item.scrollingRegions.length;
        parent.setAttribute('data-lit-audit-scroll',key);
        const data={
          key, tag:parent.tagName.toLowerCase(), cssOverflow:x,
          scrollWidth:parent.scrollWidth, clientWidth:parent.clientWidth,
          tabindex:parent.tabIndex,
          role:parent.getAttribute('role')||'',
          ariaLabel:normal(parent.getAttribute('aria-label')||
            (parent.getAttribute('aria-labelledby') &&
              document.getElementById(parent.getAttribute('aria-labelledby'))?.textContent)),
          describedBy:normal(parent.getAttribute('aria-describedby'))
        };
        item.scrollingRegions.push(data);
        if (!scroller) scroller=data;
      }
    }
    if (scroller && scroller.cssOverflow==='hidden')
      item.issues.push('Horizontally clipped/hidden overflow region '+scroller.key);
    if (scroller && scroller.tabindex<0)
      item.issues.push('Horizontal overflow region is not in keyboard tab order: '+scroller.key);
    if (scroller && !scroller.ariaLabel)
      item.issues.push('Horizontal overflow region has no accessible label: '+scroller.key);

    const cells=[...table.querySelectorAll('th,td')];
    totalCells+=cells.length;
    let sampleIssues=0;
    for (const [ci,cell] of cells.entries()) {
      const style=getComputedStyle(cell),rect=cell.getBoundingClientRect();
      const hasText=normal(cell.textContent).length>0;
      const contentWidth=Math.round(rect.width);
      item.minCellWidth=item.minCellWidth===null?contentWidth:Math.min(item.minCellWidth,contentWidth);
      if (!hasText) continue;
      const cellDescription=(cell.tagName.toLowerCase()+'['+ci+'] '+normal(cell.textContent).slice(0,42));
      if (hidden(cell)||rect.width<1||rect.height<1) {
        item.issues.push('Text-bearing cell not rendered: '+cellDescription);
        continue;
      }
      if ((style.overflowX==='hidden'||style.overflowX==='clip') &&
          cell.scrollWidth>cell.clientWidth+4)
        item.issues.push('Cell has clipped horizontal content: '+cellDescription);
      if ((style.overflowY==='hidden'||style.overflowY==='clip') &&
          cell.scrollHeight>cell.clientHeight+4)
        item.issues.push('Cell has clipped vertical content: '+cellDescription);

      const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode=walker.nextNode())) {
        if (!normal(textNode.textContent)) continue;
        totalTextNodes++;
        const owner=textNode.parentElement;
        if (hidden(owner)) {
          item.issues.push('Authored cell text is hidden: '+cellDescription);
          continue;
        }
        const range=document.createRange();
        range.selectNodeContents(textNode);
        const rects=[...range.getClientRects()].filter(r=>r.width>.2&&r.height>.2);
        range.detach();
        if (!rects.length) {
          item.issues.push('Authored text has no rendered glyph bounds: '+cellDescription);
          continue;
        }
        for (const r of rects) {
          if (!scroller && (r.left < -2 || r.right > viewport+2) && sampleIssues++<10)
            item.issues.push('Glyph outside horizontal viewport: '+cellDescription+
              ' ['+Math.round(r.left)+','+Math.round(r.right)+']');
          // Any hidden/clip ancestor must not mask text; actual scrolling
          // regions are verified separately with real keyboard interactions.
          for (let a=owner;a&&a!==document.body;a=a.parentElement) {
            const sx=getComputedStyle(a);
            if (a===cell && (sx.overflowX==='hidden'||sx.overflowX==='clip')) {
              const b=a.getBoundingClientRect();
              if ((r.left<b.left-3||r.right>b.right+3) && sampleIssues++<10)
                item.issues.push('Text clipped by cell bounds: '+cellDescription);
            }
            if ((sx.overflowX==='hidden'||sx.overflowX==='clip') &&
                a.scrollWidth<=a.clientWidth+3) {
              const b=a.getBoundingClientRect();
              if ((r.left<b.left-3||r.right>b.right+3) && sampleIssues++<10)
                item.issues.push('Text masked by non-scrollable ancestor: '+cellDescription);
            }
          }
        }
      }
    }
    if (item.issues.length) item.issues=[...new Set(item.issues)].slice(0,40);
    entries.push(item);
  }
  const chapters=[...new Set(entries.map(x=>x.chapter))];
  return {viewport, docWidth:document.documentElement.scrollWidth, tableCount:tables.length,
    chapterCount:chapters.length, totalCells, totalTextNodes, entries,
    revisionPreference:document.getElementById('lit-show-revisions')?.checked ?? null};
}

try {
  for(let attempt=0;attempt<40;attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  browser=await chromium.launch({headless:true});
  await mkdir('test-artifacts',{recursive:true});

  let baseline=null;
  for (const width of [1280,320,390]) {
    const context=await browser.newContext({
      viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'
    });
    const page=await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('#book .chapter').first().waitFor();
    await page.evaluate(async()=> {
      if (document.fonts?.ready) await Promise.race([
        document.fonts.ready,new Promise(resolve=>setTimeout(resolve,2500))
      ]);
    });
    const snapshot=await page.evaluate(measureAtWidth);
    if (width===1280) {
      baseline=snapshot;
      assert(snapshot.tableCount>0,'No authored tables found in the reader');
    } else {
      assert.equal(snapshot.tableCount,baseline.tableCount,
        'Not all authored tables survived the '+width+'px layout');
      for(const [index,table] of snapshot.entries.entries()){
        const old=baseline.entries[index];
        assert.equal(table.fingerprint,old.fingerprint,
          'Table '+index+' authored text changed at '+width+'px');
        assert.equal(table.rows,old.rows,
          'Table '+index+' rows changed at '+width+'px');
        assert.equal(table.cells,old.cells,
          'Table '+index+' cells changed at '+width+'px');
      }
      if(snapshot.docWidth>width+3)
        report.issues.push(width+'px document has horizontal overflow: '+
          snapshot.docWidth+'px');

      const tested=new Set();
      for(const entry of snapshot.entries){
        for(const s of entry.scrollingRegions){
          if(tested.has(s.key))continue;
          tested.add(s.key);
          const el=page.locator('[data-lit-audit-scroll="'+s.key+'"]').first();
          try {
            await el.focus();
            let values=[await el.evaluate(e=>e.scrollLeft)];
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(125);
            values.push(await el.evaluate(e=>e.scrollLeft));
            await page.keyboard.press('ArrowLeft');
            await page.waitForTimeout(125);
            values.push(await el.evaluate(e=>e.scrollLeft));
            s.keyboardValues=values;
            s.keyboardVerified=values.some(x=>Math.abs(x-values[0])>.5);
            if(!s.keyboardVerified)
              entry.issues.push('Actual horizontal region cannot be scrolled by arrow keys: '+s.key);
          } catch(e) {
            entry.issues.push('Keyboard scroll verification failed: '+s.key+' '+String(e).slice(0,100));
          }
        }
        if(entry.issues.length)
          report.issues.push({width,chapter:entry.chapter,
            table:entry.inChapter,index:entry.index,issues:entry.issues});
      }
      // Representative screenshots are supplementary; every table is
      // assessed by geometry and every text-bearing cell by rendered glyphs.
      const chosen=[snapshot.entries[0],snapshot.entries[Math.floor(snapshot.entries.length/2)],
        [...snapshot.entries].sort((a,b)=>b.cells-a.cells)[0]];
      for(const table of chosen.filter(Boolean)){
        try {
          await page.locator('[data-lit-audit-table="'+table.index+'"]').screenshot({
            path:'test-artifacts/table-'+width+'-index-'+table.index+'.png',
            animations:'disabled',timeout:10000
          });
        }catch(e){
          report.issues.push({width,index:table.index,
            issues:['Representative screenshot could not be captured: '+String(e).slice(0,100)]});
        }
      }
    }
    report.widths.push(snapshot);
    console.log('AUDIT '+width+'px: '+snapshot.tableCount+' tables, '+
      snapshot.totalCells+' cells, '+snapshot.totalTextNodes+' text nodes; '+
      snapshot.entries.filter(x=>x.issues.length).length+' flagged tables');
    await context.close();
  }
  await writeFile('test-artifacts/mobile-table-audit.json',
    JSON.stringify(report,null,2));
  assert.deepEqual(report.issues,[],
    'Some mobile tables have clipped/missing text or inaccessible scroll. See mobile-table-audit.json');
  console.log('PASS: all '+baseline.tableCount+
    ' authored tables preserve every cell and visible text at 320px / 390px; keyboard scroll verified');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
