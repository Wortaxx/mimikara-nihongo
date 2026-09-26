// オフラインでも使えるように、アプリをキャッシュに保存する。
const CACHE = 'animejp-v6';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'audio.js', 'anki.js', 'grammar_ja.js', 'fflate.min.js', 'sql-wasm.js', 'sql-wasm.wasm', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // まずネットから（更新を受け取るため）、つながらなければキャッシュから
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
