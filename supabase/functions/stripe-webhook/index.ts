import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // deno-lint-ignore no-explicit-any
  const supabaseAdmin: SupabaseClient<any> = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    logStep("Verifying webhook signature");

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logStep("Webhook signature verification failed", { error: message });
      return new Response(JSON.stringify({ error: `Webhook Error: ${message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event type received", { type: event.type, id: event.id });

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(supabaseAdmin, paymentIntent);
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabaseAdmin, paymentIntent);
        break;
      }
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function handlePaymentSucceeded(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  paymentIntent: Stripe.PaymentIntent
) {
  logStep("Processing payment_intent.succeeded", { id: paymentIntent.id });

  const { payment_type, property_id, lease_id, tenant_id, user_id } = paymentIntent.metadata || {};
  const amountPaid = paymentIntent.amount || 0;
  const amountInDollars = amountPaid / 100;

  logStep("Payment details", { payment_type, tenant_id, amountInDollars });

  // Check if payment already recorded (idempotency)
  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (existingPayment) {
    if (existingPayment.status === "completed") {
      logStep("Payment already completed", { id: existingPayment.id });
      return;
    }

    // Payment exists but was processing - update to completed
    logStep("Updating processing payment to completed", { id: existingPayment.id });

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ status: "completed" })
      .eq("id", existingPayment.id);

    if (updateError) {
      logStep("Failed to update payment status", { error: updateError.message });
    }

    // Now update tenant balance for balance/rent payments
    if ((payment_type === "balance" || payment_type === "rent") && tenant_id) {
      await updateTenantBalance(supabaseAdmin, tenant_id, amountInDollars, payment_type, user_id);
    }

    return;
  }

  // No existing payment record - this might be a direct webhook call
  // Handle similar to verify-payment-intent logic
  logStep("No existing payment found, creating new record");

  // Resolve tenant and property IDs
  let resolvedTenantId = tenant_id;
  let resolvedPropertyId = property_id;

  if (!resolvedTenantId && lease_id) {
    logStep("Looking up tenant from lease", { lease_id });
    const { data: leaseData } = await supabaseAdmin
      .from("leases")
      .select("tenant_id, property_id")
      .eq("id", lease_id)
      .single();

    if (leaseData) {
      const { data: tenantRecord } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("user_id", leaseData.tenant_id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (tenantRecord) {
        resolvedTenantId = tenantRecord.id;
      }
      resolvedPropertyId = leaseData.property_id;
    }
  }

  if (!resolvedTenantId || !resolvedPropertyId) {
    logStep("Cannot resolve tenant or property", { resolvedTenantId, resolvedPropertyId });
    return;
  }

  // Insert completed payment record
  const { error: insertError } = await supabaseAdmin
    .from("payments")
    .insert({
      tenant_id: resolvedTenantId,
      property_id: resolvedPropertyId,
      lease_id: lease_id || null,
      amount: amountInDollars,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "stripe",
      status: "completed",
      stripe_payment_intent_id: paymentIntent.id,
      payment_type: payment_type,
      notes: `${payment_type?.replace(/_/g, " ")} via Stripe webhook`,
    });

  if (insertError) {
    logStep("Failed to insert payment", { error: insertError.message });
    return;
  }

  logStep("Payment recorded via webhook");

  // Update tenant balance for balance/rent payments
  if (payment_type === "balance" || payment_type === "rent") {
    await updateTenantBalance(supabaseAdmin, resolvedTenantId, amountInDollars, payment_type, user_id);
  }
}

async function handlePaymentFailed(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  paymentIntent: Stripe.PaymentIntent
) {
  logStep("Processing payment_intent.payment_failed", { id: paymentIntent.id });

  const lastError = paymentIntent.last_payment_error?.message || "Payment failed";
  logStep("Payment failure reason", { reason: lastError });

  // Find the pending payment
  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id, tenant_id")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (!existingPayment) {
    logStep("No pending payment found to mark as failed");
    return;
  }

  // Update payment status to failed
  const { error: updateError } = await supabaseAdmin
    .from("payments")
    .update({ 
      status: "failed",
      notes: `Payment failed: ${lastError}`,
    })
    .eq("id", existingPayment.id);

  if (updateError) {
    logStep("Failed to update payment status", { error: updateError.message });
    return;
  }

  logStep("Payment marked as failed", { id: existingPayment.id });

  // Optionally create a notification for the manager
  if (existingPayment.tenant_id) {
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("manager_id, user_id")
      .eq("id", existingPayment.tenant_id)
      .single();

    if (tenantData?.manager_id) {
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", tenantData.user_id)
        .single();

      const tenantName = profileData?.full_name || "A tenant";

      // Create notification for manager
      await supabaseAdmin.from("notifications").insert({
        user_id: tenantData.manager_id,
        type: "rent_received", // Using existing type, message indicates failure
        title: "Payment Failed",
        message: `${tenantName}'s ACH payment has failed. Please follow up.`,
        metadata: {
          payment_id: existingPayment.id,
          tenant_id: existingPayment.tenant_id,
          failure_reason: lastError,
        },
      });

      logStep("Manager notification created");
    }
  }
}

async function updateTenantBalance(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  tenantId: string,
  amountInDollars: number,
  paymentType: string,
  userId?: string
) {
  logStep("Updating tenant balance", { tenantId, amountInDollars });

  const { data: tenantData, error: tenantFetchError } = await supabaseAdmin
    .from("tenants")
    .select("current_balance")
    .eq("id", tenantId)
    .single();

  if (tenantFetchError) {
    logStep("Failed to fetch tenant balance", { error: tenantFetchError.message });
    return;
  }

  const previousBalance = tenantData?.current_balance || 0;
  const newBalance = previousBalance - amountInDollars;

  logStep("Balance update calculation", { previousBalance, amountInDollars, newBalance });

  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({ current_balance: newBalance })
    .eq("id", tenantId);

  if (updateError) {
    logStep("Failed to update balance", { error: updateError.message });
    return;
  }

  logStep("Balance updated successfully");

  // Insert balance adjustment record
  const { error: adjustmentError } = await supabaseAdmin
    .from("balance_adjustments")
    .insert({
      tenant_id: tenantId,
      adjustment_type: "payment",
      amount: amountInDollars,
      previous_balance: previousBalance,
      new_balance: newBalance,
      description: `Stripe ${paymentType} payment (ACH cleared)`,
      created_by: userId || null,
    });

  if (adjustmentError) {
    logStep("Failed to insert balance adjustment", { error: adjustmentError.message });
  } else {
    logStep("Balance adjustment recorded");
  }
}
