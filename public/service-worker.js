const CACHE_NAME = 'sterling-gate-pwa-v1';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/manifest.webmanifest',
  '/favicon.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

function normalizeNotificationPayload(event) {
  if (!event.data) {
    return {
      title: 'Sterling Gate Properties',
      body: 'You have a new portfolio notification.',
      url: '/dashboard',
    };
  }

  try {
    return event.data.json();
  } catch (_error) {
    return {
      title: 'Sterling Gate Properties',
      body: event.data.text(),
      url: '/dashboard',
    };
  }
}

self.addEventListener('push', (event) => {
  const payload = normalizeNotificationPayload(event);
  const title = payload.title || 'Sterling Gate Properties';
  const options = {
    body: payload.body || payload.message || 'You have a new notification.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || payload.notification_id || 'sterling-gate-notification',
    renotify: Boolean(payload.renotify),
    data: {
      url: payload.url || '/dashboard',
      notification_id: payload.notification_id || null,
      type: payload.type || null,
      metadata: payload.metadata || {},
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
