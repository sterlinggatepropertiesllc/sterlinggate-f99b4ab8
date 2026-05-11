export interface PaymentDisplayInput {
  status?: string | null;
  stripe_status?: string | null;
  notes?: string | null;
}

export type PaymentDisplayTone = 'success' | 'warning' | 'destructive' | 'muted';

export function getExactStripeStatus(payment: PaymentDisplayInput) {
  const explicitStatus = payment.stripe_status?.trim();
  if (explicitStatus) return explicitStatus;

  const notes = payment.notes || '';
  if (/requires_payment_method/i.test(notes)) return 'requires_payment_method';
  if (/stripe status(?: was)?:\s*canceled/i.test(notes)) return 'canceled';
  if (/stripe status(?: was)?:\s*succeeded/i.test(notes)) return 'succeeded';

  return payment.status || null;
}

export function isIncompleteStripePayment(payment: PaymentDisplayInput) {
  return getExactStripeStatus(payment) === 'requires_payment_method';
}

export function getPaymentStatusDisplay(payment: PaymentDisplayInput): {
  label: string;
  tone: PaymentDisplayTone;
  description: string;
} {
  const stripeStatus = getExactStripeStatus(payment);

  if (payment.status === 'completed' || stripeStatus === 'succeeded') {
    return {
      label: 'Succeeded',
      tone: 'success',
      description: 'Verified by Stripe',
    };
  }

  if (payment.status === 'processing' || stripeStatus === 'processing') {
    return {
      label: 'Processing',
      tone: 'warning',
      description: 'Awaiting Stripe confirmation',
    };
  }

  if (stripeStatus === 'requires_payment_method') {
    return {
      label: 'Incomplete',
      tone: 'warning',
      description: 'Never completed in Stripe; no money moved',
    };
  }

  if (payment.status === 'canceled' || stripeStatus === 'canceled') {
    return {
      label: 'Canceled',
      tone: 'muted',
      description: 'Canceled before completion',
    };
  }

  if (payment.status === 'failed' || stripeStatus === 'payment_failed') {
    return {
      label: 'Failed',
      tone: 'destructive',
      description: 'Stripe reported a failed payment',
    };
  }

  return {
    label: payment.status || 'Review',
    tone: 'muted',
    description: 'Needs review',
  };
}
