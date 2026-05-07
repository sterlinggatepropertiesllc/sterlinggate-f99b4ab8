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

    logStep("Secrets loaded", { webhookSecretPrefix: webhookSecret.substring(0, 10) + "..." });

    // No hardcoded apiVersion — accept whatever Stripe sends
    const stripe = new Stripe(stripeKey);

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR: No stripe-signature header present");
      throw new Error("No Stripe signature found");
    }

    logStep("Verifying webhook signature", { signaturePrefix: signature.substring(0, 30) + "..." });

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logStep("SIGNATURE VERIFICATION FAILED", { 
        error: message,
        bodyLength: body.length,
        signaturePresent: !!signature,
        webhookSecretPrefix: webhookSecret.substring(0, 10) + "...",
      });
      return new Response(JSON.stringify({ error: `Webhook Error: ${message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Signature verified successfully", { type: event.type, id: event.id });

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(stripe, supabaseAdmin, session);
        break;
      }
      case "payment_intent.processing": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentProcessing(supabaseAdmin, paymentIntent);
        break;
      }
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
      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabaseAdmin, paymentIntent, "Payment canceled");
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

async function sendDiscordNotificationIfEnabled(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  managerId: string,
  notification: {
    title: string;
    message: string;
    type: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("notification_settings")
      .select("discord_webhook_url, discord_enabled, notify_rent_received")
      .eq("user_id", managerId)
      .single();

    if (settingsError) {
      logStep("No notification settings found for manager", { managerId });
      return;
    }

    if (!settings?.discord_enabled || !settings?.discord_webhook_url || !settings?.notify_rent_received) {
      logStep("Discord notifications not enabled or rent notifications disabled");
      return;
    }

    logStep("Sending Discord notification", { title: notification.title });

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-discord-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          webhook_url: settings.discord_webhook_url,
          ...notification,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logStep("Discord notification failed", { status: response.status, error: errorText });
    } else {
      logStep("Discord notification sent successfully");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep("Failed to send Discord notification", { error: errorMessage });
  }
}

function getPaymentAmounts(paymentIntent: Stripe.PaymentIntent) {
  const amountInDollars = (paymentIntent.amount || 0) / 100;
  const convenienceFeeCents = parseInt(paymentIntent.metadata?.convenience_fee || "0", 10) || 0;
  const convenienceFeeInDollars = convenienceFeeCents / 100;
  const baseAmountInDollars = convenienceFeeCents > 0
    ? amountInDollars - convenienceFeeInDollars
    : amountInDollars;

  return { amountInDollars, convenienceFeeInDollars, baseAmountInDollars };
}

async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  session: Stripe.Checkout.Session
) {
  logStep("Processing checkout.session.completed", {
    id: session.id,
    payment_status: session.payment_status,
    payment_intent: session.payment_intent,
  });

  if (!session.payment_intent) {
    logStep("Checkout session has no PaymentIntent, skipping", { id: session.id });
    return;
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === "processing") {
    await handlePaymentProcessing(supabaseAdmin, paymentIntent, session.id);
    return;
  }

  if (paymentIntent.status === "succeeded") {
    await handlePaymentSucceeded(supabaseAdmin, paymentIntent, session.id);
    return;
  }

  logStep("Checkout PaymentIntent not ready to record", {
    session_id: session.id,
    payment_intent_id: paymentIntent.id,
    status: paymentIntent.status,
  });
}

async function ensureApplicantTenant(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  propertyId: string,
  userId: string
) {
  const { data: existingTenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTenant?.id) {
    return existingTenant.id;
  }

  const { data: propertyData, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("manager_id")
    .eq("id", propertyId)
    .single();

  if (propertyError || !propertyData?.manager_id) {
    throw new Error("Unable to resolve property manager for application payment");
  }

  const { data: newTenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .insert({
      user_id: userId,
      manager_id: propertyData.manager_id,
      is_active: false,
      notes: "Created for application fee tracking",
    })
    .select("id")
    .single();

  if (tenantError || !newTenant?.id) {
    throw new Error(`Failed to create applicant tenant record: ${tenantError?.message || "unknown error"}`);
  }

  return newTenant.id;
}

async function resolvePaymentContext(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  metadata: Stripe.Metadata
) {
  const { payment_type, property_id, lease_id, tenant_id, user_id } = metadata || {};
  let resolvedTenantId = tenant_id || null;
  let resolvedPropertyId = property_id || null;

  if (payment_type === "application_fee") {
    if (!resolvedPropertyId || !user_id) {
      throw new Error("Application fee payment missing property_id or user_id metadata");
    }

    return {
      tenantId: await ensureApplicantTenant(supabaseAdmin, resolvedPropertyId, user_id),
      propertyId: resolvedPropertyId,
    };
  }

  if (!resolvedTenantId && lease_id) {
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
        .maybeSingle();

      resolvedTenantId = tenantRecord?.id || null;
      resolvedPropertyId = leaseData.property_id || resolvedPropertyId;
    }
  }

  if (resolvedTenantId && !resolvedPropertyId) {
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("property_id")
      .eq("id", resolvedTenantId)
      .single();

    resolvedPropertyId = tenantData?.property_id || null;
  }

  if (resolvedTenantId && !resolvedPropertyId) {
    const { data: tenantProperty } = await supabaseAdmin
      .from("tenant_properties")
      .select("property_id")
      .eq("tenant_id", resolvedTenantId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedPropertyId = tenantProperty?.property_id || null;
  }

  if (!resolvedTenantId || !resolvedPropertyId) {
    throw new Error(`Could not resolve tenant/property for payment: ${JSON.stringify({ resolvedTenantId, resolvedPropertyId, payment_type })}`);
  }

  return { tenantId: resolvedTenantId, propertyId: resolvedPropertyId };
}

async function handlePaymentProcessing(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  paymentIntent: Stripe.PaymentIntent,
  checkoutSessionId?: string
) {
  logStep("Processing payment_intent.processing", { id: paymentIntent.id, checkoutSessionId });

  const { payment_type, lease_id } = paymentIntent.metadata || {};
  const { amountInDollars, convenienceFeeInDollars, baseAmountInDollars } = getPaymentAmounts(paymentIntent);

  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .or(`stripe_payment_intent_id.eq.${paymentIntent.id}${checkoutSessionId ? `,stripe_session_id.eq.${checkoutSessionId}` : ""}`)
    .limit(1)
    .maybeSingle();

  if (existingPayment) {
    logStep("Processing payment already recorded", { id: existingPayment.id, status: existingPayment.status });
    return;
  }

  const { tenantId, propertyId } = await resolvePaymentContext(supabaseAdmin, paymentIntent.metadata || {});

  const { error: insertError } = await supabaseAdmin
    .from("payments")
    .insert({
      tenant_id: tenantId,
      property_id: propertyId,
      lease_id: lease_id || null,
      amount: baseAmountInDollars,
      convenience_fee: convenienceFeeInDollars || 0,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "stripe",
      payment_method_type: paymentIntent.metadata?.payment_method_type || "ach",
      status: "processing",
      stripe_payment_intent_id: paymentIntent.id,
      stripe_session_id: checkoutSessionId || null,
      payment_type,
      notes: `${payment_type?.replace(/_/g, " ")} via ACH (processing)`,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      logStep("Processing payment insert raced with another handler; treating as already recorded", {
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    throw new Error(`Failed to record processing payment: ${insertError.message}`);
  }

  logStep("Processing payment recorded", { paymentIntentId: paymentIntent.id, amountInDollars });
}

async function handlePaymentSucceeded(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  paymentIntent: Stripe.PaymentIntent,
  checkoutSessionId?: string
) {
  logStep("Processing payment_intent.succeeded", { id: paymentIntent.id, checkoutSessionId });

  const { payment_type, lease_id, user_id } = paymentIntent.metadata || {};
  const { amountInDollars, convenienceFeeInDollars, baseAmountInDollars } = getPaymentAmounts(paymentIntent);

  logStep("Payment details", { payment_type, amountInDollars, convenienceFeeInDollars, baseAmountInDollars });

  // Check if payment already recorded (idempotency)
  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id, status, tenant_id, property_id, payment_type, balance_adjustment_id")
    .or(`stripe_payment_intent_id.eq.${paymentIntent.id}${checkoutSessionId ? `,stripe_session_id.eq.${checkoutSessionId}` : ""}`)
    .limit(1)
    .maybeSingle();

  if (existingPayment) {
    if (existingPayment.status !== "completed") {
      logStep("Payment clearing - updating status to completed", { id: existingPayment.id });

      const paymentUpdate: Record<string, unknown> = {
        status: "completed",
      };

      if (checkoutSessionId) {
        paymentUpdate.stripe_session_id = checkoutSessionId;
      }

      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update(paymentUpdate)
        .eq("id", existingPayment.id);

      if (updateError) {
        throw new Error(`Failed to update payment status: ${updateError.message}`);
      }
    } else {
      logStep("Payment already completed", { id: existingPayment.id });
    }

    if (payment_type === "balance" || payment_type === "rent" || existingPayment.payment_type === "balance" || existingPayment.payment_type === "rent") {
      await applyBalanceViaRPC(
        supabaseAdmin,
        existingPayment.id,
        payment_type || existingPayment.payment_type || "payment",
        user_id,
        convenienceFeeInDollars
      );
    }

    if (existingPayment.status !== "completed") {
      await notifyPaymentCleared(supabaseAdmin, existingPayment.tenant_id, existingPayment.id, amountInDollars, payment_type);
    }

    return;
  }

  logStep("No existing payment found, creating new record");

  const { tenantId: resolvedTenantId, propertyId: resolvedPropertyId } = await resolvePaymentContext(
    supabaseAdmin,
    paymentIntent.metadata || {}
  );

  const { data: newPayment, error: insertError } = await supabaseAdmin
    .from("payments")
    .insert({
      tenant_id: resolvedTenantId,
      property_id: resolvedPropertyId,
      lease_id: lease_id || null,
      amount: baseAmountInDollars,
      convenience_fee: convenienceFeeInDollars || 0,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "stripe",
      payment_method_type: paymentIntent.metadata?.payment_method_type || "card",
      status: "completed",
      stripe_payment_intent_id: paymentIntent.id,
      stripe_session_id: checkoutSessionId || null,
      payment_type: payment_type,
      notes: convenienceFeeInDollars > 0
        ? `${payment_type?.replace(/_/g, " ")} via Stripe webhook - card fee: $${convenienceFeeInDollars.toFixed(2)}`
        : `${payment_type?.replace(/_/g, " ")} via Stripe webhook`,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      logStep("Completed payment insert raced with another handler; loading existing record", {
        paymentIntentId: paymentIntent.id,
        checkoutSessionId,
      });

      const { data: racedPayment, error: raceLookupError } = await supabaseAdmin
        .from("payments")
        .select("id, status, tenant_id, payment_type")
        .or(`stripe_payment_intent_id.eq.${paymentIntent.id}${checkoutSessionId ? `,stripe_session_id.eq.${checkoutSessionId}` : ""}`)
        .limit(1)
        .maybeSingle();

      if (raceLookupError || !racedPayment) {
        throw new Error(`Payment insert collided but existing row was not found: ${raceLookupError?.message || "not found"}`);
      }

      if (racedPayment.status !== "completed") {
        const { error: updateError } = await supabaseAdmin
          .from("payments")
          .update({ status: "completed" })
          .eq("id", racedPayment.id);

        if (updateError) {
          throw new Error(`Failed to complete raced payment: ${updateError.message}`);
        }
      }

      if (payment_type === "balance" || payment_type === "rent" || racedPayment.payment_type === "balance" || racedPayment.payment_type === "rent") {
        await applyBalanceViaRPC(
          supabaseAdmin,
          racedPayment.id,
          payment_type || racedPayment.payment_type || "payment",
          user_id,
          convenienceFeeInDollars
        );
      }

      return;
    }

    throw new Error(`Failed to insert payment: ${insertError.message}`);
  }

  logStep("Payment recorded via webhook", { payment_id: newPayment.id });

  if (payment_type === "balance" || payment_type === "rent") {
    await applyBalanceViaRPC(
      supabaseAdmin,
      newPayment.id,
      payment_type,
      user_id,
      convenienceFeeInDollars
    );
  }
}

async function notifyPaymentCleared(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  tenantId: string,
  paymentId: string,
  amountInDollars: number,
  paymentType?: string
) {
  const { data: tenantData } = await supabaseAdmin
    .from("tenants")
    .select("manager_id, user_id")
    .eq("id", tenantId)
    .single();

  let tenantName = "tenant";
  if (tenantData?.user_id) {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", tenantData.user_id)
      .single();
    tenantName = profileData?.full_name || "tenant";
  }

  if (tenantData?.manager_id) {
    await sendDiscordNotificationIfEnabled(supabaseAdmin, tenantData.manager_id, {
      title: "ACH Payment Cleared",
      message: `$${amountInDollars.toFixed(2)} from ${tenantName} has cleared`,
      type: "rent_received",
      metadata: {
        amount: amountInDollars,
        payment_type: paymentType || "unknown",
        tenant: tenantName,
        payment_id: paymentId,
      },
    });
  }
}

async function handlePaymentFailed(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  paymentIntent: Stripe.PaymentIntent,
  fallbackReason = "Payment failed"
) {
  logStep("Processing payment_intent.payment_failed", { id: paymentIntent.id });

  const lastError = paymentIntent.last_payment_error?.message || fallbackReason;
  logStep("Payment failure reason", { reason: lastError });

  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id, tenant_id, amount")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (!existingPayment) {
    logStep("No pending payment found to mark as failed");
    return;
  }

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

      await supabaseAdmin.from("notifications").insert({
        user_id: tenantData.manager_id,
        type: "rent_received",
        title: "Payment Failed",
        message: `${tenantName}'s ACH payment has failed. Please follow up.`,
        metadata: {
          payment_id: existingPayment.id,
          tenant_id: existingPayment.tenant_id,
          failure_reason: lastError,
        },
      });

      logStep("Manager notification created");

      await sendDiscordNotificationIfEnabled(supabaseAdmin, tenantData.manager_id, {
        title: "⚠️ ACH Payment Failed",
        message: `${tenantName}'s payment of $${existingPayment.amount} has failed: ${lastError}`,
        type: "rent_received",
        metadata: {
          amount: existingPayment.amount,
          tenant: tenantName,
          failure_reason: lastError,
          payment_id: existingPayment.id,
        },
      });

      await applyLateFeeIfApplicable(supabaseAdmin, existingPayment.tenant_id, tenantData.manager_id, tenantName);
    }
  }
}

async function applyLateFeeIfApplicable(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  tenantId: string,
  managerId: string,
  tenantName: string
) {
  logStep("Checking if late fee should be applied", { tenantId });

  const today = new Date();
  const currentDay = today.getDate();

  const { data: tenantProperties, error: tpError } = await supabaseAdmin
    .from("tenant_properties")
    .select(`
      id,
      property_id,
      rent_amount,
      rent_due_day,
      grace_period_days,
      late_fee_type,
      late_fee_percentage,
      late_fee_flat_amount,
      property:properties(address)
    `)
    .eq("tenant_id", tenantId);

  if (tpError || !tenantProperties || tenantProperties.length === 0) {
    logStep("No tenant properties found for late fee calculation", { error: tpError?.message });
    return;
  }

  let totalLateFee = 0;
  const lateFeeDetails: string[] = [];

  for (const tp of tenantProperties) {
    const rentDueDay = tp.rent_due_day || 1;
    const gracePeriodDays = tp.grace_period_days || 5;
    const graceEndDay = rentDueDay + gracePeriodDays;

    if (currentDay > graceEndDay) {
      const rentAmount = tp.rent_amount || 0;
      let lateFee = 0;

      if (tp.late_fee_type === "percentage") {
        const percentage = tp.late_fee_percentage || 5;
        lateFee = rentAmount * (percentage / 100);
      } else if (tp.late_fee_type === "flat") {
        lateFee = tp.late_fee_flat_amount || 0;
      } else {
        lateFee = rentAmount * 0.05;
      }

      if (lateFee > 0) {
        totalLateFee += lateFee;
        // deno-lint-ignore no-explicit-any
        const propertyAddress = (tp.property as any)?.address || "Unknown property";
        lateFeeDetails.push(`$${lateFee.toFixed(2)} for ${propertyAddress}`);
      }
    }
  }

  if (totalLateFee > 0) {
    logStep("Applying total late fee via RPC", { totalLateFee, details: lateFeeDetails });

    const { error: rpcError } = await supabaseAdmin.rpc("apply_balance_adjustment", {
      _tenant_id: tenantId,
      _adjustment_type: "late_fee",
      _amount: totalLateFee,
      _description: `Late fee applied after failed ACH payment: ${lateFeeDetails.join(", ")}`,
    });

    if (rpcError) {
      logStep("Failed to apply late fee", { error: rpcError.message });
      return;
    }

    logStep("Late fee applied successfully", { totalLateFee });

    await supabaseAdmin.from("notifications").insert({
      user_id: managerId,
      type: "rent_received",
      title: "Late Fee Applied",
      message: `$${totalLateFee.toFixed(2)} late fee applied to ${tenantName}'s balance after failed payment`,
      metadata: {
        tenant_id: tenantId,
        late_fee: totalLateFee,
        details: lateFeeDetails,
      },
    });

    await sendDiscordNotificationIfEnabled(supabaseAdmin, managerId, {
      title: "💰 Late Fee Applied",
      message: `$${totalLateFee.toFixed(2)} late fee added to ${tenantName}'s balance`,
      type: "rent_received",
      metadata: {
        tenant: tenantName,
        late_fee: totalLateFee,
        details: lateFeeDetails,
      },
    });
  }
}

/**
 * Centralized idempotent payment-to-balance application.
 * The RPC locks the payment row and refuses to apply the same payment twice.
 */
async function applyBalanceViaRPC(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  paymentId: string,
  paymentType: string,
  userId?: string,
  convenienceFeeInDollars?: number
) {
  const description = convenienceFeeInDollars && convenienceFeeInDollars > 0
    ? `Stripe ${paymentType} payment - base amount, card fee: $${convenienceFeeInDollars.toFixed(2)}`
    : `Stripe ${paymentType} payment`;

  logStep("Applying balance via RPC", { paymentId, description });

  const { data, error } = await supabaseAdmin.rpc("record_payment_balance_adjustment", {
    _payment_id: paymentId,
    _description: description,
    _created_by: userId || null,
  });

  if (error) {
    logStep("RPC record_payment_balance_adjustment failed", { error: error.message });
    throw new Error(`Failed to apply payment to balance: ${error.message}`);
  }

  logStep("Balance application result", { result: data });
}
