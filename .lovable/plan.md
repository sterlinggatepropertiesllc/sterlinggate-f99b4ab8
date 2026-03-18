## ACH Payment Pipeline Fix — Completed

All long-term fixes have been implemented:

### ✅ 1. Webhook Secret Updated
- `STRIPE_WEBHOOK_SECRET` set to the correct signing secret from Stripe dashboard

### ✅ 2. Stripe Webhook Hardened (`stripe-webhook/index.ts`)
- Removed hardcoded `apiVersion` — accepts whatever version Stripe sends
- Switched to `constructEventAsync` for robust signature verification in Deno
- Added detailed diagnostic logging (secret prefix, signature prefix, body length)
- Replaced manual balance math with centralized `apply_balance_adjustment` RPC

### ✅ 3. API Versions Aligned Across All Stripe Functions
- Removed pinned `apiVersion: "2025-08-27.basil"` from:
  - `create-payment-checkout`
  - `create-payment-intent`
  - `verify-payment-intent`
  - `verify-payment`
  - `reconcile-ach-payments`

### ✅ 4. Overdue Alert False Positives Fixed (`useOverdueTenants.ts`)
- Now queries pending ACH payments per tenant before marking overdue
- Computes effective balance (current_balance - pending ACH)
- Skips tenants whose effective balance is ≤ 0
- Also subscribes to `payments` table changes for real-time updates

### ✅ 5. Reconciliation Expanded (`reconcile-ach-payments/index.ts`)
- Now supports system-wide sweep when no `tenant_id` is provided
- Serves as a safety net for any missed webhook events

### Stuck Payments
- Travis Boyd: 2 payments × $1,050 (processing)
- John Robinson: 1 payment × $1.76 (processing)
- Use the "Reconcile Stuck Payments" button on each tenant's detail page to clear them
