const CACHE_NAME = 'sterling-gate-pwa-v3';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/maskable-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
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

const PAYMENT_ATTENTION_FILTERS = {
  payment_failed: 'failed',
  payment_incomplete: 'needs-review',
  payment_missing: 'needs-review',
  payment_late: 'needs-review',
};

function getTenantId(metadata) {
  const rawTenantId = metadata?.tenant_id ?? metadata?.tenantId;

  if (typeof rawTenantId === 'string') {
    const tenantId = rawTenantId.trim();
    return tenantId.length > 0 ? tenantId : null;
  }

  if (typeof rawTenantId === 'number' && Number.isFinite(rawTenantId)) {
    return String(rawTenantId);
  }

  return null;
}

function getNotificationUrl(type, metadata, portal = 'admin') {
  const notificationType = String(type || '');

  if (portal === 'tenant') {
    if (notificationType.startsWith('payment_') || notificationType === 'rent_received') return '/tenant?tab=payments';
    if (notificationType === 'message_received') return '/tenant?tab=messages';
    if (notificationType === 'lease_signed') return '/tenant?tab=lease';
    return '/tenant';
  }

  if (notificationType === 'payment_received' || notificationType === 'rent_received') return '/dashboard?tab=audit';

  if (notificationType === 'payment_processing') return '/dashboard?tab=audit&filter=processing-ach';

  if (notificationType in PAYMENT_ATTENTION_FILTERS) {
    const tenantId = getTenantId(metadata);

    if (tenantId) {
      return `/dashboard/tenant/${encodeURIComponent(tenantId)}?tab=balance`;
    }

    return `/dashboard?tab=audit&filter=${PAYMENT_ATTENTION_FILTERS[notificationType]}`;
  }

  if (notificationType.startsWith('application_')) return '/dashboard?tab=applications';
  if (notificationType === 'maintenance_request') return '/dashboard?tab=maintenance';
  if (notificationType === 'message_received') return '/dashboard?tab=messages';
  if (notificationType === 'lease_signed') return '/dashboard?tab=leases';
  if (notificationType === 'inquiry_received') return '/dashboard?tab=inquiries';
  return '/dashboard';
}

function inferNotificationPortal(payload) {
  const metadata = payload.metadata || {};
  const explicitUrl = typeof payload.url === 'string' ? payload.url : '';

  if (explicitUrl.startsWith('/tenant')) return 'tenant';
  if (payload.portal === 'tenant' || payload.recipient_role === 'tenant') return 'tenant';
  if (metadata.portal === 'tenant' || metadata.recipient_role === 'tenant' || metadata.role === 'tenant') return 'tenant';

  return 'admin';
}

function resolveNotificationUrl(payload) {
  const explicitUrl = typeof payload.url === 'string' && payload.url.length > 0 ? payload.url : null;

  if (!payload.type) {
    return explicitUrl || '/dashboard';
  }

  const portal = inferNotificationPortal(payload);

  if (portal === 'tenant' && explicitUrl?.startsWith('/tenant')) {
    return explicitUrl;
  }

  return getNotificationUrl(payload.type, payload.metadata || {}, portal);
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
      url: resolveNotificationUrl(payload),
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
