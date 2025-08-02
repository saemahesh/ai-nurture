// Enhanced Service Worker for aggressive cache management - NO CACHING FOR JS FILES
// This ensures all JavaScript files always load fresh from server

// Use dynamic cache name to force cache invalidation with timestamp
const CACHE_NAME = 'whatspro-app-v' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// Do NOT cache any JavaScript, HTML, or dynamic content - empty cache list
const urlsToCache = [
  // All dynamic files removed to prevent staleness - ALWAYS fetch fresh
];

// Install event - skip caching entirely and activate immediately
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing with AGGRESSIVE NO-CACHE policy for all JS files');
  // Skip waiting to activate immediately and clear old caches
  self.skipWaiting();
});

// Activate event - clear ALL old caches aggressively
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating and clearing ALL caches');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Delete ALL caches to prevent staleness
          console.log('Service Worker: Deleting cache', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - AGGRESSIVE NETWORK FIRST with enhanced cache headers for all JS files
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  
  // For ALL JavaScript files, controllers, services, modules, and HTML - ALWAYS use network first with aggressive headers
  if (url.includes('.js') || url.includes('/controllers/') || url.includes('/services/') || 
      url.includes('/modules/') || url.includes('/directives/') || url.includes('/filters/') ||
      url.includes('sidebar') || url.includes('.html') || url.includes('app.js')) {
    
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache', // Force fresh fetch
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      .then(function(response) {
        console.log('Service Worker: Fresh fetch for:', url);
        // DO NOT cache dynamic content - return response directly
        return response;
      })
      .catch(function(error) {
        console.error('Service Worker: Network failed for:', url, error);
        // For critical files, do not fall back to cache - let it fail to force refresh
        throw error;
      })
    );
  }
  // For other static resources (images, CSS), use normal fetch without caching
  else {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          return response;
        })
        .catch(function(error) {
          console.error('Service Worker: Failed to fetch static resource:', url, error);
          throw error;
        })
    );
  }
});

// Listen for messages from the main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'PING') {
    // Respond with pong to show service worker is alive
    self.clients.matchAll().then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({type: 'PONG', timestamp: Date.now()});
      });
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Service Worker: Clearing all caches...');
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('Service Worker: Deleting cache', cacheName);
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
