const CACHE_NAME = 'bhl-v1';
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

  // Skip API calls — let offline sync handle them
  if (request.url.includes('/api/')) return;

  // Network-first for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/dashboard')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)).catch(() => caches.match('/dashboard'))
  );
});
