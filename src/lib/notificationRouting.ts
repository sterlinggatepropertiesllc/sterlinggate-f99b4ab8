export type AppNotificationType =
  | 'application_received'
  | 'application_approved'
  | 'application_rejected'
  | 'rent_received'
  | 'payment_received'
  | 'payment_processing'
  | 'payment_failed'
  | 'payment_incomplete'
  | 'payment_late'
  | 'payment_missing'
  | 'maintenance_request'
  | 'lease_signed'
  | 'message_received'
  | 'inquiry_received';

export interface NotificationRouteInput {
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function getNotificationUrl(notification: NotificationRouteInput, portal: 'admin' | 'tenant' = 'admin') {
  const type = notification.type || '';

  if (portal === 'tenant') {
    if (type.startsWith('payment_') || type === 'rent_received') return '/tenant?tab=payments';
    if (type === 'message_received') return '/tenant?tab=messages';
    if (type === 'lease_signed') return '/tenant?tab=lease';
    return '/tenant';
  }

  if (type.startsWith('payment_') || type === 'rent_received') return '/dashboard?tab=audit';
  if (type.startsWith('application_')) return '/dashboard?tab=applications';
  if (type === 'maintenance_request') return '/dashboard?tab=maintenance';
  if (type === 'message_received') return '/dashboard?tab=messages';
  if (type === 'lease_signed') return '/dashboard?tab=leases';
  if (type === 'inquiry_received') return '/dashboard?tab=inquiries';

  return '/dashboard';
}
