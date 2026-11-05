import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const code=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const scope='https://mohdujjain.github.io/11am-literature/';
const normalize=v=>new URL(typeof v==='string'?v:v.url,scope).href;

function simulate(fail=false){
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
    clients:{claim:async()=>{stats.claim++}},
    addEventListener:(name,fn)=>{listeners[name]=fn}
  };
  runInContext(code,createContext({
    self,caches,URL,Promise,Set,Response,
    fetch:async()=>{stats.network++;throw Error('No network')}
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
console.log('PASS: offline reopening, complete shell, atomic updates, separate PWA scopes');
