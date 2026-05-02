// BUILD_ID is replaced at build time by next.config.js; fallback to timestamp
// so cache busts automatically on every new deploy.
const CACHE_NAME = 'bhl-' + (self.__BUILD_ID__ || Date.now());
const STATIC_ASSETS = [
  '/dashboard',
  '/dashboard/driver',
  '/dashboard/warehouse',
  '/dashboard/pda-scanner',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Dev must never be served stale Next.js chunks by the PWA cache.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // Skip API calls — always go to network for fresh data
  if (request.url.includes('/v1/')) return;

  // Network-first for navigation (HTML pages) — ensures new deploy takes effect
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/dashboard')))
    );
    return;
  }

  // Cache-first for /_next/static (content-hashed filenames — safe to serve from cache)
  if (request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        });
      }).catch(() => caches.match('/dashboard'))
    );
    return;
  }

  // Default: network-first, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/dashboard')))
  );
});
