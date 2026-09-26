// オフラインでも使えるように、アプリをキャッシュに保存する。
const CACHE = 'animejp-v15';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'audio.js', 'anki.js', 'grammar_ja.js', 'fflate.min.js', 'sql-wasm.js', 'sql-wasm.wasm', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // キャッシュがあればすぐにそれを使い（電波が弱くても一瞬で開く）、裏でネットから新しい版を取ってくる（次に開いたときに反映）
  const net = fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
  e.waitUntil(net.catch(() => { }));
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || net));
});
