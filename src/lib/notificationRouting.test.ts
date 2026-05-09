import { describe, expect, it } from 'vitest';
import { getNotificationUrl } from './notificationRouting';

describe('notificationRouting', () => {
  it('deep-links admin payment notifications to payment audit', () => {
    expect(getNotificationUrl({ type: 'payment_failed' })).toBe('/dashboard?tab=audit');
    expect(getNotificationUrl({ type: 'payment_incomplete' })).toBe('/dashboard?tab=audit');
    expect(getNotificationUrl({ type: 'payment_late' })).toBe('/dashboard?tab=audit');
    expect(getNotificationUrl({ type: 'rent_received' })).toBe('/dashboard?tab=audit');
  });

  it('deep-links admin operational notifications to their work areas', () => {
    expect(getNotificationUrl({ type: 'message_received' })).toBe('/dashboard?tab=messages');
    expect(getNotificationUrl({ type: 'application_received' })).toBe('/dashboard?tab=applications');
    expect(getNotificationUrl({ type: 'maintenance_request' })).toBe('/dashboard?tab=maintenance');
    expect(getNotificationUrl({ type: 'inquiry_received' })).toBe('/dashboard?tab=inquiries');
  });

  it('deep-links tenant payment notifications to tenant payments', () => {
    expect(getNotificationUrl({ type: 'payment_received' }, 'tenant')).toBe('/tenant?tab=payments');
    expect(getNotificationUrl({ type: 'message_received' }, 'tenant')).toBe('/tenant?tab=messages');
  });
});
