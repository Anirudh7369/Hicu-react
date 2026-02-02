// Service Worker for Hicu Chat App
// Provides offline support and caching for PWA functionality

const CACHE_NAME = 'hicu-v9';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log(`🔧 SW: Installing new service worker (${CACHE_NAME})`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`✅ SW: Opened cache ${CACHE_NAME}`);
        return cache.addAll(urlsToCache).catch((error) => {
          console.warn('⚠️ SW: Cache addAll failed, continuing anyway', error);
        });
      })
      .then(() => {
        console.log(`✅ SW: Installation complete for ${CACHE_NAME}`);
      })
      // Don't skip waiting automatically - wait for user confirmation
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`🔄 SW: Activating ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('🗂️ SW: Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('👑 SW: Claiming clients...');
      return self.clients.claim();
    }).then(() => {
      console.log(`✅ SW: ${CACHE_NAME} activated and claimed all clients`);
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and chrome-extension requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip Firebase/Firestore requests - always go to network
  if (event.request.url.includes('firebasestorage.googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).then((fetchResponse) => {
          // Don't cache if not a success response
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response
          const responseToCache = fetchResponse.clone();

          // Cache the new response
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return fetchResponse;
        });
      })
      .catch(() => {
        // Return offline page if available
        return caches.match('/index.html');
      })
  );
});

// Listen for messages from the app (e.g., SKIP_WAITING)
self.addEventListener('message', (event) => {
  console.log('📨 SW: Received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ SW: SKIP_WAITING received, calling skipWaiting()...');
    self.skipWaiting().then(() => {
      console.log('✅ SW: skipWaiting() completed successfully');
      // Send acknowledgment back to client
      event.ports[0]?.postMessage({ type: 'SKIP_WAITING_ACK' });
    }).catch((error) => {
      console.error('❌ SW: skipWaiting() failed:', error);
    });
  }
});
