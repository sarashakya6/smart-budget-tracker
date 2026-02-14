
/// <reference lib="webworker" />

const CACHE_NAME = 'smartbudget-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

const sw = self as unknown as ServiceWorkerGlobalScope;

// Install event: Cache core assets immediately
sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  sw.skipWaiting();
});

// Activate event: Clean up old caches
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  sw.clients.claim();
});

// Fetch event: Stale-while-revalidate strategy
sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORE: Non-GET requests (POST/PUT/DELETE)
  if (event.request.method !== 'GET') return;

  // 2. IGNORE: API calls (Supabase, Google AI) to ensure fresh data
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('generativelanguage.googleapis.com')) {
    return;
  }

  // 3. CACHE: Assets, CDN libs, and App Shell
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache valid responses. 
        // We allow type 'basic' (local) AND 'cors' (external CDNs like aistudiocdn/esm.sh)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });

      // If cached response exists, return it immediately.
      // We attach a catch to fetchPromise to avoid unhandled rejections for the background request.
      if (cachedResponse) {
        fetchPromise.catch(() => { /* mute background errors */ });
        return cachedResponse;
      }

      // If no cache, return the fetch promise directly.
      // If this fails (e.g. offline), it will throw, which is correct behavior (network error).
      return fetchPromise;
    })
  );
});
