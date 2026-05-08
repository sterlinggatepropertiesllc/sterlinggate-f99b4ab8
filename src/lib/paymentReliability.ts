import type { Payment } from '@/hooks/usePayments';

export type AchReconciliationAction = 'complete_and_apply_balance' | 'mark_failed' | 'wait' | 'unknown';

export interface TenantBalanceInput {
  id: string;
  current_balance?: number | null;
  property_id?: string | null;
  primary_property?: unknown | null;
}

export interface TenantFinancialHealth {
  currentBalance: number;
  pendingACH: number;
  effectiveBalance: number;
  lastCompletedPayment?: Payment;
  isUnassigned: boolean;
  hasBalanceDue: boolean;
  hasCredit: boolean;
  isPaidUp: boolean;
}

export function isFailedPaymentStatus(status: string | null | undefined) {
  return ['failed', 'canceled', 'requires_payment_method'].includes(status || '');
}

export function paymentAffectsTenantBalance(paymentType: string | null | undefined) {
  return ['rent', 'balance', 'deposit'].includes(paymentType || '');
}

export function hasPaymentBalanceApplied(
  payment: Pick<Payment, 'status' | 'payment_type' | 'balance_adjustment_id' | 'balance_applied_at'>
) {
  if (payment.status !== 'completed') return true;
  if (!paymentAffectsTenantBalance(payment.payment_type)) return true;
  return Boolean(payment.balance_adjustment_id || payment.balance_applied_at);
}

export function getPaymentAgeDays(
  payment: Pick<Payment, 'created_at' | 'payment_date'>,
  now: Date = new Date()
) {
  const rawDate = payment.created_at || payment.payment_date;
  const age = Math.floor((now.getTime() - new Date(rawDate).getTime()) / 86400000);
  return Math.max(0, age);
}

export function isStaleProcessingACH(payment: Payment, now: Date = new Date(), staleAfterDays = 5) {
  return (
    payment.status === 'processing' &&
    payment.payment_method_type === 'ach' &&
    getPaymentAgeDays(payment, now) >= staleAfterDays
  );
}

export function getAchReconciliationAction(stripeStatus: string | null | undefined): AchReconciliationAction {
  switch (stripeStatus) {
    case 'succeeded':
      return 'complete_and_apply_balance';
    case 'canceled':
    case 'requires_payment_method':
      return 'mark_failed';
    case 'processing':
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_capture':
      return 'wait';
    default:
      return 'unknown';
  }
}

export function computeTenantFinancialHealth(
  tenant: TenantBalanceInput,
  payments: Payment[] = []
): TenantFinancialHealth {
  const tenantPayments = payments.filter((payment) => payment.tenant_id === tenant.id);
  const pendingACH = tenantPayments
    .filter((payment) => payment.status === 'processing' && payment.payment_method_type === 'ach')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const lastCompletedPayment = tenantPayments
    .filter((payment) => payment.status === 'completed')
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];
  const currentBalance = Number(tenant.current_balance || 0);
  const effectiveBalance = currentBalance - pendingACH;
  const isUnassigned = !tenant.primary_property && !tenant.property_id;

  return {
    currentBalance,
    pendingACH,
    effectiveBalance,
    lastCompletedPayment,
    isUnassigned,
    hasBalanceDue: effectiveBalance > 0,
    hasCredit: effectiveBalance < 0,
    isPaidUp: effectiveBalance <= 0 && !isUnassigned,
  };
}
