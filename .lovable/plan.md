

## Fix Travis Boyd's Balance to $0

### Current State
- `current_balance`: $1,050
- March rent charged: $1,050 (only one of two properties)
- 2 stuck ACH payments: $1,050 each (both succeeded in Stripe)

### What Needs to Happen

**Step 1: Database data updates (using insert/update tool)**

1. **Update both stuck payments** from `processing` → `completed`
   - Payment `9dbf5b5a-2bde-41aa-8d54-decbd4eeb198`
   - Payment `a5bb02b0-b922-4d2d-8e66-634c4e43ce6e`

2. **Apply two payment balance adjustments** via `apply_balance_adjustment` RPC:
   - Payment 1: -$1,050 → balance goes from $1,050 to $0
   - Payment 2: -$1,050 → balance goes from $0 to -$1,050

3. **Charge missing March rent** for second property (2006 N Ashley St) via `apply_balance_adjustment`:
   - +$1,050 charge → balance goes from -$1,050 to $0

4. **Insert missing rent_charge record** for the second property's March 2026 rent

### Final Result
- Balance: **$0**
- Both payments: `completed`
- Both properties charged for March

### Why Auto-Charge Missed the Second Property
The `process_monthly_rent` function charges per-tenant (not per-property). It uses the tenant's single `rent_amount` field ($1,050) rather than summing all `tenant_properties`. This is a separate bug to fix later — the rent charge function should iterate over all tenant_properties and charge total rent.

