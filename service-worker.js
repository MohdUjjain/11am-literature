/* Bootstrap worker. The committed publication workflow replaces this file with a
 * content-hashed worker generated from scripts/service-worker.template.js. */
const CACHE_PREFIX = '11am-lit-reader-';
const BOOK_CACHE = CACHE_PREFIX + 'bootstrap-publication';
const FONT_CACHE = '11am-lit-fonts-v1';
const APP_SHELL = ['./index.html','./manifest.webmanifest','./offline-update.js',
  './icons/icon-192.png','./icons/icon-512.png','./og-image.png','./404.html','./sitemap.xml'];
const SCOPE = new URL(self.registration.scope);
const BOOK_URL = new URL('./index.html', SCOPE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  await (await caches.open(BOOK_CACHE)).addAll(APP_SHELL); await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==BOOK_CACHE).map(n=>caches.delete(n)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type!=='SAVE_READER')return;
  const port=event.ports?.[0];
  event.waitUntil((async()=>{try{
    await (await caches.open(BOOK_CACHE)).addAll(APP_SHELL);port?.postMessage({ok:true});
  }catch(e){port?.postMessage({ok:false,error:String(e)})}})());
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname)||url.pathname.endsWith('.pdf'))return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const saved=await (await caches.open(BOOK_CACHE)).match(BOOK_URL);
      if(saved)return saved;
      try{return await fetch(req)}catch{return Response.error()}
    })());
    return;
  }
  event.respondWith((async()=>{
    const stored=await caches.match(req);
    return stored||fetch(req);
  })());
});
