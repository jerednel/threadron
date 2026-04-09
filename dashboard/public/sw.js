// Threadron Service Worker — enables PWA install
const CACHE = 'threadron-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Network-first strategy — always try network, fall back to cache
self.addEventListener('fetch', (e) => {
  // Don't cache API calls
  if (e.request.url.includes('/v1/')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
