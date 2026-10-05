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

// Notifications Push & Interactions
self.addEventListener('push', (event) => {
  let data = {
    title: 'Poimén — Suivi Pastoral',
    body: 'Vous avez une notification importante.',
    url: '/dashboard/affectation'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/brand/icon-192.png',
    badge: data.badge || '/brand/icon-192.png',
    vibrate: [150, 50, 150],
    data: { url: data.url || '/dashboard/affectation' },
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir Poimén' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/affectation';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (targetUrl && client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

