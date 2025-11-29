// Service Worker - NO CACHING - Always fetch from network
// This ensures all data is always fresh and up-to-date

// Install event - no caching, just activate immediately
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Fetch event - NEVER cache anything, always go to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // For all requests, always fetch from network - no caching at all
  event.respondWith(fetch(request));
});

// Activate event - delete ALL existing caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete ALL caches
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

