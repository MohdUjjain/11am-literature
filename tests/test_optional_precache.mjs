/* Batch 1 regression — an unavailable optional asset must never invalidate
 * an otherwise complete offline reader. The core document must remain atomic.
 * Run before applying the worker change to reproduce the original failure.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const worker=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const scope='https://mohdujjain.github.io/11am-literature/';
function harness(failure){
  const handlers=new Map(),stores=new Map(),attempted=[];
  let skip=0,claimed=0;
  const key=x=>new URL(typeof x==='string'?x:x.url,scope).href;
  class Cache{
    constructor(){this.items=new Map();}
    async addAll(paths){
      for(const path of paths){
        attempted.push(path);
        if(failure==='optional' && /\/og-image\.(?:png|jpg)$/.test(key(path)))
          throw Error('optional social preview unavailable');
        if(failure==='core' && /\/index\.html$/.test(key(path)))
          throw Error('required reader unavailable');
        this.items.set(key(path),new Response('saved '+path));
      }
    }
    async match(req){return this.items.get(key(req))?.clone();}
    async put(req,res){this.items.set(key(req),res.clone());}
  }
  const caches={
    async open(name){if(!stores.has(name))stores.set(name,new Cache());return stores.get(name);},
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);},
    async match(req){for(const c of stores.values()){const r=await c.match(req);if(r)return r;}}
  };
  const self={
    registration:{scope},location:{origin:new URL(scope).origin},
    addEventListener:(type,fn)=>handlers.set(type,fn),
    skipWaiting:async()=>{skip++;},
    clients:{claim:async()=>{claimed++;},matchAll:async()=>[]}
  };
  vm.runInNewContext(worker,{self,caches,URL,Response,Request,Promise,Set,
    fetch:async request=>new Response('fetched '+key(request))},{filename:'service-worker.js'});
  async function dispatch(type,extra={}){
    const pending=[];
    let response;
    handlers.get(type)({...extra,waitUntil:p=>pending.push(Promise.resolve(p)),
      respondWith:p=>{response=Promise.resolve(p);}});
    await Promise.all(pending);
    return response?response:undefined;
  }
  return {stores,caches,attempted,dispatch,stats:()=>({skip,claimed})};
}

const optional=harness('optional');
await optional.caches.open('11am-lit-reader-previous');
await optional.dispatch('install');
assert.equal(optional.stats().skip,1,'missing social preview must not block activation');
const current=[...optional.stores.keys()].find(k=>k.startsWith('11am-lit-reader-')&&k!=='11am-lit-reader-previous');
assert.ok(current,'new edition cache expected');
assert.ok(await optional.stores.get(current).match('./index.html'),'complete book remains cached');
assert.equal(await optional.stores.get(current).match('./og-image.png'),undefined,
  'failed optional asset is not required for offline reading');
await optional.dispatch('activate');
assert.equal(optional.stats().claimed,1,'new reader takes control after core is complete');

const broken=harness('core');
await broken.caches.open('11am-lit-reader-previous');
await assert.rejects(broken.dispatch('install'),/required reader unavailable/);
assert.equal(broken.stats().skip,0,'missing core document must prevent activation');
assert.ok(broken.stores.has('11am-lit-reader-previous'),'failed upgrade preserves previous edition');

const normal=harness(null);
await normal.dispatch('install');
assert.equal(normal.stats().skip,1);
assert.ok(normal.attempted.some(p=>/og-image\.(?:png|jpg)$/.test(p)),
  'supplemental assets are still offered best-effort caching');
console.log('PASS: required cache remains atomic; optional asset failure is nonfatal');
