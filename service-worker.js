/* 11AM Literature — scoped, versioned offline reader for GitHub Pages.
   All 22 published readings are embedded in one HTML file. A PDF is NOT pre-cached.
   Browser storage may still be evicted; persistent storage is requested on explicit user action. */
const VERSION = '11am-lit-reader-01-23-v2';
const CORE_CACHE = VERSION + '-core';
const FONT_CACHE = VERSION + '-fonts';
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL('./index.html', SCOPE).href;
const CORE_FILES = [INDEX, new URL('./manifest.webmanifest', SCOPE).href,
  new URL('./icons/icon-192.png', SCOPE).href, new URL('./icons/icon-512.png', SCOPE).href];
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap';

async function cacheCore() {
  const cache = await caches.open(CORE_CACHE);
  await cache.addAll(CORE_FILES);
}

async function warmFonts() {
  // Font downloads are optional; the complete text remains available without them.
  const cache = await caches.open(FONT_CACHE);
  const css = await fetch(FONT_CSS_URL, {mode:'cors'});
  if (!css.ok) return;
  await cache.put(FONT_CSS_URL, css.clone());
  const text = await css.text();
  const urls = [...new Set([...text.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(x => x[1]))];
  // Only Google-hosted font assets referenced by the existing stylesheet.
  await Promise.allSettled(urls.slice(0, 80).map(url => fetch(url,{mode:'cors'}).then(async res => {
    if (res.ok) await cache.put(url, res);
  })));
}
self.addEventListener('install', event => {
  event.waitUntil(cacheCore().then(async () => {
    // Font cache is a bonus, never a requirement for installing the core offline app.
    await Promise.race([warmFonts().catch(() => {}), new Promise(resolve => setTimeout(resolve, 7500))]);
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('11am-lit-reader-') && ![CORE_CACHE,FONT_CACHE].includes(name)).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SAVE_READER') return;
  const port = event.ports && event.ports[0];
  event.waitUntil(cacheCore().then(() => {if(port)port.postMessage({ok:true});})
    .catch(e => {if(port)port.postMessage({ok:false,error:String(e)});}));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFontHost = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (isFontHost) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') {
          event.waitUntil(cache.put(req, res.clone()).catch(() => {}));
        } return res;
      } catch (_) { return cached || Response.error(); }
    })());
    return;
  }
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname.toLowerCase().endsWith('.pdf')) return; // PDF is opt-in download only.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await Promise.race([
          fetch(req),
          new Promise((_, reject) => setTimeout(() => reject(Error('network timeout')), 4500))
        ]);
        if (response.ok) event.waitUntil(caches.open(CORE_CACHE).then(c => c.put(INDEX, response.clone())).catch(() => {}));
        return response;
      } catch (_) {
        return (await caches.match(INDEX)) || Response.error();
      }
    })());
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => {
    if (response.ok) event.waitUntil(caches.open(CORE_CACHE).then(cache=>cache.put(req,response.clone())).catch(()=>{}));
    return response;
  })));
});
