// Simple Service Worker for cache management
const CACHE_NAME = 'whatspro-app-v1.0.1'; // Static version - update when deploying
const urlsToCache = [
  '/',
  '/app.js',
  '/controllers/sidebar.controller.js',
  '/controllers/auth.controller.js',
  '/services/auth.service.js',
  '/services/api.service.js'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing with cache', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating and cleaning old caches');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Claim all clients to start controlling them immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', function(event) {
  // For HTML, JS, CSS files, always try network first (cache-last strategy)
  if (event.request.url.match(/\.(html|js|css)$/)) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // If network is available, update cache and return response
          if (response.status === 200) {
            let responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseClone);
              });
          }
          return response;
        })
        .catch(function() {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // For other resources, use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          return response || fetch(event.request);
        })
    );
  }
});

// Listen for messages from the main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Notify main thread that cache is cleared
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({type: 'CACHE_CLEARED'});
        });
      });
    });
  }
});
