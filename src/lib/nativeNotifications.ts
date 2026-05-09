import { registerSterlingServiceWorker } from '@/registerServiceWorker';

export interface AppNotificationPayload {
  id?: string;
  type?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
}

function getNotificationUrl(notification: AppNotificationPayload) {
  if (notification.type === 'rent_received') return '/dashboard?tab=audit';
  if (notification.type === 'application_received') return '/dashboard?tab=applications';
  if (notification.type === 'maintenance_request') return '/dashboard?tab=maintenance';
  if (notification.type === 'message_received') return '/dashboard?tab=messages';
  if (notification.type === 'lease_signed') return '/dashboard?tab=leases';
  return '/dashboard';
}

export async function showNativeAppNotification(notification: AppNotificationPayload) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready.catch(() => registerSterlingServiceWorker());
  if (!registration) return false;

  await registration.showNotification(notification.title, {
    body: notification.message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: notification.id || `sterling-${notification.type || 'notification'}`,
    data: {
      url: getNotificationUrl(notification),
      notification_id: notification.id,
      type: notification.type,
      metadata: notification.metadata || {},
    },
  });

  return true;
}

export function getPwaDisplayMode() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) return 'standalone';
  return 'browser';
}

export function isIosLikeDevice() {
  const nav = window.navigator as Navigator & { maxTouchPoints?: number };
  return /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
}
