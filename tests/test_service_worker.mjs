import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const code=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const scope='https://mohdujjain.github.io/11am-literature/';
const normalize=v=>new URL(typeof v==='string'?v:v.url,scope).href;

function simulate(fail=false,failFonts=false,openClients=0){
  const listeners={},stores=new Map(),stats={skip:0,claim:0,network:0};
  const caches={
    open:async name=>{
      if(!stores.has(name)){
        const entries=new Map();
        stores.set(name,{
          entries,
          async addAll(paths){
            if(fail)throw Error('Simulated interrupted cache download');
            for(const p of paths)entries.set(normalize(p),new Response('cached '+p));
          },
          async put(p,response){entries.set(normalize(p),response.clone());},
          async match(p){return entries.get(normalize(p))?.clone();}
        });
      }
      return stores.get(name);
    },
    keys:async()=>[...stores.keys()],
    delete:async name=>stores.delete(name)
  };
  const self={
    registration:{scope},
    location:{origin:'https://mohdujjain.github.io'},
    skipWaiting:async()=>{stats.skip++},
    clients:{claim:async()=>{stats.claim++},matchAll:async()=>Array(openClients).fill({})},
    addEventListener:(name,fn)=>{listeners[name]=fn}
  };
  runInContext(code,createContext({
    self,caches,URL,Promise,Set,Response,
    fetch:async(request)=>{
      stats.network++;
      const url=normalize(request);
      if (/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//.test(url) && !failFonts) {
        return new Response('font '+url,{status:200});
      }
      throw Error('No network');
    }
  }));
  async function event(type,attrs={}){
    let wait,reply;
    listeners[type]({...attrs,waitUntil:p=>{wait=p},respondWith:p=>{reply=p}});
    if(wait)await wait;
    return reply?await reply:null;
  }
  return {stores,stats,caches,event};
}

const a=simulate();
await a.caches.open('11am-politics-reader-keep');
await a.caches.open('11am-lit-reader-old-core');
await a.event('install');
assert.equal(a.stats.skip,1);
const current=[...a.stores.keys()].find(x=>x.startsWith('11am-lit-reader-')&&x!=='11am-lit-reader-old-core');
assert.ok(current,'Versioned book cache missing');
const stored=a.stores.get(current).entries;
assert.ok(stored.has(normalize('./index.html')));
assert.ok(stored.has(normalize('./offline-update.js')));
assert.ok(stored.has(normalize('./og-image.png')));
assert.ok(stored.has(normalize('./reader-search.js')));
assert.ok(stored.has(normalize('./reader-ui.js')));
assert.ok(stored.has(normalize('./reader-ui.css')));
// Edition status must identify the currently installed complete shell, rather
// than a stale book response from some other named cache.
async function edition(browser){
  let status=null;
  await browser.event('message',{
    data:{type:'EDITION_STATUS'},
    ports:[{postMessage:value=>status=value}]
  });
  return status;
}
const beforeCleanup=await edition(a);
assert.equal(beforeCleanup.type,'EDITION_STATUS');
assert.equal(beforeCleanup.ready,true);
assert.equal(beforeCleanup.edition,current);
assert.equal(beforeCleanup.cached,beforeCleanup.required);
const statusPort={received:null,postMessage(value){this.received=value}};
await a.event('message',{
  data:{type:'SAVE_READER'},ports:[statusPort]
});
assert.equal(statusPort.received.ok,true);
assert.equal(statusPort.received.edition,current);
const shell=a.stores.get(current);
shell.entries.delete(normalize('./reader-ui.js'));
const incomplete=await edition(a);
assert.equal(incomplete.ready,false);
assert.equal(incomplete.cached,incomplete.required-1);
await a.event('message',{
  data:{type:'SAVE_READER'},ports:[statusPort]
});
assert.equal((await edition(a)).ready,true,'SAVE_READER must restore missing required assets');
await a.event('activate');
assert.equal(a.stats.claim,1);
assert.ok(!a.stores.has('11am-lit-reader-old-core'),'Old edition not cleared');
assert.ok(a.stores.has('11am-politics-reader-keep'),'Unrelated PWA cache should survive');
const page=await a.event('fetch',{request:{method:'GET',mode:'navigate',url:scope}});
assert.equal(await page.text(),'cached ./index.html');
assert.equal(a.stats.network,0,'Offline reading should not need the network');
assert.equal(await a.event('fetch',{request:{method:'GET',mode:'navigate',url:'https://mohdujjain.github.io/11am-hikam/'}}),null);
const broken=simulate(true);
await broken.caches.open('11am-lit-reader-old-core');
await assert.rejects(broken.event('install'));
assert.equal(broken.stats.skip,0,'Partial update should never activate');
assert.ok(broken.stores.has('11am-lit-reader-old-core'),'Old edition lost after failed install');

// Simulate two older book windows still alive during the new worker's
// activation. Their shell stays cached until a later single-client upgrade.
const multiTab=simulate(false,false,2);
await multiTab.caches.open('11am-lit-reader-old-core');
await multiTab.event('install');
await multiTab.event('activate');
assert.ok(multiTab.stores.has('11am-lit-reader-old-core'),
  'Do not evict a previous edition while multiple clients remain active');
assert.ok([...multiTab.stores.keys()].some(k=>
  k.startsWith('11am-lit-reader-')&&k!=='11am-lit-reader-old-core'));

// Proactive font preparation must only fetch permitted CDN URLs and preserve
// the independent font cache even when the offline book edition changes.
const css='https://fonts.googleapis.com/css2?family=Amiri';
const woff='https://fonts.gstatic.com/s/amiri/v1/amiri.woff2';
let reply=null;
const requestFonts=async (browser,urls) => {
  let response;
  await browser.event('message',{
    data:{type:'PREPARE_FONTS',urls},
    ports:[{postMessage:data=>{response=data;}}]
  });
  return response;
};
reply=await requestFonts(a,[
  css,woff,css,
  'http://fonts.gstatic.com/s/amiri/v1/font.woff2',
  'https://fonts.gstatic.com.evil.example/s/amiri/font.woff2',
  'https://untrusted.example/font.woff2',
  'https://fonts.gstatic.com/not-a-font/font.woff2'
]);
assert.equal(reply.type,'FONTS_PREPARED');
assert.equal(reply.requested,2,'Only unique allowlisted Google Fonts URLs are accepted');
assert.equal(reply.fontFiles,1);
assert.equal(reply.stored,2);
assert.equal(reply.failed,0);
const fonts=a.stores.get('11am-lit-fonts-v1');
assert.ok(fonts,'Separate font cache must exist');
assert.ok(fonts.entries.has(css));
assert.ok(fonts.entries.has(woff));
assert.ok(!fonts.entries.has('https://untrusted.example/font.woff2'));
const networkAfterFirstWarm=a.stats.network;
reply=await requestFonts(a,[css,woff]);
assert.equal(reply.stored,0,'Cached fonts should not be fetched again');
assert.equal(reply.reused,2);
assert.equal(a.stats.network,networkAfterFirstWarm);
const fontResponse=await a.event('fetch',{
  request:{method:'GET',mode:'cors',url:woff}
});
assert.equal(await fontResponse.text(),'font '+woff,'Offline font request uses cached bytes');
assert.equal(a.stats.network,networkAfterFirstWarm);
await a.event('activate');
assert.ok(a.stores.has('11am-lit-fonts-v1'),'Font cache must survive reactivation');

// An unavailable font CDN must not break the already saved offline book.
const fontOutage=simulate(false,true);
await fontOutage.event('install');
const failedFonts=await requestFonts(fontOutage,[css,woff]);
assert.equal(failedFonts.failed,2);
assert.equal(failedFonts.stored,0);
const savedDuringOutage=await fontOutage.event('fetch',{
  request:{method:'GET',mode:'navigate',url:scope}
});
assert.equal(await savedDuringOutage.text(),'cached ./index.html');

// Bound the proactive font list to a reasonable number of requests.
const many=Array.from({length:95},(_,i)=>'https://fonts.gstatic.com/s/amiri/v1/subset-'+i+'.woff2');
const cap=await requestFonts(a,many);
assert.equal(cap.requested,90);

console.log('PASS: PREPARE_FONTS allowlist, bounded warming, offline font reuse, version-independent cache, failure resilience');
console.log('PASS: offline reopening, complete shell, atomic updates, separate PWA scopes');
