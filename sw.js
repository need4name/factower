// ── sw.js ─────────────────────────────────────────────────────────────────────
// Lets Factower run offline once it has been opened online. Network first:
// when there's a connection the newest version is always fetched (and the
// cached copy refreshed), so updates arrive as usual; with no connection the
// last cached copy is used.

const CACHE = 'factower-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url)) return;
  e.respondWith(
    fetch(req).then(res => {
      // Keep a copy of everything the game loads (its scripts, fonts, Phaser)
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
