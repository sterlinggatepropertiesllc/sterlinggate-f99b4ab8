
# Pending ACH Payments Visual Indicator and Balance Flow

## Summary

You're right - the current balance shows $2,100 but doesn't reflect the $400 in pending ACH payments. We need to:

1. Show an "effective balance" of $1,700 (what Travis would owe after pending payments clear)
2. Display all 4 pending ACH payments visually (currently only shows 1)
3. Allow Travis to pay the remaining $1,700 while ACH is pending
4. If any ACH fails after the 5th, apply late fees automatically

---

## Current Problems

| Issue | Current State | Proposed Fix |
|-------|--------------|--------------|
| Only 1 pending ACH shown | Hook uses `.limit(1).maybeSingle()` | Fetch ALL pending ACH payments |
| Balance doesn't reflect pending | Shows $2,100 (doesn't subtract pending $400) | Show "Effective Balance: $1,700" with pending indicator |
| Can't make additional payments | UI shows pending ACH but doesn't allow more payments | Show "Pay Remaining Balance" button alongside pending indicator |
| No late fee on failed ACH | `handlePaymentFailed` only notifies, doesn't apply late fee | Add late fee logic when failure occurs after grace period |

---

## Visual Design

### Tenant Portal Dashboard (After Changes)

```text
+-------------------------------------------+
| Current Balance             $1,700        |
| (after pending payments)                  |
|                                           |
| +---------------------------------------+ |
| | 4 ACH Payments Pending     $400 total | |
| | $100 x 4 • Initiated Feb 4            | |
| | Typically clears in 3-5 business days | |
| +---------------------------------------+ |
|                                           |
| [Pay Remaining Balance: $1,700]           |
+-------------------------------------------+
```

### Manager Dashboard (After Changes)

```text
+-------------------------------------------+
| Current Balance               $2,100      |
| (official balance)                        |
|                                           |
| +---------------------------------------+ |
| | 4 ACH Payments Processing   $400      | |
| | If all clear: $1,700 remaining        | |
| +---------------------------------------+ |
+-------------------------------------------+
```

---

## Changes Required

### Part 1: Fetch All Pending ACH Payments (not just 1)

**File:** `src/hooks/usePendingACHPayment.ts`

Create a new hook `usePendingACHPayments` (plural) that:
- Fetches ALL payments with status='processing' and payment_method_type='ach'
- Returns array of payments and total pending amount
- Calculates effective balance (current balance minus pending amount)

### Part 2: New Component for Multiple Pending Payments

**File:** `src/components/payments/PendingACHPaymentsCard.tsx`

Create a new component that:
- Shows total pending amount (e.g., "$400 in 4 payments")
- Shows effective balance after pending clears
- Lists individual pending payments in a collapsible section
- Shows expected clear date (3-5 days from initiated)

### Part 3: Update Tenant Portal Balance Card

**File:** `src/pages/TenantPortal.tsx`

Changes:
- Show "Effective Balance" instead of "Current Balance" when pending ACH exists
- Display the new PendingACHPaymentsCard component
- Enable "Pay Remaining Balance" button even when ACH is pending
- Pass effective balance (current - pending) to payment dialog

### Part 4: Update Manager Balance Tab

**File:** `src/components/tenants/TenantBalanceTab.tsx`

Changes:
- Show both official balance ($2,100) and effective balance ($1,700)
- Display all pending ACH payments with the new component
- Keep manager's view of official balance for record-keeping

### Part 5: Add Late Fee on Failed ACH Payment

**File:** `supabase/functions/stripe-webhook/index.ts`

Update `handlePaymentFailed` to:
1. Check if today is past the grace period (rent_due_day + grace_period_days)
2. Look up tenant's late fee configuration from `tenant_properties`
3. If past grace period, calculate and apply late fee via `apply_balance_adjustment` RPC
4. Notify manager about both the failure AND the late fee applied

---

## Technical Details

### New Hook: usePendingACHPayments

```typescript
interface PendingACHSummary {
  payments: PendingACHPayment[];
  totalPending: number;
  effectiveBalance: number;
  count: number;
}

export function usePendingACHPayments(tenantId: string | undefined, currentBalance: number) {
  // Fetch ALL pending ACH payments (not just 1)
  // Calculate totalPending = sum of all payment amounts
  // Calculate effectiveBalance = currentBalance - totalPending
  // Return { payments, totalPending, effectiveBalance, count }
}
```

### Late Fee Logic in stripe-webhook

When payment fails:
1. Get tenant's properties from `tenant_properties`
2. For each property, check: `grace_period_days` and `rent_due_day`
3. Calculate grace period end: 1st + 5 days = 6th
4. If today > 6th, apply late fee:
   - If `late_fee_type` = 'percentage': fee = rent_amount * (late_fee_percentage / 100)
   - If `late_fee_type` = 'flat': fee = late_fee_flat_amount
5. Call RPC `apply_balance_adjustment` with adjustment_type='late_fee'
6. Send notification about late fee applied

### Database Query for Pending Payments

```sql
SELECT id, amount, created_at, payment_date, payment_method_type, status, notes
FROM payments
WHERE tenant_id = ?
  AND status = 'processing'
  AND payment_method_type = 'ach'
ORDER BY created_at DESC
-- No LIMIT - fetch all
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/usePendingACHPayments.ts` | Create | New hook to fetch ALL pending ACH payments with totals |
| `src/components/payments/PendingACHPaymentsCard.tsx` | Create | New component showing multiple pending payments |
| `src/pages/TenantPortal.tsx` | Modify | Use new hook, show effective balance, allow additional payments |
| `src/components/tenants/TenantBalanceTab.tsx` | Modify | Show both official and effective balance |
| `src/components/payments/PaymentDialog.tsx` | Modify | Accept effective balance for payment options |
| `supabase/functions/stripe-webhook/index.ts` | Modify | Add late fee logic to handlePaymentFailed |

---

## Late Fee Calculation Example

For Travis's properties:
- Rent due day: 1st
- Grace period: 5 days
- Late fee type: percentage
- Late fee percentage: 5%
- Rent per property: $1,050

If ACH fails on Feb 7th (after the 6th):
- Late fee per property: $1,050 * 5% = $52.50
- Total late fee (2 properties): $105

This would be added to Travis's balance automatically.

---

## Immediate Data Fix Needed

Travis's current balance shows $2,100, but this doesn't match what you mentioned earlier ($22,100). Let me verify the actual balance:
- Current balance in DB: $2,100
- 4 ACH payments processing: $400 total
- Effective balance: $1,700

If the balance should be different, we can adjust it after implementing these changes.
