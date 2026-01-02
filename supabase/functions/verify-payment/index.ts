import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  session_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role for inserting payment records and updating balances
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    console.log("[VERIFY-PAYMENT] Function started");

    // Parse request
    const body: VerifyRequest = await req.json();
    const { session_id } = body;

    if (!session_id) {
      throw new Error("session_id is required");
    }

    console.log("[VERIFY-PAYMENT] Verifying session:", session_id);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent'],
    });

    console.log("[VERIFY-PAYMENT] Session status:", session.payment_status);
    console.log("[VERIFY-PAYMENT] Session metadata:", session.metadata);

    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    // Get user_id from session metadata (set during checkout creation by authenticated user)
    const userId = session.metadata?.user_id;
    if (!userId) {
      console.error("[VERIFY-PAYMENT] No user_id in session metadata");
      throw new Error("Invalid session: missing user information");
    }
    
    console.log("[VERIFY-PAYMENT] User from metadata:", userId);

    // Check if payment already recorded (idempotency)
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('stripe_session_id', session_id)
      .single();

    if (existingPayment) {
      console.log("[VERIFY-PAYMENT] Payment already recorded:", existingPayment.id);
      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: existingPayment.id,
        already_recorded: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Extract metadata
    const { payment_type, property_id, lease_id, tenant_id } = session.metadata || {};
    const amountPaid = session.amount_total || 0;
    const amountInDollars = amountPaid / 100;

    console.log("[VERIFY-PAYMENT] Payment details:", { payment_type, property_id, lease_id, tenant_id, amountInDollars });

    // Resolve tenant_id and property_id based on payment type
    let resolvedTenantId = tenant_id;
    let resolvedPropertyId = property_id;

    // For balance payments, tenant_id should already be in metadata
    // For rent/deposit payments, we may need to look up from lease
    if (!resolvedTenantId && lease_id) {
      console.log("[VERIFY-PAYMENT] Looking up tenant from lease:", lease_id);
      const { data: leaseData } = await supabaseAdmin
        .from('leases')
        .select('tenant_id, property_id')
        .eq('id', lease_id)
        .single();

      if (leaseData) {
        // The lease.tenant_id is the user_id, so we need to get the tenant record
        const { data: tenantRecord } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('user_id', leaseData.tenant_id)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (tenantRecord) {
          resolvedTenantId = tenantRecord.id;
        }
        resolvedPropertyId = leaseData.property_id;
        console.log("[VERIFY-PAYMENT] Resolved from lease:", { resolvedTenantId, resolvedPropertyId });
      }
    }

    // For application fees, try to find tenant by user_id
    if (!resolvedTenantId && payment_type === 'application_fee') {
      const { data: tenantRecord } = await supabaseAdmin
        .from('tenants')
        .select('id, property_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (tenantRecord) {
        resolvedTenantId = tenantRecord.id;
        if (!resolvedPropertyId) {
          resolvedPropertyId = tenantRecord.property_id;
        }
      }
    }

    // Fallback: If we still don't have property_id, try to get it from tenant's lease
    if (!resolvedPropertyId && resolvedTenantId) {
      console.log("[VERIFY-PAYMENT] Property ID missing, looking up from tenant's lease");
      
      // First try to get property_id directly from tenant record
      const { data: tenantWithProperty } = await supabaseAdmin
        .from('tenants')
        .select('property_id')
        .eq('id', resolvedTenantId)
        .single();
        
      if (tenantWithProperty?.property_id) {
        resolvedPropertyId = tenantWithProperty.property_id;
        console.log("[VERIFY-PAYMENT] Found property from tenant record:", resolvedPropertyId);
      }
      
      // If still no property, look for any active lease for this user
      if (!resolvedPropertyId && userId) {
        const { data: activeLeaseData } = await supabaseAdmin
          .from('leases')
          .select('property_id')
          .eq('tenant_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (activeLeaseData?.property_id) {
          resolvedPropertyId = activeLeaseData.property_id;
          console.log("[VERIFY-PAYMENT] Found property from user's lease:", resolvedPropertyId);
        }
      }
    }

    console.log("[VERIFY-PAYMENT] Final resolved IDs:", { resolvedTenantId, resolvedPropertyId });

    // We need both tenant_id and property_id to record a payment
    if (!resolvedTenantId || !resolvedPropertyId) {
      console.log("[VERIFY-PAYMENT] Missing required IDs, payment cannot be recorded to database");
      // For application fees without a tenant record, just return success without DB insert
      if (payment_type === 'application_fee') {
        return new Response(JSON.stringify({ 
          success: true, 
          payment_type,
          amount: amountInDollars,
          message: "Payment verified but not recorded (no tenant record)"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      throw new Error("Could not determine tenant or property for payment record");
    }

    // Insert payment record
    const { data: newPayment, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: resolvedTenantId,
        property_id: resolvedPropertyId,
        lease_id: lease_id || null,
        amount: amountInDollars,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'stripe',
        status: 'completed',
        stripe_session_id: session_id,
        payment_type: payment_type,
        notes: `${payment_type?.replace(/_/g, ' ')} via Stripe`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[VERIFY-PAYMENT] Insert error:", insertError);
      throw new Error(`Failed to record payment: ${insertError.message}`);
    }

    console.log("[VERIFY-PAYMENT] Payment recorded:", newPayment.id);

    // Update tenant balance for balance and rent payments
    if (payment_type === 'balance' || payment_type === 'rent') {
      console.log("[VERIFY-PAYMENT] Updating tenant balance for:", resolvedTenantId);

      // Get current balance
      const { data: tenantData, error: tenantFetchError } = await supabaseAdmin
        .from('tenants')
        .select('current_balance')
        .eq('id', resolvedTenantId)
        .single();

      if (tenantFetchError) {
        console.error("[VERIFY-PAYMENT] Failed to fetch tenant balance:", tenantFetchError);
      } else {
        const previousBalance = tenantData?.current_balance || 0;
        const newBalance = previousBalance - amountInDollars;

        console.log("[VERIFY-PAYMENT] Balance update:", { previousBalance, amountInDollars, newBalance });

        // Update tenant balance
        const { error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ current_balance: newBalance })
          .eq('id', resolvedTenantId);

        if (updateError) {
          console.error("[VERIFY-PAYMENT] Failed to update balance:", updateError);
        } else {
          console.log("[VERIFY-PAYMENT] Balance updated successfully");

          // Insert balance adjustment record
          const { error: adjustmentError } = await supabaseAdmin
            .from('balance_adjustments')
            .insert({
              tenant_id: resolvedTenantId,
              adjustment_type: 'payment',
              amount: amountInDollars,
              previous_balance: previousBalance,
              new_balance: newBalance,
              description: `Stripe ${payment_type} payment`,
              created_by: userId,
            });

          if (adjustmentError) {
            console.error("[VERIFY-PAYMENT] Failed to insert balance adjustment:", adjustmentError);
          } else {
            console.log("[VERIFY-PAYMENT] Balance adjustment recorded");
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      payment_id: newPayment.id,
      payment_type,
      amount: amountInDollars,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[VERIFY-PAYMENT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
