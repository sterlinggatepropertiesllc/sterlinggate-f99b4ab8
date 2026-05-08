import { describe, expect, it } from 'vitest';
import { getPaymentStatusDisplay, isIncompleteStripePayment } from './paymentDisplay';

describe('paymentDisplay', () => {
  it('labels Stripe requires_payment_method as incomplete, not failed', () => {
    const payment = {
      status: 'failed',
      stripe_status: 'requires_payment_method',
      notes: 'Stripe status: requires_payment_method',
    };

    expect(isIncompleteStripePayment(payment)).toBe(true);
    expect(getPaymentStatusDisplay(payment)).toMatchObject({
      label: 'Incomplete',
      description: 'Never completed in Stripe; no money moved',
    });
  });

  it('keeps true failed payments distinct from incomplete payment intents', () => {
    expect(getPaymentStatusDisplay({ status: 'failed', stripe_status: 'payment_failed' })).toMatchObject({
      label: 'Failed',
    });
  });
});
