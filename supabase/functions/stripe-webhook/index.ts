import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

function extractStripeReferences(event: Stripe.Event) {
  const object = event.data.object as {
    id?: string;
    object?: string;
    payment_intent?: string | { id?: string } | null;
  };

  if (object.object === "checkout.session") {
    return {
      checkoutSessionId: object.id || null,
      paymentIntentId: typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.payment_intent?.id || null,
    };
  }

  if (object.object === "payment_intent") {
    return {
      checkoutSessionId: null,
      paymentIntentId: object.id || null,
    };
  }

  return { checkoutSessionId: null, paymentIntentId: null };
}

async function findPaymentIdForStripeReference(
  supabaseAdmin: SupabaseAdminClient,
  paymentIntentId: string | null,
  checkoutSessionId: string | null
) {
  if (!paymentIntentId && !checkoutSessionId) return null;

  const filters = [
    paymentIntentId ? `stripe_payment_intent_id.eq.${paymentIntentId}` : null,
    checkoutSessionId ? `stripe_session_id.eq.${checkoutSessionId}` : null,
  ].filter(Boolean).join(",");

  const { data } = await supabaseAdmin
    .from("payments")
    .select("id")
    .or(filters)
    .limit(1)
    .maybeSingle();

  return data?.id || null;
}

async function recordWebhookReceived(
  supabaseAdmin: SupabaseAdminClient,
  event: Stripe.Event
) {
  const { paymentIntentId, checkoutSessionId } = extractStripeReferences(event);

  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, retry_count")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("stripe_webhook_events")
      .update({
        event_type: event.type,
        livemode: event.livemode,
        api_version: event.api_version || null,
        status: "received",
        payment_intent_id: paymentIntentId,
        checkout_session_id: checkoutSessionId,
        retry_count: Number(existing.retry_count || 0) + 1,
        last_received_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", existing.id);

    if (error) {
      logStep("Failed to update webhook health row", { error: error.message, eventId: event.id });
    }

    return existing.id as string;
  }

  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      api_version: event.api_version || null,
      status: "received",
      payment_intent_id: paymentIntentId,
      checkout_session_id: checkoutSessionId,
    })
    .select("id")
    .single();

  if (error) {
    logStep("Failed to insert webhook health row", { error: error.message, eventId: event.id });
    return null;
  }

  return data.id as string;
}

async function markWebhookResult(
  supabaseAdmin: SupabaseAdminClient,
  webhookLogId: string | null,
  event: Stripe.Event,
  status: "processed" | "ignored"
) {
  if (!webhookLogId) return;

  const { paymentIntentId, checkoutSessionId } = extractStripeReferences(event);
  const paymentId = await findPaymentIdForStripeReference(supabaseAdmin, paymentIntentId, checkoutSessionId);

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status,
      payment_id: paymentId,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", webhookLogId);

  if (error) {
    logStep("Failed to mark webhook result", { error: error.message, webhookLogId, status });
  }
}

async function markWebhookFailed(
  supabaseAdmin: SupabaseAdminClient,
  webhookLogId: string | null,
  error: unknown
) {
  if (!webhookLogId) return;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const { error: updateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq("id", webhookLogId);

  if (updateError) {
    logStep("Failed to mark webhook failed", { error: updateError.message, webhookLogId });
  }
}

async function recordInvalidWebhookDelivery(
  supabaseAdmin: SupabaseAdminClient,
  message: string,
  bodyLength: number
) {
  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      event_type: "signature_verification_failed",
      status: "failed",
      error_message: message,
      metadata: { bodyLength },
    } as never);

  if (error) {
    logStep("Failed to record invalid webhook delivery", { error: error.message });
  }
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
      await recordInvalidWebhookDelivery(supabaseAdmin, message, body.length);
      return new Response(JSON.stringify({ error: `Webhook Error: ${message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Signature verified successfully", { type: event.type, id: event.id });

    const webhookLogId = await recordWebhookReceived(supabaseAdmin, event);
    let handled = true;

    // Handle the event
    try {
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
          handled = false;
          logStep("Unhandled event type", { type: event.type });
      }

      await markWebhookResult(supabaseAdmin, webhookLogId, event, handled ? "processed" : "ignored");
    } catch (handlerError) {
      await markWebhookFailed(supabaseAdmin, webhookLogId, handlerError);
      throw handlerError;
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
  supabaseAdmin: SupabaseAdminClient,
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
  supabaseAdmin: SupabaseAdminClient,
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
  supabaseAdmin: SupabaseAdminClient,
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
  supabaseAdmin: SupabaseAdminClient,
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

async function notifyTenantPaymentStatus(
  supabaseAdmin: SupabaseAdminClient,
  input: {
    tenantId: string | null;
    paymentId: string;
    amount: number;
    title: string;
    message: string;
    stripeStatus: string;
    source: string;
  }
) {
  if (!input.tenantId) return;

  try {
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("user_id")
      .eq("id", input.tenantId)
      .single();

    if (!tenantData?.user_id) return;

    const { data: existingNotification } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", tenantData.user_id)
      .eq("type", "rent_received")
      .eq("metadata->>payment_id", input.paymentId)
      .eq("metadata->>tenant_payment_status", input.stripeStatus)
      .limit(1)
      .maybeSingle();

    if (existingNotification?.id) {
      logStep("Tenant payment notification already exists", {
        paymentId: input.paymentId,
        stripeStatus: input.stripeStatus,
      });
      return;
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: tenantData.user_id,
      type: "rent_received",
      title: input.title,
      message: input.message,
      metadata: {
        tenant_id: input.tenantId,
        payment_id: input.paymentId,
        amount: input.amount,
        stripe_status: input.stripeStatus,
        tenant_payment_status: input.stripeStatus,
        source: input.source,
      },
    });

    logStep("Tenant payment notification created", {
      paymentId: input.paymentId,
      stripeStatus: input.stripeStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("Tenant payment notification unavailable", {
      paymentId: input.paymentId,
      error: message,
    });
  }
}

async function handlePaymentProcessing(
  supabaseAdmin: SupabaseAdminClient,
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
    await supabaseAdmin
      .from("payments")
      .update({ stripe_status: paymentIntent.status })
      .eq("id", existingPayment.id);

    logStep("Processing payment already recorded", { id: existingPayment.id, status: existingPayment.status });
    return;
  }

  const { tenantId, propertyId } = await resolvePaymentContext(supabaseAdmin, paymentIntent.metadata || {});

  const { data: processingPayment, error: insertError } = await supabaseAdmin
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
      stripe_status: paymentIntent.status,
      payment_type,
      notes: `${payment_type?.replace(/_/g, " ")} via ACH (processing)`,
    })
    .select("id")
    .single();

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

  await notifyTenantPaymentStatus(supabaseAdmin, {
    tenantId,
    paymentId: processingPayment.id,
    amount: baseAmountInDollars,
    title: "Payment Processing",
    message: `$${baseAmountInDollars.toFixed(2)} ACH payment was submitted to Stripe. ACH usually clears in 3-5 business days, and your balance will update when Stripe confirms it.`,
    stripeStatus: paymentIntent.status,
    source: "stripe_webhook",
  });
}

async function handlePaymentSucceeded(
  supabaseAdmin: SupabaseAdminClient,
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
        stripe_status: paymentIntent.status,
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
      await supabaseAdmin
        .from("payments")
        .update({ stripe_status: paymentIntent.status })
        .eq("id", existingPayment.id);
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
      stripe_status: paymentIntent.status,
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
          .update({ status: "completed", stripe_status: paymentIntent.status })
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

  await notifyPaymentCleared(supabaseAdmin, resolvedTenantId, newPayment.id, amountInDollars, payment_type);
}

async function notifyPaymentCleared(
  supabaseAdmin: SupabaseAdminClient,
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
    await supabaseAdmin.from("notifications").insert({
      user_id: tenantData.manager_id,
      type: "rent_received",
      title: "Payment Cleared",
      message: `$${amountInDollars.toFixed(2)} from ${tenantName} has cleared and the tenant ledger was updated.`,
      metadata: {
        amount: amountInDollars,
        payment_type: paymentType || "unknown",
        tenant: tenantName,
        tenant_id: tenantId,
        payment_id: paymentId,
      },
    });

    await sendDiscordNotificationIfEnabled(supabaseAdmin, tenantData.manager_id, {
      title: "Payment Cleared",
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

  await notifyTenantPaymentStatus(supabaseAdmin, {
    tenantId,
    paymentId,
    amount: amountInDollars,
    title: "Payment Cleared",
    message: `$${amountInDollars.toFixed(2)} payment was verified by Stripe and applied to your Sterling Gate ledger.`,
    stripeStatus: "succeeded",
    source: "stripe_webhook",
  });
}

async function handlePaymentFailed(
  supabaseAdmin: SupabaseAdminClient,
  paymentIntent: Stripe.PaymentIntent,
  fallbackReason = "Payment failed"
) {
  logStep("Processing payment_intent.payment_failed", { id: paymentIntent.id });

  const lastError = paymentIntent.last_payment_error?.message || fallbackReason;
  logStep("Payment failure reason", { reason: lastError });

  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id, tenant_id, amount, status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (!existingPayment) {
    logStep("No pending payment found to mark as failed; recording failed attempt");

    try {
      const { payment_type, lease_id } = paymentIntent.metadata || {};
      const { convenienceFeeInDollars, baseAmountInDollars } = getPaymentAmounts(paymentIntent);
      const { tenantId, propertyId } = await resolvePaymentContext(supabaseAdmin, paymentIntent.metadata || {});

      const { data: failedPayment, error: insertError } = await supabaseAdmin
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
          status: "failed",
          stripe_payment_intent_id: paymentIntent.id,
          stripe_status: paymentIntent.status,
          payment_type: payment_type || "balance",
          notes: `Stripe status: ${paymentIntent.status}; Payment failed: ${lastError}`,
        })
        .select("id, tenant_id, amount, status")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          logStep("Failed payment insert raced with another handler; skipping duplicate side effects", {
            paymentIntentId: paymentIntent.id,
          });
          return;
        }

        throw insertError;
      }

      logStep("Failed payment attempt recorded", { payment_id: failedPayment.id });
      await notifyFailedPaymentSideEffects(
        supabaseAdmin,
        failedPayment.tenant_id,
        failedPayment.id,
        failedPayment.amount,
        lastError,
        paymentIntent.status
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logStep("Unable to record failed payment attempt", { paymentIntentId: paymentIntent.id, error: message });
    }

    return;
  }

  if (existingPayment.status === "failed") {
    await supabaseAdmin
      .from("payments")
      .update({ stripe_status: paymentIntent.status, notes: `Stripe status: ${paymentIntent.status}; Payment failed: ${lastError}` })
      .eq("id", existingPayment.id);

    logStep("Payment already marked failed; skipping duplicate failure side effects", {
      id: existingPayment.id,
    });
    return;
  }

  if (existingPayment.status === "completed") {
    logStep("Ignoring failure event for already completed payment", {
      id: existingPayment.id,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("payments")
    .update({ 
      status: "failed",
      stripe_status: paymentIntent.status,
      notes: `Stripe status: ${paymentIntent.status}; Payment failed: ${lastError}`,
    })
    .eq("id", existingPayment.id);

  if (updateError) {
    logStep("Failed to update payment status", { error: updateError.message });
    return;
  }

  logStep("Payment marked as failed", { id: existingPayment.id });

  await notifyFailedPaymentSideEffects(
    supabaseAdmin,
    existingPayment.tenant_id,
    existingPayment.id,
    existingPayment.amount,
    lastError,
    paymentIntent.status
  );
}

async function notifyFailedPaymentSideEffects(
  supabaseAdmin: SupabaseAdminClient,
  tenantId: string | null,
  paymentId: string,
  amount: number,
  failureReason: string,
  stripeStatus = "payment_failed"
) {
  if (!tenantId) return;

  const { data: tenantData } = await supabaseAdmin
    .from("tenants")
    .select("manager_id, user_id")
    .eq("id", tenantId)
    .single();

  if (!tenantData) return;

  const { data: profileData } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", tenantData.user_id)
    .single();

  const tenantName = profileData?.full_name || "A tenant";

  const tenantTitle = stripeStatus === "requires_payment_method" ? "Payment Incomplete" : "Payment Failed";
  const tenantMessage = stripeStatus === "requires_payment_method"
    ? `$${Number(amount || 0).toFixed(2)} payment never completed in Stripe. No money moved, so please retry only if your balance is still due.`
    : `$${Number(amount || 0).toFixed(2)} payment did not clear in Stripe. Please retry or contact management if this looks wrong.`;

  await notifyTenantPaymentStatus(supabaseAdmin, {
    tenantId,
    paymentId,
    amount: Number(amount || 0),
    title: tenantTitle,
    message: tenantMessage,
    stripeStatus,
    source: "stripe_webhook",
  });

  if (!tenantData.manager_id) return;

  await supabaseAdmin.from("notifications").insert({
    user_id: tenantData.manager_id,
    type: "rent_received",
    title: stripeStatus === "requires_payment_method" ? "Payment Incomplete" : "Payment Failed",
    message: stripeStatus === "requires_payment_method"
      ? `${tenantName}'s payment was incomplete in Stripe. No money moved.`
      : `${tenantName}'s ACH payment has failed. Please follow up.`,
    metadata: {
      payment_id: paymentId,
      tenant_id: tenantId,
      failure_reason: failureReason,
      stripe_status: stripeStatus,
    },
  });

  logStep("Manager notification created");

  await sendDiscordNotificationIfEnabled(supabaseAdmin, tenantData.manager_id, {
    title: stripeStatus === "requires_payment_method" ? "Payment Incomplete" : "ACH Payment Failed",
    message: stripeStatus === "requires_payment_method"
      ? `${tenantName}'s payment of $${amount} was incomplete in Stripe. No money moved.`
      : `${tenantName}'s payment of $${amount} has failed: ${failureReason}`,
    type: "rent_received",
    metadata: {
      amount,
      tenant: tenantName,
      failure_reason: failureReason,
      stripe_status: stripeStatus,
      payment_id: paymentId,
    },
  });

  await applyLateFeeIfApplicable(supabaseAdmin, tenantId, tenantData.manager_id, tenantName);
}

async function applyLateFeeIfApplicable(
  supabaseAdmin: SupabaseAdminClient,
  tenantId: string,
  managerId: string,
  tenantName: string
) {
  logStep("Checking if late fee should be applied", { tenantId });

  const { data: tenantBalance } = await supabaseAdmin
    .from("tenants")
    .select("current_balance")
    .eq("id", tenantId)
    .single();

  const { data: pendingAchPayments } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("tenant_id", tenantId)
    .eq("status", "processing")
    .eq("payment_method_type", "ach")
    .in("payment_type", ["balance", "rent"]);

  const pendingAchTotal = (pendingAchPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const effectiveBalance = Math.max(Number(tenantBalance?.current_balance || 0) - pendingAchTotal, 0);

  if (effectiveBalance <= 0) {
    logStep("Skipping late fee because credit or pending ACH covers the tenant balance", {
      tenantId,
      current_balance: tenantBalance?.current_balance || 0,
      pendingAchTotal,
      effectiveBalance,
    });
    return;
  }

  const { data: rentCharges, error: rentChargeError } = await supabaseAdmin
    .from("rent_charges")
    .select("id, rent_period, rent_amount")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .eq("late_fee_applied", false)
    .eq("late_fee_waived", false)
    .order("rent_period", { ascending: true });

  if (rentChargeError) {
    logStep("Unable to load rent charges for late fee", { error: rentChargeError.message });
    return;
  }

  if (!rentCharges || rentCharges.length === 0) {
    logStep("No pending rent charges need a late fee; skipping duplicate failed-payment fee", { tenantId });
    return;
  }

  let totalLateFeeApplied = 0;
  const lateFeeDetails: string[] = [];

  for (const rentCharge of rentCharges) {
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("apply_rent_late_fee", {
      _rent_charge_id: rentCharge.id,
      _created_by: managerId,
    });

    if (rpcError) {
      logStep("Failed to apply rent-charge late fee", { rentChargeId: rentCharge.id, error: rpcError.message });
      continue;
    }

    const typedResult = result as { success?: boolean; late_fee?: number; error?: string; reason?: string } | null;
    if (typedResult?.success) {
      const fee = Number(typedResult.late_fee || 0);
      totalLateFeeApplied += fee;
      lateFeeDetails.push(`$${fee.toFixed(2)} for ${rentCharge.rent_period}`);
    } else {
      logStep("Late fee skipped by source-of-truth RPC", {
        rentChargeId: rentCharge.id,
        reason: typedResult?.reason,
        error: typedResult?.error,
      });
    }
  }

  if (totalLateFeeApplied > 0) {
    logStep("Late fee applied through rent-charge source of truth", { totalLateFeeApplied, details: lateFeeDetails });

    await supabaseAdmin.from("notifications").insert({
      user_id: managerId,
      type: "rent_received",
      title: "Late Fee Applied",
      message: `$${totalLateFeeApplied.toFixed(2)} late fee applied to ${tenantName}'s balance after failed payment`,
      metadata: {
        tenant_id: tenantId,
        late_fee: totalLateFeeApplied,
        details: lateFeeDetails,
      },
    });

    await sendDiscordNotificationIfEnabled(supabaseAdmin, managerId, {
      title: "💰 Late Fee Applied",
      message: `$${totalLateFeeApplied.toFixed(2)} late fee added to ${tenantName}'s balance`,
      type: "rent_received",
      metadata: {
        tenant: tenantName,
        late_fee: totalLateFeeApplied,
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
  supabaseAdmin: SupabaseAdminClient,
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
