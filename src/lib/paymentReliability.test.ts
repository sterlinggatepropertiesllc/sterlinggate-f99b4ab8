import { describe, expect, it } from 'vitest';
import type { Payment } from '@/hooks/usePayments';
import {
  computeTenantFinancialHealth,
  getAchReconciliationAction,
  hasPaymentBalanceApplied,
  isStaleProcessingACH,
} from './paymentReliability';

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'payment-1',
    tenant_id: 'tenant-1',
    property_id: 'property-1',
    lease_id: null,
    amount: 1000,
    payment_date: '2026-05-01',
    payment_method: 'stripe',
    payment_type: 'rent',
    status: 'processing',
    notes: null,
    created_at: '2026-05-01T12:00:00.000Z',
    payment_method_type: 'ach',
    convenience_fee: null,
    stripe_payment_intent_id: 'pi_test',
    stripe_session_id: null,
    balance_adjustment_id: null,
    balance_applied_at: null,
    ...overrides,
  };
}

describe('payment reliability', () => {
  it('routes Stripe ACH reconciliation statuses to the correct action', () => {
    expect(getAchReconciliationAction('succeeded')).toBe('complete_and_apply_balance');
    expect(getAchReconciliationAction('requires_payment_method')).toBe('mark_failed');
    expect(getAchReconciliationAction('canceled')).toBe('mark_failed');
    expect(getAchReconciliationAction('processing')).toBe('wait');
    expect(getAchReconciliationAction('not_a_real_status')).toBe('unknown');
  });

  it('detects processing ACH payments that are stale enough to reconcile', () => {
    const stale = payment({ created_at: '2026-05-01T00:00:00.000Z' });
    const fresh = payment({ created_at: '2026-05-06T00:00:00.000Z' });
    const now = new Date('2026-05-08T00:00:00.000Z');

    expect(isStaleProcessingACH(stale, now)).toBe(true);
    expect(isStaleProcessingACH(fresh, now)).toBe(false);
  });

  it('flags completed balance-affecting payments that never hit the balance ledger', () => {
    const unlinkedRentPayment = payment({
      status: 'completed',
      payment_type: 'rent',
      balance_adjustment_id: null,
      balance_applied_at: null,
    });
    const linkedBalancePayment = payment({
      status: 'completed',
      payment_type: 'balance',
      balance_adjustment_id: 'adjustment-1',
    });
    const applicationFee = payment({
      status: 'completed',
      payment_type: 'application_fee',
      balance_adjustment_id: null,
      balance_applied_at: null,
    });

    expect(hasPaymentBalanceApplied(unlinkedRentPayment)).toBe(false);
    expect(hasPaymentBalanceApplied(linkedBalancePayment)).toBe(true);
    expect(hasPaymentBalanceApplied(applicationFee)).toBe(true);
  });

  it('uses pending ACH to calculate effective tenant balance from one source of truth', () => {
    const health = computeTenantFinancialHealth(
      {
        id: 'tenant-1',
        current_balance: 2500,
        property_id: 'property-1',
        primary_property: { id: 'property-1' },
      },
      [
        payment({ amount: 1000, status: 'processing', payment_method_type: 'ach' }),
        payment({ id: 'payment-2', amount: 300, status: 'completed', payment_method_type: 'card' }),
      ]
    );

    expect(health.currentBalance).toBe(2500);
    expect(health.pendingACH).toBe(1000);
    expect(health.effectiveBalance).toBe(1500);
    expect(health.hasBalanceDue).toBe(true);
  });

  it('treats pending ACH that covers the balance as paid up without changing official balance', () => {
    const health = computeTenantFinancialHealth(
      {
        id: 'tenant-1',
        current_balance: 900,
        property_id: 'property-1',
        primary_property: { id: 'property-1' },
      },
      [payment({ amount: 900, status: 'processing', payment_method_type: 'ach' })]
    );

    expect(health.currentBalance).toBe(900);
    expect(health.effectiveBalance).toBe(0);
    expect(health.hasBalanceDue).toBe(false);
    expect(health.isPaidUp).toBe(true);
  });
});
