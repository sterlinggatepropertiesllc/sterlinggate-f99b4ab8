

# Travis Boyd Payment Issues - Complete Analysis and Fix Plan

## What Happened

Travis Boyd attempted to pay his balance multiple times but experienced payment issues. Here's the complete picture:

### Current State

| Item | Value |
|------|-------|
| Current Balance in System | $100 |
| February Rent Charged | NO (should be $2,100 total) |
| Properties Assigned | 2 properties at $1,050/month each |
| Leases in System | None |
| Property on Tenant Record | NULL |

### Payment Attempts (from Stripe)

| Payment Intent | Amount | Status | Method | Will it Reverse? |
|---------------|--------|--------|--------|------------------|
| `pi_3Swmr1Cx5Tw1Rijg0SFXWUXj` | $100 | Processing | ACH | Pending - will either succeed or fail in 3-5 days |
| `pi_3SwmtHCx5Tw1Rijg0BS3PCRD` | $100 | Processing | ACH | Pending - will either succeed or fail in 3-5 days |
| `pi_3SwmtuCx5Tw1Rijg1booMKFE` | $100 | Processing | ACH | Pending - will either succeed or fail in 3-5 days |
| `pi_3SwmuYCx5Tw1Rijg1XhyADho` | $100 | Processing | ACH | Pending - will either succeed or fail in 3-5 days |
| `pi_3SwmvpCx5Tw1Rijg0EU1UW0Y` | $103 | Succeeded | Card | Already charged (not recorded in DB!) |
| Multiple $103 attempts | $103 | requires_payment_method | Card | Never charged - payment failed/abandoned |

### The Problem

1. **Travis has NO `property_id` on his tenant record** and **NO leases**
2. His properties are stored in the `tenant_properties` table (which the payment functions don't check)
3. When the payment functions try to resolve a property for the payment record, they fail with: "Could not determine property for payment record"
4. This causes the payment to succeed in Stripe but never get recorded in your database

### About the 4 ACH Payments

**Will they reverse?** Not automatically. Here's what will happen:

- **Status: "Processing"** means the money is being pulled from Travis's bank account
- In 3-5 business days, each payment will either:
  - **Succeed** - The webhook will receive `payment_intent.succeeded` and (if the webhook is properly set up) record it
  - **Fail** - If there are insufficient funds or bank rejection, the webhook receives `payment_intent.payment_failed`
- These are NOT pre-authorizations - ACH payments are actual bank transfers that are in progress
- If Travis doesn't have $400 in his bank account, some or all may fail

---

## Root Cause Analysis

```text
Payment Flow Currently:
+------------------+     +---------------------+     +-------------------+
| Tenant Portal    | --> | create-payment-     | --> | Payment Created   |
| "Pay Balance"    |     | intent              |     | in Stripe         |
+------------------+     +---------------------+     +-------------------+
                                 |
                                 v
                    +------------------------+
                    | Looks for property_id  |
                    +------------------------+
                                 |
        +------------------------+------------------------+
        |                        |                        |
        v                        v                        v
   tenant.property_id       leases table          tenant_properties
   (NULL for Travis)        (empty for Travis)    (NOT CHECKED!)
                                                        |
                                                        v
                                                  2 properties exist
                                                  but never found!
```

The functions check:
1. `tenants.property_id` - Travis has NULL
2. `leases` table - Travis has no leases

They NEVER check:
- `tenant_properties` table (where Travis's 2 properties actually exist)

---

## Comprehensive Fix Plan

### Part 1: Immediate Database Fixes

**1a. Charge February Rent (Manual)**
- Travis owes $2,100 for February (2 properties x $1,050)
- Add this to his balance

**1b. Record the Missing $103 Card Payment**
- Payment `pi_3SwmvpCx5Tw1Rijg0EU1UW0Y` succeeded but wasn't recorded
- Base amount: $100, Card fee: $3
- Reduce balance by $100

**1c. Record the 4 ACH Payments as "Processing"**
- These need to be tracked so you can see them
- Status will be updated by webhook when they settle
- Each is for $100

**Final Balance Calculation:**
```text
Current balance:                      $100
+ February rent (2 x $1,050):       $2,100
- Card payment ($100 base):          -$100
= New balance:                      $2,100

4 ACH payments in processing:    4 x $100 = $400 pending
If all clear, final balance would be: $1,700
```

### Part 2: Fix Edge Functions

**2a. Fix `create-payment-intent/index.ts`**

Add fallback to check `tenant_properties` table when no property is found:

```typescript
// After checking tenant.property_id and leases...
if (!resolvedPropertyId) {
  console.log("[CREATE-PAYMENT-INTENT] Checking tenant_properties table...");
  const { data: tenantProperty } = await supabaseAdmin
    .from('tenant_properties')
    .select('property_id')
    .eq('tenant_id', body.tenant_id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .single();

  if (tenantProperty?.property_id) {
    resolvedPropertyId = tenantProperty.property_id;
    console.log("[CREATE-PAYMENT-INTENT] Found property_id from tenant_properties:", resolvedPropertyId);
  }
}
```

**2b. Fix `verify-payment-intent/index.ts`**

Add the same fallback lookup in two places:
- Lines 167-177 (for processing ACH payments)
- Lines 416-436 (for succeeded payments)

```typescript
// After checking tenant.property_id and leases...
if (!resolvedPropertyId && resolvedTenantId) {
  console.log("[VERIFY-PAYMENT-INTENT] Checking tenant_properties table...");
  const { data: tenantProperty } = await supabaseAdmin
    .from('tenant_properties')
    .select('property_id')
    .eq('tenant_id', resolvedTenantId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .single();

  if (tenantProperty?.property_id) {
    resolvedPropertyId = tenantProperty.property_id;
    console.log("[VERIFY-PAYMENT-INTENT] Found property_id from tenant_properties:", resolvedPropertyId);
  }
}
```

**2c. Fix `stripe-webhook/index.ts`**

Add the same fallback in `handlePaymentSucceeded` function (around line 274):

```typescript
// After checking tenant.property_id and leases...
if (!resolvedPropertyId && resolvedTenantId) {
  logStep("Checking tenant_properties table...");
  const { data: tenantProperty } = await supabaseAdmin
    .from('tenant_properties')
    .select('property_id')
    .eq('tenant_id', resolvedTenantId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .single();

  if (tenantProperty?.property_id) {
    resolvedPropertyId = tenantProperty.property_id;
    logStep("Found property_id from tenant_properties", { resolvedPropertyId });
  }
}
```

### Part 3: Set Primary Property for Travis

Update one of Travis's `tenant_properties` records to be `is_primary = true`:

```sql
UPDATE tenant_properties 
SET is_primary = true 
WHERE id = 'efc3bd1f-022f-47ec-9e83-049002470ec1';
-- This is 2008 N Ashley St
```

### Part 4: Webhook Setup (Already Discussed)

To ensure future payments are always recorded even if the user closes the browser:

1. Register webhook URL: `https://nmibwtbrbpqfvseeflep.supabase.co/functions/v1/stripe-webhook`
2. Add events: `payment_intent.succeeded`, `payment_intent.payment_failed`
3. Add the `STRIPE_WEBHOOK_SECRET` to your backend secrets

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/create-payment-intent/index.ts` | Add `tenant_properties` fallback lookup |
| `supabase/functions/verify-payment-intent/index.ts` | Add `tenant_properties` fallback in 2 places |
| `supabase/functions/stripe-webhook/index.ts` | Add `tenant_properties` fallback in `handlePaymentSucceeded` |
| Database | Charge Feb rent, record 5 payments, update balance, set primary property |

---

## Technical Details

### Database Changes Required

```sql
-- 1. Record the missing $103 card payment (pi_3SwmvpCx5Tw1Rijg0EU1UW0Y)
INSERT INTO payments (tenant_id, property_id, amount, convenience_fee, payment_date, 
  payment_method, payment_method_type, status, stripe_payment_intent_id, payment_type, notes)
VALUES (
  '4f8f5d8f-182b-401e-9422-1463ba08eeb9',
  '4a1d0ce4-e792-4428-83c1-004a99f4e11c',
  100, 3,
  CURRENT_DATE,
  'stripe', 'card', 'completed',
  'pi_3SwmvpCx5Tw1Rijg0EU1UW0Y',
  'balance',
  'Balance payment - manually recorded (property lookup fixed)'
);

-- 2. Record the 4 processing ACH payments
-- pi_3Swmr1Cx5Tw1Rijg0SFXWUXj, pi_3SwmtHCx5Tw1Rijg0BS3PCRD, 
-- pi_3SwmtuCx5Tw1Rijg1booMKFE, pi_3SwmuYCx5Tw1Rijg1XhyADho

-- 3. Add February rent charge to balance (via balance_adjustment)
-- +$2,100 (2 properties x $1,050)

-- 4. Apply the $100 card payment to balance
-- -$100 

-- 5. Update final balance
UPDATE tenants SET current_balance = 2100 
WHERE id = '4f8f5d8f-182b-401e-9422-1463ba08eeb9';

-- 6. Set primary property
UPDATE tenant_properties SET is_primary = true 
WHERE id = 'efc3bd1f-022f-47ec-9e83-049002470ec1';
```

### Edge Function Property Lookup Fix

The key change is adding this fallback to all three edge functions:

```typescript
// Fallback to tenant_properties table
if (!resolvedPropertyId && resolvedTenantId) {
  const { data: tenantProperty } = await supabaseAdmin
    .from('tenant_properties')
    .select('property_id')
    .eq('tenant_id', resolvedTenantId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .single();

  if (tenantProperty?.property_id) {
    resolvedPropertyId = tenantProperty.property_id;
  }
}
```

