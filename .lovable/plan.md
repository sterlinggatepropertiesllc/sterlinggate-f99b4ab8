

# Show Effective Balance as Primary on Tenant Portal

## What This Changes

Currently, when Travis logs in, he sees:
- **Primary display:** "Current Balance: $2,100" 
- **Secondary (inside collapsible):** "Effective Balance: $1,700"

After this change, he will see:
- **Primary display:** "Remaining Balance: $1,700" (the effective balance)
- **Pending indicator:** "$400 in 4 ACH payments processing"
- **Small note:** "Official balance: $2,100"

## Property Assignment Confirmation

All tenants can make payments because:
1. **Travis Boyd**: Has `property_id` set on tenant record + 2 properties in `tenant_properties` with primary set
2. **John Robinson (tenant 1)**: Has `property_id` set + 1 property in `tenant_properties` with primary set
3. **John Robinson (tenant 2)**: Has `property_id` set on tenant record (fallback works)

The edge functions now check in this order:
1. `tenants.property_id` (direct field)
2. `leases` table
3. `tenant_properties` table (new fallback we added)

So even if a tenant has no entries in `tenant_properties`, their direct `property_id` will be used.

---

## Changes Required

### File: `src/pages/TenantPortal.tsx`

**Location 1: Lines 476-518 (No property assigned balance card)**
- Change "Current Balance" label to "Remaining Balance" when pending ACH exists
- Show `effectiveBalance` instead of `currentBalance` as the primary number
- Move the `PendingACHPaymentsCard` below the balance display
- Add small note showing official balance for reference

**Location 2: Lines 558-600 (Main dashboard balance card)**
- Same changes as above
- Display effective balance as the main number
- Show pending ACH indicator below
- Pass `effectiveBalance` to the "Pay Remaining" button

### File: `src/components/payments/PendingACHPaymentsCard.tsx`

- Simplify the component to focus on the pending indicator only
- Remove the effective balance calculation from this component (it's now shown in the main card)
- Keep the collapsible list of individual payments

### File: `src/components/payments/PaymentDialog.tsx`

- Update "Pay Full Balance" button to use effective balance when pending ACH exists
- Show remaining balance clearly in the payment flow

---

## Visual Mockup (After Changes)

```text
+-------------------------------------------+
|                                           |
| Remaining Balance            $1,700       |
| (after pending payments)                  |
|                                           |
| +---------------------------------------+ |
| | 4 ACH Payments Processing   $400      | |
| | Typically clears in 3-5 business days | |
| | [View details]                        | |
| +---------------------------------------+ |
|                                           |
| Official balance: $2,100                  |
|                                           |
| [Pay Remaining Balance]                   |
+-------------------------------------------+
```

---

## Technical Details

### Balance Display Logic

```typescript
// Determine which balance to show as primary
const displayBalance = hasPendingACH ? effectiveBalance : currentBalance;
const displayLabel = hasPendingACH ? "Remaining Balance" : "Current Balance";

// Show official balance as secondary when pending
{hasPendingACH && (
  <p className="text-xs text-muted-foreground">
    Official balance: ${currentBalance.toLocaleString()}
  </p>
)}
```

### Payment Dialog Updates

```typescript
// In PaymentDialog, use effective balance for "Pay Full" option
const payFullAmount = hasPendingACH ? effectiveBalance : currentBalance;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TenantPortal.tsx` | Show effectiveBalance as primary, add official balance note |
| `src/components/payments/PendingACHPaymentsCard.tsx` | Simplify to just show pending indicator |
| `src/components/payments/PaymentDialog.tsx` | Use effective balance for payment options |

