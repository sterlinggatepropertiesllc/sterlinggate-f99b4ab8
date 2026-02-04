
# Fix Manager Dashboard to Show Effective Balance

## Problem
The manager dashboard (Balance tab) still shows $2,100 as "Current Balance" even though the pending ACH indicator correctly shows "If all clear: $1,700 remaining". The main balance card needs to display the effective balance when ACH payments are pending.

## Current vs Expected

| Element | Current | Expected |
|---------|---------|----------|
| Label | "CURRENT BALANCE" | "REMAINING BALANCE" (when pending) |
| Amount | $2,100 | $1,700 (effective balance) |
| Secondary info | None | "Official balance: $2,100" note |

## Changes Required

### File: `src/components/tenants/TenantBalanceTab.tsx`

**Lines 130-154: Update the balance card to show effective balance**

1. Add logic to determine which balance to display:
   - When `hasPendingACH` is true: show `effectiveBalance` with label "Remaining Balance"
   - When no pending ACH: show `currentBalance` with label "Current Balance"

2. Update the isOverdue calculation to use effective balance for styling

3. Add a secondary note showing official balance when pending ACH exists

4. Update badge text to reflect remaining vs owed status

**Code Changes:**

```typescript
// Before the return statement, add:
const displayBalance = hasPendingACH ? effectiveBalance : currentBalance;
const displayLabel = hasPendingACH ? "Remaining Balance" : "Current Balance";
const isEffectiveOverdue = displayBalance > 0;

// In the balance card (lines 130-154):
// - Change "Current Balance" to {displayLabel}
// - Change ${Math.abs(currentBalance).toLocaleString()} to ${Math.abs(displayBalance).toLocaleString()}
// - Update isOverdue references to isEffectiveOverdue
// - Add note below badge: {hasPendingACH && <p>Official balance: ${currentBalance.toLocaleString()}</p>}
```

## Visual Result (After Fix)

```text
+-------------------------------------------+
| REMAINING BALANCE            $1,700       |
| [Amount Owed badge]                       |
| Official balance: $2,100                  |
+-------------------------------------------+
```

When no pending ACH payments:
```text
+-------------------------------------------+
| CURRENT BALANCE              $X,XXX       |
| [Amount Owed/Paid in Full badge]          |
+-------------------------------------------+
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/tenants/TenantBalanceTab.tsx` | Update balance card to show effectiveBalance when hasPendingACH is true |
