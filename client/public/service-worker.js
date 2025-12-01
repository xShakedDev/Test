// Service Worker - NO CACHING - Always fetch from network
// This ensures all data is always fresh and up-to-date
// Exception: offline.html is cached to show when there's no internet

const SW_VERSION = 'v1.0.0'; // Update this when you deploy changes
const OFFLINE_CACHE = 'offline-page-v1';
const OFFLINE_URL = '/offline.html';

// Install event - cache offline page and logo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => {
      console.log('Caching offline page and logo');
      return cache.addAll([OFFLINE_URL, '/logo.png']);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Fetch event - Network first, fallback to offline page for navigation requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle navigation requests (page loads) - show offline page if network fails
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Network request succeeded, return the response
          return response;
        })
        .catch(() => {
          // Network request failed, return offline page
          return caches.match(OFFLINE_URL);
        })
    );
  } 
  // Handle logo requests - try cache if network fails
  else if (url.pathname === '/logo.png') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          return caches.match('/logo.png');
        })
    );
  } 
  // For all other requests (API calls, other assets, etc.), always go to network - no caching
  else {
    event.respondWith(fetch(request));
  }
});

// Activate event - delete old caches but keep offline cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete all caches except the offline cache
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== OFFLINE_CACHE)
          .map((cacheName) => {
            console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

