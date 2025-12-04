const SW_VERSION = 'v1.0.6';
const OFFLINE_CACHE = 'offline-page-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => {
      return cache.addAll([OFFLINE_URL, '/logo.png']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore API and external
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests — network first, fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets: try network, fallback cache
  if (/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});
