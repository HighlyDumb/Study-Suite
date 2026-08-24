/* Study Suite — service worker.
   ============================================================
   IMPORTANT: bump CACHE_VERSION every time you ship a change to
   index.html (or any other cached file). This is what forces old
   cached copies to be thrown out on the next visit — without it, people
   who installed the app could get stuck on a stale version indefinitely,
   since a service worker's whole job is to serve cached files instead of
   hitting the network.
   ============================================================ */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'study-suite-' + CACHE_VERSION;

// The app shell: enough to open the app from a cold cache (e.g. offline,
// or right after install before the network has been hit once).
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle simple same-origin GETs. Everything else (Supabase API
  // calls, POST/PATCH requests, Google Fonts, the Supabase JS CDN script)
  // passes straight through to the network untouched — trying to cache
  // cross-origin or non-GET requests causes more problems than it solves
  // (opaque responses, stale auth-sensitive data, etc).
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML){
    // Network-first for the app itself: always try to get the latest
    // version when online (so updates show up immediately), and only
    // fall back to whatever's cached when the network fails.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest) that rarely change —
  // instant load, with a network fetch to fill/refresh the cache entry.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
