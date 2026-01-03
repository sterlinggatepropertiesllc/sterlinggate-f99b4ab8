import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  payment_intent_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[VERIFY-PAYMENT-INTENT] Function started");

    const body: VerifyRequest = await req.json();
    const { payment_intent_id } = body;

    if (!payment_intent_id) {
      throw new Error("payment_intent_id is required");
    }

    console.log("[VERIFY-PAYMENT-INTENT] Verifying PaymentIntent:", payment_intent_id);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    console.log("[VERIFY-PAYMENT-INTENT] PaymentIntent status:", paymentIntent.status);
    console.log("[VERIFY-PAYMENT-INTENT] PaymentIntent metadata:", paymentIntent.metadata);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    // Get metadata
    const { payment_type, property_id, lease_id, tenant_id, user_id } = paymentIntent.metadata || {};
    const amountPaid = paymentIntent.amount || 0;
    const amountInDollars = amountPaid / 100;

    console.log("[VERIFY-PAYMENT-INTENT] Payment details:", { payment_type, property_id, lease_id, tenant_id, amountInDollars });

    if (!user_id) {
      console.error("[VERIFY-PAYMENT-INTENT] No user_id in metadata");
      throw new Error("Invalid payment: missing user information");
    }

    // Check if payment already recorded (idempotency)
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('stripe_session_id', payment_intent_id)
      .single();

    if (existingPayment) {
      console.log("[VERIFY-PAYMENT-INTENT] Payment already recorded:", existingPayment.id);
      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: existingPayment.id,
        already_recorded: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Resolve IDs if needed
    let resolvedTenantId = tenant_id;
    let resolvedPropertyId = property_id;

    if (!resolvedTenantId && lease_id) {
      console.log("[VERIFY-PAYMENT-INTENT] Looking up tenant from lease:", lease_id);
      const { data: leaseData } = await supabaseAdmin
        .from('leases')
        .select('tenant_id, property_id')
        .eq('id', lease_id)
        .single();

      if (leaseData) {
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
      }
    }

    // If still no property_id, try to find from tenant's active lease
    if (resolvedTenantId && !resolvedPropertyId) {
      console.log("[VERIFY-PAYMENT-INTENT] Looking up property from tenant's lease...");
      
      // First get the user_id from the tenant record
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('user_id, property_id')
        .eq('id', resolvedTenantId)
        .single();

      if (tenantData?.property_id) {
        resolvedPropertyId = tenantData.property_id;
        console.log("[VERIFY-PAYMENT-INTENT] Found property_id from tenant:", resolvedPropertyId);
      } else if (tenantData?.user_id) {
        // Try to find property from lease
        const { data: leaseData } = await supabaseAdmin
          .from('leases')
          .select('property_id')
          .eq('tenant_id', tenantData.user_id)
          .in('status', ['completed', 'pending_tenant_signature', 'pending_manager_signature'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (leaseData?.property_id) {
          resolvedPropertyId = leaseData.property_id;
          console.log("[VERIFY-PAYMENT-INTENT] Found property_id from lease:", resolvedPropertyId);
        }
      }
    }

    // Ensure we have required IDs
    if (!resolvedTenantId) {
      console.error("[VERIFY-PAYMENT-INTENT] Missing tenant_id:", { resolvedTenantId, resolvedPropertyId });
      throw new Error("Could not determine tenant for payment record");
    }

    // For balance payments, property_id may legitimately be null if tenant has no property assigned
    // We'll handle this gracefully by allowing null but logging it
    if (!resolvedPropertyId) {
      console.warn("[VERIFY-PAYMENT-INTENT] No property_id found, checking if we can proceed...");
      
      // Try one more lookup from the tenant's property_id field
      if (resolvedTenantId) {
        const { data: tenantCheck } = await supabaseAdmin
          .from('tenants')
          .select('property_id')
          .eq('id', resolvedTenantId)
          .single();
        
        if (tenantCheck?.property_id) {
          resolvedPropertyId = tenantCheck.property_id;
        }
      }
      
      if (!resolvedPropertyId) {
        console.error("[VERIFY-PAYMENT-INTENT] Still no property_id, cannot record payment");
        throw new Error("Could not determine property for payment record. Please ensure tenant has an assigned property.");
      }
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
        stripe_session_id: payment_intent_id,
        payment_type: payment_type,
        notes: `${payment_type?.replace(/_/g, ' ')} via Stripe (embedded)`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[VERIFY-PAYMENT-INTENT] Insert error:", insertError);
      throw new Error(`Failed to record payment: ${insertError.message}`);
    }

    console.log("[VERIFY-PAYMENT-INTENT] Payment recorded:", newPayment.id);

    // Update tenant balance for balance and rent payments
    if (payment_type === 'balance' || payment_type === 'rent') {
      console.log("[VERIFY-PAYMENT-INTENT] Updating tenant balance for:", resolvedTenantId);

      const { data: tenantData, error: tenantFetchError } = await supabaseAdmin
        .from('tenants')
        .select('current_balance')
        .eq('id', resolvedTenantId)
        .single();

      if (tenantFetchError) {
        console.error("[VERIFY-PAYMENT-INTENT] Failed to fetch tenant balance:", tenantFetchError);
      } else {
        const previousBalance = tenantData?.current_balance || 0;
        const newBalance = previousBalance - amountInDollars;

        console.log("[VERIFY-PAYMENT-INTENT] Balance update:", { previousBalance, amountInDollars, newBalance });

        const { error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ current_balance: newBalance })
          .eq('id', resolvedTenantId);

        if (updateError) {
          console.error("[VERIFY-PAYMENT-INTENT] Failed to update balance:", updateError);
        } else {
          console.log("[VERIFY-PAYMENT-INTENT] Balance updated successfully");

          // Insert balance adjustment record
          const { error: adjustmentError } = await supabaseAdmin
            .from('balance_adjustments')
            .insert({
              tenant_id: resolvedTenantId,
              adjustment_type: 'payment',
              amount: amountInDollars,
              previous_balance: previousBalance,
              new_balance: newBalance,
              description: `Stripe ${payment_type} payment (embedded)`,
              created_by: user_id,
            });

          if (adjustmentError) {
            console.error("[VERIFY-PAYMENT-INTENT] Failed to insert balance adjustment:", adjustmentError);
          } else {
            console.log("[VERIFY-PAYMENT-INTENT] Balance adjustment recorded");
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
    console.error("[VERIFY-PAYMENT-INTENT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
