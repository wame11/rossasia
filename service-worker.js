/* Asia 2026 — service worker.
   Rules that keep a stale copy from ever sticking:
   1. Navigations ALWAYS go to the network with cache:'no-store', so you can
      never be served yesterday's index.html while you are online.
   2. version.json is never cached — it is how the app spots a new build.
   3. An asset that fails NEVER falls back to index.html. Serving HTML in place
      of app.js is what silently breaks the whole app. */
const BUILD = '2026-09-22-1';
const CACHE_NAME = 'asia2026-' + BUILD;
const ASSETS = ['./','./index.html','./styles.css','./app.js','./stops.js','./icon-180.png','./icon-192.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== location.origin) return;            // leave YouTube, iTunes, Apps Script alone
  if (url.pathname.endsWith('version.json')) return;      // always straight to the network

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-store', credentials: 'same-origin' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
