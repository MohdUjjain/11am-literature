/* Search, tabbed navigation, revision visibility and optional resume.
 * UI-only enhancement. Never edits source notes or the PDF compositor.
 */
(function () {
  'use strict';
  var STORE_VISIBILITY = '11am-literature-show-revisions-v1';
  var STORE_POSITION = '11am-literature-reading-position-v1';
  var $ = function (id) {return document.getElementById(id);};
  var chapterList = [];
  var lastHit = null, lastHitTimer = null;
  var visibilityInput = null;
  var resumeButtons = [];
  var lastCapturedAt = 0, lastCaptureChapter = '';
  var searchEntries = null, results = [], shown = 0, searchTimer = null;
  var searchBox = null, searchResults = null, closeSearchButton = null;
  var pageSize = 24;

  function getStored(key) {
    try {return window.localStorage.getItem(key);} catch (_) {return null;}
  }
  function setStored(key,value) {
    try {window.localStorage.setItem(key,value);} catch (_) {}
  }
  function collect() {
    chapterList = Array.prototype.slice.call(
      document.querySelectorAll('#book > .chapter')
    );
  }
  function visibleRevisions(){
    return getStored(STORE_VISIBILITY) !== 'false';
  }
  function showRevisions(show,store) {
    document.body.classList.toggle('lit-revisions-hidden',!show);
    if (visibilityInput) visibilityInput.checked = !!show;
    if (store) setStored(STORE_VISIBILITY,show ? 'true' : 'false');
    // Recompute progress and passage-note geometry after hiding/showing zones.
    window.dispatchEvent(new Event('resize'));
  }
  function initTabs(){
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.panel-tab'));
    var panes = {
      index:$('panel-index'),
      tools:$('panel-tools')
    };
    function activate(name,focus) {
      var drawer = $('side-panel');
      if (drawer) drawer.scrollTop = 0;
      tabs.forEach(function(tab) {
        var selected = tab.getAttribute('data-tab') === name;
        tab.setAttribute('aria-selected',selected?'true':'false');
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
      });
      Object.keys(panes).forEach(function(key){
        if (panes[key]) panes[key].hidden = (name !== key);
      });
    }
    tabs.forEach(function(tab){
      tab.addEventListener('click',function(){activate(tab.getAttribute('data-tab'),false);});
      tab.addEventListener('keydown',function(event){
        if (['ArrowLeft','ArrowRight','Home','End'].indexOf(event.key)<0) return;
        event.preventDefault();
        var current = tabs.indexOf(tab);
        var next = event.key==='Home'?0:event.key==='End'?tabs.length-1:
                   (current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        activate(tabs[next].getAttribute('data-tab'),true);
      });
    });
    activate('index',false);
  }
  function readCheckpoint(){
    var raw = getStored(STORE_POSITION);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || !/^\d+$/.test(String(parsed.chapter))) return null;
      if (!Number.isFinite(parsed.fraction)) return null;
      var chapter = chapterList.find(function(ch){
        return ch.getAttribute('data-chapter') === String(parsed.chapter);
      });
      return chapter ? {chapter:chapter, number:String(parsed.chapter),
        fraction:Math.max(0,Math.min(1,parsed.fraction)),
        revision:!!parsed.revision} : null;
    } catch (_) {return null;}
  }
  function updateResumeControls(){
    var saved = readCheckpoint();
    resumeButtons.forEach(function(button){
      button.disabled = !saved;
      button.textContent = saved ? '↪ Continue Reading ' + saved.number : '↪ Continue Reading';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.reader-resume-caption'),
      function(caption){
        caption.textContent = saved
          ? 'Return to approximately ' + Math.round(saved.fraction*100) +
            '% of Reading ' + saved.number + '.'
          : 'Your reading position will be saved on this device.';
      });
  }
  function recordPosition(force){
    var now = Date.now();
    if (!force && now-lastCapturedAt < 1200) return;
    var line = window.scrollY+window.innerHeight*.36;
    var active = null;
    chapterList.forEach(function(ch){
      if(ch.getBoundingClientRect().top+window.scrollY <= line) active = ch;
    });
    if (!active) return; // At the cover: preserve the last reading checkpoint.
    var box = active.getBoundingClientRect();
    var top = box.top+window.scrollY;
    var fraction = Math.max(0,Math.min(1,(line-top)/Math.max(1,box.height)));
    var revision = active.querySelector('.revision-zone');
    var inRevision = !!(revision && revision.getClientRects().length &&
      revision.getBoundingClientRect().top <= window.innerHeight*.36);
    var num = active.getAttribute('data-chapter');
    // Avoid overwriting a stored checkpoint before an explicit Continue action
    // when a previous visit has reopened at the cover.
    setStored(STORE_POSITION,JSON.stringify({
      chapter:num,fraction:fraction,revision:inRevision,savedAt:now
    }));
    lastCapturedAt=now;
    if(lastCaptureChapter!==num) {
      lastCaptureChapter=num;
      updateResumeControls();
    }
  }
  function continueReading(){
    var saved = readCheckpoint();
    if (!saved) return;
    if(saved.revision && !visibleRevisions()) showRevisions(true,true);
    var rect = saved.chapter.getBoundingClientRect();
    var top = rect.top+window.scrollY;
    var point = top+saved.fraction*rect.height;
    var max = Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    var destination = Math.max(0,Math.min(max,point-window.innerHeight*.36));
    // Close the drawer through its existing accessible close control.
    var close = $('panel-close');
    if(close) close.click();
    window.scrollTo({top:destination,behavior:'smooth'});
  }
  function initResume(){
    resumeButtons=Array.prototype.slice.call(
      document.querySelectorAll('.reader-resume-button')
    );
    resumeButtons.forEach(function(button){
      button.addEventListener('click',continueReading);
    });
    updateResumeControls();
    window.addEventListener('scroll',function(){recordPosition(false);},{passive:true});
    window.addEventListener('pagehide',function(){recordPosition(true);});
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden')recordPosition(true);
    });
  }
  function initVisibility(){
    visibilityInput=$('lit-show-revisions');
    showRevisions(visibleRevisions(),false);
    if(visibilityInput) visibilityInput.addEventListener('change',function(){
      showRevisions(visibilityInput.checked,true);
    });
  }
  function ensureIndex(){
    if(!searchEntries && window.LiteratureSearch)
      searchEntries=window.LiteratureSearch.buildIndex(document);
    return searchEntries||[];
  }
  function closeResults(){
    if(searchResults) searchResults.hidden=true;
    if(searchBox) searchBox.setAttribute('aria-expanded','false');
  }
  function openResults(){
    if(searchResults) searchResults.hidden=false;
    if(searchBox) searchBox.setAttribute('aria-expanded','true');
  }
  function resultButton(hit){
    var entry = hit.entry;
    var button=document.createElement('button');
    button.type='button';button.className='reader-result';
    button.setAttribute('role','option');
    var title=document.createElement('strong');
    title.className='reader-result-title';
    title.textContent = 'Reading ' + entry.chapter + ' · ' + entry.title;
    var section=document.createElement('span');
    section.className='reader-result-section';
    section.textContent = entry.section + (entry.revision ? ' · Revision' : '');
    var snippet=document.createElement('span');
    snippet.className='reader-result-snippet';
    snippet.textContent=window.LiteratureSearch.excerpt(
      entry.text, searchBox.value, 190
    );
    button.appendChild(title);button.appendChild(section);button.appendChild(snippet);
    button.addEventListener('click',function(){jumpTo(hit);});
    return button;
  }
  function addMoreResults(){
    var end=Math.min(results.length,shown+pageSize);
    for(var i=shown;i<end;i++) searchResults.appendChild(resultButton(results[i]));
    shown=end;
    if(shown<results.length){
      var more=document.createElement('button');
      more.type='button';more.className='reader-search-more';
      more.textContent='Show more matches ('+(results.length-shown)+' remaining)';
      more.addEventListener('click',function(){
        more.remove();addMoreResults();
      });
      searchResults.appendChild(more);
    }
  }
  function jumpTo(hit){
    var target=hit.entry.el;
    if(hit.entry.revision && !visibleRevisions())showRevisions(true,true);
    if(lastHit)lastHit.classList.remove('reader-search-hit-target');
    if(lastHitTimer)clearTimeout(lastHitTimer);
    lastHit=target;
    target.classList.add('reader-search-hit-target');
    target.scrollIntoView({behavior:'smooth',block:'center'});
    closeResults();
    searchBox.blur();
    lastHitTimer=setTimeout(function(){
      target.classList.remove('reader-search-hit-target');
      if(lastHit===target)lastHit=null;
    },4800);
  }
  function renderResults(){
    if(!searchBox || !searchResults || !window.LiteratureSearch)return;
    var query=searchBox.value.trim();
    closeSearchButton.hidden=!query;
    searchResults.replaceChildren();
    shown=0;
    if(!query){results=[];closeResults();return;}
    results=window.LiteratureSearch.find(ensureIndex(),query);
    var summary=document.createElement('div');
    summary.className='reader-search-summary';
    summary.setAttribute('role','status');
    summary.textContent=results.length
      ? results.length+' match'+(results.length===1?'':'es')+' across the dossier'
      : 'No matches found in the available readings';
    searchResults.appendChild(summary);
    addMoreResults();
    openResults();
  }
  function initSearch(){
    searchBox=$('reader-search-input');
    searchResults=$('reader-search-results');
    closeSearchButton=$('reader-search-close');
    if(!searchBox||!searchResults||!closeSearchButton||!window.LiteratureSearch)return;
    searchBox.addEventListener('input',function(){
      if(searchTimer)clearTimeout(searchTimer);
      searchTimer=setTimeout(renderResults,140);
    });
    searchBox.addEventListener('focus',function(){
      if(searchBox.value.trim())renderResults();
    });
    closeSearchButton.addEventListener('click',function(){
      searchBox.value='';renderResults();searchBox.focus();
    });
    searchBox.addEventListener('keydown',function(event){
      if(event.key==='Escape'){
        event.preventDefault();closeResults();searchBox.blur();
      }else if(event.key==='Enter'){
        event.preventDefault();
        if(results.length)jumpTo(results[0]);
      }else if(event.key==='ArrowDown'&&!searchResults.hidden){
        var first=searchResults.querySelector('.reader-result');
        if(first){event.preventDefault();first.focus();}
      }
    });
    searchResults.addEventListener('keydown',function(event){
      var buttons=Array.prototype.slice.call(
        searchResults.querySelectorAll('.reader-result,.reader-search-more')
      );
      var idx=buttons.indexOf(document.activeElement);
      if(event.key==='Escape'){
        event.preventDefault();closeResults();searchBox.focus();
      }else if(event.key==='ArrowDown'&&idx>=0){
        event.preventDefault();buttons[Math.min(idx+1,buttons.length-1)].focus();
      }else if(event.key==='ArrowUp'){
        event.preventDefault();
        if(idx<=0)searchBox.focus();
        else buttons[idx-1].focus();
      }
    });
    document.addEventListener('pointerdown',function(event){
      if(!searchResults.hidden &&
         !searchResults.contains(event.target) &&
         !searchBox.closest('.reader-search-wrap').contains(event.target))
        closeResults();
    });
    document.addEventListener('keydown',function(event){
      var tag=(document.activeElement&&document.activeElement.tagName||'').toLowerCase();
      var editing=tag==='input'||tag==='textarea'||
                  (document.activeElement&&document.activeElement.isContentEditable);
      if((event.key==='/'&&!editing) ||
         ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k')){
        event.preventDefault();searchBox.focus();searchBox.select();
      }
    });
  }
  function setup(){
    collect();initTabs();initVisibility();initResume();initSearch();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup);
  else setup();
})();
