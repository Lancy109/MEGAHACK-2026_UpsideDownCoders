const CACHE_NAME = 'resqnet-v2';
const ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background sync for SOS alerts
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sos') {
    // Note: The logic is handled by useSyncEngine hook in the foreground,
    // but the SW registration keeps the browser alert to opportunities.
    console.log('[SW] Background sync triggered');
  }
});
