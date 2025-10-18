const CACHE_NAME = 'trading-journal-cache-v1';
const urlsToCache = [
  '/trading-journal/',
  '/trading-journal/index.html',
  '/trading-journal/styles.css',
  '/trading-journal/manifest.json',
  '/trading-journal/icon-192.png',
  '/trading-journal/icon-512.png',
  '/trading-journal/js/main.js',
  '/trading-journal/js/data.js',
  '/trading-journal/js/storage.js',
  '/trading-journal/js/api.js',
  '/trading-journal/js/charts.js',
  '/trading-journal/js/ui.js',
  '/trading-journal/js/alerts.js',
  '/trading-journal/offline.html'
];

// Install event: Cache assets with validation
self.addEventListener('install', event => {
  console.log('Service Worker installing, caching assets for:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened:', CACHE_NAME);
        // Validate each URL before caching
        return Promise.all(
          urlsToCache.map(url =>
            fetch(url, { method: 'HEAD' })
              .then(response => {
                if (!response.ok) {
                  console.warn(`Skipping cache for ${url}: Resource not found or inaccessible`);
                  return null; // Skip invalid URLs
                }
                return cache.add(url);
              })
              .catch(err => {
                console.warn(`Failed to fetch ${url}:`, err);
                return null; // Skip failed fetches
              })
          )
        ).then(() => console.log('Caching completed'));
      })
      .catch(err => {
        console.error('Install event failed:', err);
        throw err; // Rethrow to mark Service Worker as failed
      })
  );
  self.skipWaiting(); // Activate new Service Worker immediately
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        )
      )
      .then(() => {
        console.log('Old caches cleared, active cache:', CACHE_NAME);
        return self.clients.claim();
      })
      .catch(err => {
        console.error('Activate event failed:', err);
      })
  );
});

// Fetch event: Cache-first with offline fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }
        return fetch(event.request)
          .then(networkResponse => {
            console.log('Serving from network:', event.request.url);
            return networkResponse;
          })
          .catch(() => {
            console.log('Network fetch failed, serving offline page:', event.request.url);
            return caches.match('/trading-journal/offline.html');
          });
      })
      .catch(err => {
        console.error('Fetch event failed:', err);
        return caches.match('/trading-journal/offline.html');
      })
  );
});
