// Pass A offline semantics: check the network for an edition before saving,
// verify the exact active worker revision and never confuse "saved" with "latest".
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('/* App install and explicit offline-copy verification;');
const end=html.indexOf('</script>',start);
assert.ok(start>0&&end>start);
const script=html.slice(start,end);

function element(){
  const listeners={};
  return {listeners,hidden:true,disabled:false,textContent:'',
    addEventListener(name,fn){listeners[name]=fn;},
    async click(){return listeners.click?.({preventDefault(){}});}
  };
}
function runScenario({online=true,updateFails=false,changeEdition=false}={}){
  const events=[],status=element(),save=element(),install=element(),notice=element();
  notice.hidden=true;
  let edition='reader-revision-one';
  const active={
    postMessage(data,ports){
      events.push(data.type);
      let reply;
      if(data.type==='EDITION_STATUS'){
        reply={type:'EDITION_STATUS',edition,ready:true,cached:12,required:12};
      }else if(data.type==='SAVE_READER'){
        reply={ok:true,edition};
      }else{
        throw Error('Unexpected message '+data.type);
      }
      Promise.resolve().then(()=>ports[0].postMessage(reply));
    }
  };
  const reg={
    active,scope:'https://mohdujjain.github.io/11am-literature/',
    installing:null,waiting:null,
    async update(){
      events.push('UPDATE_NETWORK');
      if(updateFails)throw Error('Simulated network outage');
      if(changeEdition)edition='reader-revision-two';
    }
  };
  const nav={onLine:online,serviceWorker:{
    register:async()=>reg,ready:Promise.resolve(reg),
    getRegistration:async()=>reg
  },storage:{persist:async()=>true}};
  const doc={readyState:'complete',fonts:null,
    querySelector:()=>null,
    getElementById:id=>id==='pwa-status'?status:
      id==='pwa-save'?save:id==='pwa-install'?install:
      id==='edition-notice'?notice:null,
    addEventListener(){}};
  const win={addEventListener(){},caches:null};
  class Channel{
    constructor(){
      this.port1={onmessage:null,close(){}};
      this.port2={postMessage:data=>{
        Promise.resolve().then(()=>this.port1.onmessage?.({data}));
      }};
    }
  }
  // readFrame runs in this exact script scope, allowing a fully stubbed PWA
  // without relying on a host browser, external fonts, or network.
  new Function('document','navigator','location','window','MessageChannel',
    'performance','caches',script)(
    doc,nav,{protocol:'https:',hostname:'mohdujjain.github.io'},
    win,Channel,{getEntriesByType:()=>[]},{}
  );
  return {events,status,save,reg};
}
async function flushed(){
  for(let i=0;i<12;i++)await Promise.resolve();
}
{
  const app=runScenario({online:true,changeEdition:true});
  await flushed();
  await app.save.click();
  assert.ok(app.events.includes('UPDATE_NETWORK'));
  assert.ok(app.events.includes('SAVE_READER'));
  assert.ok(app.events.indexOf('UPDATE_NETWORK') <
            app.events.indexOf('SAVE_READER'),
            'Network update check must precede confirmation of offline save');
  assert.match(app.status.textContent,/New edition saved/);
  assert.match(app.status.textContent,/Reload updated guide/);
  assert.equal(app.save.disabled,false);
}
{
  const app=runScenario({online:true,updateFails:true});
  await flushed();
  await app.save.click();
  assert.ok(app.events.includes('SAVE_READER'));
  assert.match(app.status.textContent,/update check could not finish/i);
  assert.ok(!app.status.textContent.includes('No newer edition detected'),
    'Failed update check must never masquerade as the latest edition');
  assert.equal(app.save.disabled,false);
}
{
  const app=runScenario({online:false});
  await flushed();
  await app.save.click();
  assert.ok(!app.events.includes('UPDATE_NETWORK'),
    'Offline button should verify the existing copy without network attempts');
  assert.ok(app.events.includes('SAVE_READER'));
  assert.match(app.status.textContent,/requires an internet connection/);
  assert.equal(app.save.disabled,false);
}
{
  const app=runScenario({online:true});
  await flushed();
  await app.save.click();
  assert.match(app.status.textContent,/No newer edition detected during this check/);
  assert.equal(app.save.disabled,false);
}
console.log('PASS: update-before-save ordering, active edition verification, offline and failed-check status semantics');
