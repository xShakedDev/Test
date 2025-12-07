const SW_VERSION = 'v1.1.0';
const CACHE_NAME = 'app-cache-v1';
const OFFLINE_URL = '/offline.html';

function networkWithTimeout(request, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    fetch(request)
      .then(response => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, '/logo.png'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Let external (including Leaflet tiles) handle normally
  if (url.origin !== self.location.origin) return;

  // API should always go fresh
  if (url.pathname.startsWith('/api/')) return;

  // Navigation - network first with timeout
  if (request.mode === 'navigate') {
    event.respondWith(
      networkWithTimeout(request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets - network first, fallback cached
  if (/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      networkWithTimeout(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});
