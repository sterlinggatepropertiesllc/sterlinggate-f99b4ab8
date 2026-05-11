import { describe, expect, it } from 'vitest';
import { getNotificationUrl } from './notificationRouting';

describe('notificationRouting', () => {
  it('deep-links received admin payment notifications to payment audit', () => {
    expect(getNotificationUrl({ type: 'payment_received' })).toBe('/dashboard?tab=audit');
    expect(getNotificationUrl({ type: 'rent_received' })).toBe('/dashboard?tab=audit');
  });

  it('deep-links admin payment attention notifications with tenant metadata to the tenant ledger', () => {
    expect(getNotificationUrl({ type: 'payment_failed', metadata: { tenant_id: 'tenant-123' } })).toBe(
      '/dashboard/tenant/tenant-123?tab=balance'
    );
    expect(getNotificationUrl({ type: 'payment_incomplete', metadata: { tenantId: 'tenant-456' } })).toBe(
      '/dashboard/tenant/tenant-456?tab=balance'
    );
    expect(getNotificationUrl({ type: 'payment_missing', metadata: { tenant_id: 'tenant with space' } })).toBe(
      '/dashboard/tenant/tenant%20with%20space?tab=balance'
    );
    expect(getNotificationUrl({ type: 'payment_late', metadata: { tenantId: 42 } })).toBe(
      '/dashboard/tenant/42?tab=balance'
    );
  });

  it('deep-links admin payment attention notifications without tenant metadata to audit filters', () => {
    expect(getNotificationUrl({ type: 'payment_failed' })).toBe('/dashboard?tab=audit&filter=failed');
    expect(getNotificationUrl({ type: 'payment_incomplete' })).toBe('/dashboard?tab=audit&filter=needs-review');
    expect(getNotificationUrl({ type: 'payment_missing' })).toBe('/dashboard?tab=audit&filter=needs-review');
    expect(getNotificationUrl({ type: 'payment_late' })).toBe('/dashboard?tab=audit&filter=needs-review');
  });

  it('deep-links admin processing payment notifications to audit processing', () => {
    expect(getNotificationUrl({ type: 'payment_processing' })).toBe('/dashboard?tab=audit&filter=processing-ach');
  });

  it('deep-links admin operational notifications to their work areas', () => {
    expect(getNotificationUrl({ type: 'message_received' })).toBe('/dashboard?tab=messages');
    expect(getNotificationUrl({ type: 'application_received' })).toBe('/dashboard?tab=applications');
    expect(getNotificationUrl({ type: 'application_approved' })).toBe('/dashboard?tab=applications');
    expect(getNotificationUrl({ type: 'maintenance_request' })).toBe('/dashboard?tab=maintenance');
    expect(getNotificationUrl({ type: 'inquiry_received' })).toBe('/dashboard?tab=inquiries');
  });

  it('deep-links tenant payment notifications to tenant payments', () => {
    expect(getNotificationUrl({ type: 'payment_received' }, 'tenant')).toBe('/tenant?tab=payments');
    expect(getNotificationUrl({ type: 'payment_failed', metadata: { tenant_id: 'tenant-123' } }, 'tenant')).toBe('/tenant?tab=payments');
    expect(getNotificationUrl({ type: 'message_received' }, 'tenant')).toBe('/tenant?tab=messages');
    expect(getNotificationUrl({ type: 'lease_signed' }, 'tenant')).toBe('/tenant?tab=lease');
  });
});
