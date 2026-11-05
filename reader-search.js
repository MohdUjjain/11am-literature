/* Text search over the published Literature DOM (no remote index or server).
 * Keep the engine standalone so its matching can be regression-tested in Node.
 */
(function (root) {
  'use strict';
  function normalize(input) {
    return String(input == null ? '' : input).normalize('NFKD')
      .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
      .replace(/[\u0622\u0623\u0625]/g, '\u0627')
      .replace(/\u0649/g, '\u064a')
      .toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  }
  function buildIndex(doc) {
    var index = [];
    var seen = new Set();
    Array.prototype.forEach.call(doc.querySelectorAll('#book > .chapter'), function(ch) {
      var num = ch.getAttribute('data-chapter');
      var titleNode = ch.querySelector('.chapter-title-page h1');
      var title = titleNode ? titleNode.textContent.trim() : 'Reading ' + num;
      var counter = 0;
      // Search actual textual units, including headings, prose, tables, aids
      // and revision cards; don't index the compositor's printed clones.
      var selector = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,dt,dd,figcaption,pre,span,div,strong,em,code';
      Array.prototype.forEach.call(ch.querySelectorAll(selector), function(el) {
        // Lists containing paragraphs would otherwise generate duplicate hits.
        if ((el.tagName === 'LI' || el.tagName === 'BLOCKQUOTE') &&
            el.querySelector && el.querySelector('p,li,blockquote')) return;
        // Capture standalone label/definition text nodes without duplicating
        // their content when a parent paragraph, heading or list is indexed.
        if (/^(DIV|SPAN|STRONG|EM|CODE)$/.test(el.tagName)) {
          if (el.children && el.children.length) return;
          if (el.parentElement && el.parentElement.closest &&
              el.parentElement.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,dt,dd,figcaption,pre'))
            return;
        }
        var text = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (!text || text.length < 2) return;
        var heading = /^H[1-6]$/.test(el.tagName);
        var inRevision = !!(el.closest && el.closest('.revision-zone'));
        var section = el.closest ? el.closest('.section') : null;
        var headingNode = section && section.querySelector(':scope > h2');
        var sectionLabel = headingNode ? headingNode.textContent.trim() :
                           inRevision ? 'Revision notes' : 'Reading overview';
        var normalized = normalize(text);
        // Duplicate nested labels and repeated cells should not make the
        // concordance display the same textual unit multiple times.
        var fingerprint = num + '\u0000' + sectionLabel + '\u0000' +
                          (inRevision ? 'revision' : 'main') + '\u0000' + normalized;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        // IDs are deterministic within each published reading, so a search
        // jump has a shareable fragment without changing scholarly markup.
        // Prefer existing section and passage anchors whenever available.
        var passage = el.closest && el.closest('.passage[data-anchor]');
        var destination = passage || el;
        if (!destination.id) {
          var passageKey = passage && passage.getAttribute('data-anchor');
          destination.id = passageKey && /^[\w-]+$/.test(passageKey)
            ? 'lit-passage-' + passageKey
            : 'lit-hit-' + num + '-' + (++counter);
        }
        index.push({
          el:el,destination:destination,anchorId:destination.id,
          chapter:num,title:title,section:sectionLabel,revision:inRevision,
          text:text,normalized:normalized,heading:heading
        });
      });
    });
    return index;
  }
  function find(index, query) {
    var phrase = normalize(query);
    if (!phrase) return [];
    var terms = phrase.split(' ').filter(Boolean);
    var result = [];
    index.forEach(function(entry, order) {
      var exact = entry.normalized.indexOf(phrase);
      if (exact < 0 && !terms.every(function(t){return entry.normalized.indexOf(t) >= 0;})) return;
      // Favour exact phrases and headings, but keep every match accessible.
      var rank = (exact >= 0 ? 20 : 0) + (entry.heading ? 10 : 0) +
                 (entry.normalized.indexOf(phrase) === 0 ? 4 : 0);
      result.push({entry:entry,order:order,score:rank});
    });
    result.sort(function(a,b){return b.score-a.score || a.order-b.order;});
    return result;
  }
  function excerpt(text,query,maxChars) {
    var value = String(text || '').replace(/\s+/g,' ').trim();
    var max = maxChars || 185;
    if (value.length <= max) return value;
    var needle = normalize(query).split(' ')[0] || '';
    var pos = normalize(value).indexOf(needle);
    var start = Math.max(0, pos < 0 ? 0 : pos - Math.floor(max / 3));
    var end = Math.min(value.length, start+max);
    if (end-start < max) start = Math.max(0,end-max);
    return (start ? '…' : '') + value.slice(start,end).trim() +
           (end<value.length ? '…' : '');
  }
  // Match offsets must be mapped to original Unicode code-unit offsets.
  // Normalized strings can be shorter after Arabic vowel marks or Latin
  // combining accents have been removed.
  function mappedText(input) {
    var source = String(input || ''), value = '', offsets = [];
    for (var i = 0; i < source.length;) {
      var code = source.codePointAt(i);
      var char = String.fromCodePoint(code);
      var transformed = normalize(char);
      if (/\\s/u.test(char)) transformed = ' ';
      if (transformed === ' ' && (!value || value.endsWith(' '))) {
        i += char.length; continue;
      }
      for (var k = 0; k < transformed.length; k++) offsets.push(i);
      value += transformed;
      i += char.length;
    }
    if (value.endsWith(' ')) { value = value.slice(0,-1); offsets.pop(); }
    return {value:value,offsets:offsets,source:source};
  }
  function excerptMatch(text, query, maxChars) {
    var mapped = mappedText(String(text || '').replace(/\\s+/g,' '));
    var terms = normalize(query).split(' ').filter(Boolean);
    var hits = [];
    terms.forEach(function(term) {
      var at = 0, pos;
      while ((pos = mapped.value.indexOf(term,at)) >= 0) {
        var from = mapped.offsets[pos];
        var last = mapped.offsets[pos + term.length - 1];
        if (from !== undefined && last !== undefined)
          hits.push([from,last+1]);
        at = pos + Math.max(1,term.length);
        if (hits.length > 1000) break;
      }
    });
    hits.sort(function(a,b){return a[0]-b[0] || b[1]-a[1];});
    var merged = [];
    hits.forEach(function(hit){
      var prev = merged[merged.length-1];
      if (prev && hit[0] <= prev[1]) prev[1] = Math.max(prev[1],hit[1]);
      else merged.push(hit.slice());
    });
    var source = mapped.source, max = maxChars || 185;
    var start = source.length > max && merged.length
      ? Math.max(0,merged[0][0]-Math.floor(max/3)) : 0;
    var end = Math.min(source.length,start+max);
    if (end-start < max) start = Math.max(0,end-max);
    var parts = [], cursor = start;
    merged.forEach(function(hit) {
      var a = Math.max(start,hit[0]), b = Math.min(end,hit[1]);
      if (b <= a || a < cursor) return;
      if (a > cursor) parts.push({text:source.slice(cursor,a),match:false});
      parts.push({text:source.slice(a,b),match:true});
      cursor = b;
    });
    if (cursor < end) parts.push({text:source.slice(cursor,end),match:false});
    return {parts:parts,start:start,end:end,prefix:start>0,suffix:end<source.length};
  }
  root.LiteratureSearch = {normalize:normalize,buildIndex:buildIndex,find:find,
    excerpt:excerpt,excerptMatch:excerptMatch};
})(typeof window !== 'undefined' ? window : this);
