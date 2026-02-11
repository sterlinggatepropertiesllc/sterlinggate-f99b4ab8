

## Clear Stuck ACH Payments

### Problem
5 ACH payments totaling $2,100 for this tenant succeeded in Stripe but remain "processing" in the database because the webhook was disabled at the time. The tenant's balance shows $2,100 owed when it should be $0.

### Payments to Clear

| Amount | Payment Intent | Status |
|--------|---------------|--------|
| $1,700 | pi_3SxJbP... | processing |
| $100 | pi_3Swmr1... | processing |
| $100 | pi_3SwmtH... | processing |
| $100 | pi_3Swmtu... | processing |
| $100 | pi_3SwmuY... | processing |

### What I'll Do

1. **Create a one-time reconciliation edge function** (`reconcile-ach-payments`) that:
   - Takes a tenant ID as input
   - Finds all "processing" payments with Stripe payment intent IDs
   - Checks each payment intent's actual status in Stripe
   - Updates confirmed-succeeded payments to "completed"
   - Reduces the tenant's balance accordingly (via the existing `apply_balance_adjustment` RPC)
   - Returns a summary of what was updated

2. **Add a "Reconcile Payments" button** to the tenant's Balance tab so you (the manager) can trigger this for any tenant in the future -- no more manual fixes needed.

3. **Run the reconciliation** for this tenant to clear the 5 stuck payments and update the balance from $2,100 to $0.

### Technical Details

- The edge function uses the Stripe SDK to verify each payment intent's real status before updating anything -- it won't blindly mark things as completed.
- Balance adjustments are recorded properly so the audit trail stays clean.
- After reconciliation, the UI will refresh automatically via query invalidation.
- This also serves as a safety net going forward: if the webhook ever misses an event again, you can hit the button to catch up.

