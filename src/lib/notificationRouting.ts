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

const PAYMENT_RECEIVED_TYPES = new Set(['payment_received', 'rent_received']);
const PAYMENT_ATTENTION_FILTERS: Record<string, 'failed' | 'needs-review'> = {
  payment_failed: 'failed',
  payment_incomplete: 'needs-review',
  payment_missing: 'needs-review',
  payment_late: 'needs-review',
};

function getTenantId(metadata?: Record<string, unknown> | null) {
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

export function getNotificationUrl(notification: NotificationRouteInput, portal: 'admin' | 'tenant' = 'admin') {
  const type = notification.type || '';

  if (portal === 'tenant') {
    if (type.startsWith('payment_') || type === 'rent_received') return '/tenant?tab=payments';
    if (type === 'message_received') return '/tenant?tab=messages';
    if (type === 'lease_signed') return '/tenant?tab=lease';
    return '/tenant';
  }

  if (PAYMENT_RECEIVED_TYPES.has(type)) return '/dashboard?tab=audit';

  if (type === 'payment_processing') return '/dashboard?tab=audit&filter=processing-ach';

  if (type in PAYMENT_ATTENTION_FILTERS) {
    const tenantId = getTenantId(notification.metadata);

    if (tenantId) {
      return `/dashboard/tenant/${encodeURIComponent(tenantId)}?tab=balance`;
    }

    return `/dashboard?tab=audit&filter=${PAYMENT_ATTENTION_FILTERS[type]}`;
  }

  if (type.startsWith('application_')) return '/dashboard?tab=applications';
  if (type === 'maintenance_request') return '/dashboard?tab=maintenance';
  if (type === 'message_received') return '/dashboard?tab=messages';
  if (type === 'lease_signed') return '/dashboard?tab=leases';
  if (type === 'inquiry_received') return '/dashboard?tab=inquiries';

  return '/dashboard';
}
