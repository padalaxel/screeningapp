// Service Worker for Screening Notes
// Use timestamp for aggressive cache busting during development
const CACHE_VERSION = Date.now().toString();
const CACHE_NAME = `screening-notes-${CACHE_VERSION}`;

// Assets to cache (relative to service worker location)
// For GitHub Pages, these will be resolved relative to the service worker's location
const ASSETS_TO_CACHE = [
    './index.html',
    './styles.css',
    './app.js',
    './manifest.webmanifest'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.log('Cache addAll failed:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete all old screening-notes caches
                    if (cacheName.startsWith('screening-notes-') && cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control immediately
    return self.clients.claim();
});

// Fetch event - network first for ALL requests to prevent stale cache
self.addEventListener('fetch', (event) => {
    // Network-first strategy for all requests to ensure fresh content during development
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Only cache successful responses for offline use
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache only if network fails (offline mode)
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // For navigation requests, fallback to index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
