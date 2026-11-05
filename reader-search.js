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
    Array.prototype.forEach.call(doc.querySelectorAll('#book > .chapter'), function(ch) {
      var num = ch.getAttribute('data-chapter');
      var titleNode = ch.querySelector('.chapter-title-page h1');
      var title = titleNode ? titleNode.textContent.trim() : 'Reading ' + num;
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
        index.push({
          el:el,chapter:num,title:title,section:sectionLabel,revision:inRevision,
          text:text,normalized:normalize(text),heading:heading
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
  root.LiteratureSearch = {normalize:normalize,buildIndex:buildIndex,find:find,excerpt:excerpt};
})(typeof window !== 'undefined' ? window : this);
