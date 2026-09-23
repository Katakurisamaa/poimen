// Cache branding only: application code must match the current Next.js build.
const CACHE_NAME = 'poimen-v2';
const PRECACHE_ASSETS = [
  '/brand/icon-192.png', '/brand/icon-512.png', '/brand/poimen-symbol.svg',
  '/brand/poimen-dark.svg', '/brand/poimen-light.svg', '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
    } catch (err) {
      console.warn('[PWA-SW] Pré-cache partiel ignoré:', err);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('poimen-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !PRECACHE_ASSETS.includes(url.pathname) || request.mode === 'navigate') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
