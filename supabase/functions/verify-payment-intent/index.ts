import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type SupabaseAdminClient = ReturnType<typeof createClient>;
type PaymentNotificationType = "payment_received" | "payment_processing" | "payment_failed" | "payment_incomplete";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  payment_intent_id: string;
}

function getPaymentNotificationType(stripeStatus: string): PaymentNotificationType {
  const normalized = String(stripeStatus || "").toLowerCase();

  if (normalized === "succeeded" || normalized === "completed") return "payment_received";
  if (normalized === "processing" || normalized === "pending") return "payment_processing";
  if (
    normalized === "requires_payment_method" ||
    normalized === "requires_action" ||
    normalized === "requires_confirmation" ||
    normalized === "incomplete" ||
    normalized === "canceled" ||
    normalized === "cancelled"
  ) {
    return "payment_incomplete";
  }

  return "payment_failed";
}

async function applyCompletedPaymentToBalance(
  supabaseAdmin: SupabaseAdminClient,
  paymentId: string,
  paymentType: string | undefined,
  userId: string | undefined,
  convenienceFeeInDollars: number
) {
  if (paymentType !== 'balance' && paymentType !== 'rent') {
    return null;
  }

  const description = convenienceFeeInDollars > 0
    ? `Stripe ${paymentType} payment (embedded) - base amount, card fee: $${convenienceFeeInDollars.toFixed(2)}`
    : `Stripe ${paymentType} payment (embedded)`;

  const { data, error } = await supabaseAdmin.rpc('record_payment_balance_adjustment', {
    _payment_id: paymentId,
    _description: description,
    _created_by: userId || null,
  });

  if (error) {
    throw new Error(`Failed to apply payment to balance: ${error.message}`);
  }

  return data;
}

// Helper function to send Discord notification if enabled
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
    // Check if manager has Discord notifications enabled
    const { data: settings } = await supabaseAdmin
      .from('notification_settings')
      .select('discord_enabled, discord_webhook_url, notify_rent_received')
      .eq('user_id', managerId)
      .single();

    if (!settings?.discord_enabled || !settings?.discord_webhook_url || !settings?.notify_rent_received) {
      console.log('[VERIFY-PAYMENT-INTENT] Discord notifications not enabled for manager:', managerId);
      return;
    }

    // Call the send-discord-notification edge function
    const { error } = await supabaseAdmin.functions.invoke('send-discord-notification', {
      body: {
        webhook_url: settings.discord_webhook_url,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: notification.metadata,
      },
    });

    if (error) {
      console.error('[VERIFY-PAYMENT-INTENT] Failed to send Discord notification:', error);
    } else {
      console.log('[VERIFY-PAYMENT-INTENT] Discord notification sent successfully');
    }
  } catch (err) {
    console.error('[VERIFY-PAYMENT-INTENT] Error sending Discord notification:', err);
  }
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
      .from('tenants')
      .select('user_id')
      .eq('id', input.tenantId)
      .single();

    if (!tenantData?.user_id) return;

    const { data: existingNotification } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', tenantData.user_id)
      .eq('type', getPaymentNotificationType(input.stripeStatus))
      .eq('metadata->>payment_id', input.paymentId)
      .eq('metadata->>tenant_payment_status', input.stripeStatus)
      .limit(1)
      .maybeSingle();

    if (existingNotification?.id) return;

    await supabaseAdmin.from('notifications').insert({
      user_id: tenantData.user_id,
      type: getPaymentNotificationType(input.stripeStatus),
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
  } catch (err) {
    console.error('[VERIFY-PAYMENT-INTENT] Tenant payment notification unavailable:', err);
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
    console.log("[VERIFY-PAYMENT-INTENT] Function started");

    const body: VerifyRequest = await req.json();
    const { payment_intent_id } = body;

    if (!payment_intent_id) {
      throw new Error("payment_intent_id is required");
    }

    console.log("[VERIFY-PAYMENT-INTENT] Verifying PaymentIntent:", payment_intent_id);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");

    // Retrieve PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    console.log("[VERIFY-PAYMENT-INTENT] PaymentIntent status:", paymentIntent.status);
    console.log("[VERIFY-PAYMENT-INTENT] PaymentIntent metadata:", paymentIntent.metadata);

    // Get metadata
  const { payment_type, property_id, lease_id, tenant_id, user_id, convenience_fee: convenienceFeeStr } = paymentIntent.metadata || {};
  const amountPaid = paymentIntent.amount || 0;
  const amountInDollars = amountPaid / 100;
  
  // Calculate base amount (excluding convenience fee for card payments)
  const convenienceFee = parseInt(convenienceFeeStr || '0', 10);
  const convenienceFeeInDollars = convenienceFee / 100;
  const baseAmountInDollars = convenienceFee > 0 ? (amountInDollars - convenienceFeeInDollars) : amountInDollars;

  console.log("[VERIFY-PAYMENT-INTENT] Payment details:", { 
    payment_type, property_id, lease_id, tenant_id, 
    amountInDollars, convenienceFee, baseAmountInDollars 
  });

    if (!user_id) {
      console.error("[VERIFY-PAYMENT-INTENT] No user_id in metadata");
      throw new Error("Invalid payment: missing user information");
    }

    // Check if payment already recorded (idempotency) - check both fields.
    // If a previous ACH verification recorded it as processing and Stripe now says
    // succeeded, finish the same row instead of returning stale "processing".
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status, payment_type, tenant_id, amount, balance_adjustment_id')
      .or(`stripe_session_id.eq.${payment_intent_id},stripe_payment_intent_id.eq.${payment_intent_id}`)
      .limit(1)
      .maybeSingle();

    if (existingPayment) {
      console.log("[VERIFY-PAYMENT-INTENT] Payment already recorded:", existingPayment.id, "status:", existingPayment.status, "stripe:", paymentIntent.status);

      await supabaseAdmin
        .from('payments')
        .update({ stripe_status: paymentIntent.status })
        .eq('id', existingPayment.id);

      let currentStatus = existingPayment.status;

      if (paymentIntent.status === 'succeeded' && currentStatus !== 'completed') {
        const { error: updateError } = await supabaseAdmin
          .from('payments')
          .update({ status: 'completed', stripe_status: paymentIntent.status })
          .eq('id', existingPayment.id);

        if (updateError) {
          throw new Error(`Failed to mark payment completed: ${updateError.message}`);
        }

        currentStatus = 'completed';
      }

      if (paymentIntent.status === 'canceled' || paymentIntent.status === 'requires_payment_method') {
        const failedStatus = paymentIntent.status === 'canceled' ? 'canceled' : 'failed';
        await supabaseAdmin
          .from('payments')
          .update({ status: failedStatus, stripe_status: paymentIntent.status, notes: `Stripe status: ${paymentIntent.status}` })
          .eq('id', existingPayment.id);
        currentStatus = failedStatus;

        await notifyTenantPaymentStatus(supabaseAdmin, {
          tenantId: existingPayment.tenant_id,
          paymentId: existingPayment.id,
          amount: Number(existingPayment.amount || baseAmountInDollars || 0),
          title: paymentIntent.status === 'requires_payment_method' ? 'Payment Incomplete' : 'Payment Canceled',
          message: paymentIntent.status === 'requires_payment_method'
            ? `$${Number(existingPayment.amount || baseAmountInDollars || 0).toFixed(2)} payment never completed in Stripe. No money moved.`
            : `$${Number(existingPayment.amount || baseAmountInDollars || 0).toFixed(2)} payment was canceled before completion.`,
          stripeStatus: paymentIntent.status,
          source: 'verify_payment_intent',
        });
      }

      let balanceResult = null;
      if (paymentIntent.status === 'succeeded') {
        balanceResult = await applyCompletedPaymentToBalance(
          supabaseAdmin,
          existingPayment.id,
          payment_type || existingPayment.payment_type,
          user_id,
          convenienceFeeInDollars
        );

        await notifyTenantPaymentStatus(supabaseAdmin, {
          tenantId: existingPayment.tenant_id,
          paymentId: existingPayment.id,
          amount: Number(existingPayment.amount || baseAmountInDollars || 0),
          title: 'Payment Cleared',
          message: `$${Number(existingPayment.amount || baseAmountInDollars || 0).toFixed(2)} payment was verified by Stripe and applied to your Sterling Gate ledger.`,
          stripeStatus: paymentIntent.status,
          source: 'verify_payment_intent',
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: existingPayment.id,
        already_recorded: true,
        status: currentStatus,
        isProcessing: currentStatus === 'processing',
        balanceResult,
        amount: amountInDollars,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle ACH payments that are still processing
    if (paymentIntent.status === 'processing') {
      console.log("[VERIFY-PAYMENT-INTENT] ACH payment processing - recording as pending");
      
      // Resolve tenant and property IDs for pending payment record
      let resolvedTenantId = tenant_id;
      let resolvedPropertyId = property_id;

      if (!resolvedTenantId && lease_id) {
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

      // For balance payments, resolve from tenant
      if (resolvedTenantId && !resolvedPropertyId) {
        const { data: tenantData } = await supabaseAdmin
          .from('tenants')
          .select('property_id')
          .eq('id', resolvedTenantId)
          .single();
        
        if (tenantData?.property_id) {
          resolvedPropertyId = tenantData.property_id;
        }
      }

      // Fallback: Check tenant_properties table for multi-property tenants
      if (resolvedTenantId && !resolvedPropertyId) {
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

      if (!resolvedTenantId || !resolvedPropertyId) {
        throw new Error("Could not determine tenant or property for pending payment");
      }

      // Insert payment with 'processing' status - balance will be updated by webhook
      const { data: pendingPayment, error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          tenant_id: resolvedTenantId,
          property_id: resolvedPropertyId,
          lease_id: lease_id || null,
          amount: baseAmountInDollars,
          convenience_fee: convenienceFeeInDollars || 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'stripe',
          payment_method_type: 'ach',
          status: 'processing',
          stripe_payment_intent_id: payment_intent_id,
          stripe_status: paymentIntent.status,
          payment_type: payment_type,
          notes: `${payment_type?.replace(/_/g, ' ')} via ACH (processing)`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[VERIFY-PAYMENT-INTENT] Insert error for processing payment:", insertError);
        if (insertError.code === '23505') {
          const { data: racedPayment } = await supabaseAdmin
            .from('payments')
            .select('id, status')
            .eq('stripe_payment_intent_id', payment_intent_id)
            .maybeSingle();

          if (racedPayment) {
            return new Response(JSON.stringify({
              success: true,
              payment_id: racedPayment.id,
              already_recorded: true,
              status: racedPayment.status,
              isProcessing: racedPayment.status === 'processing',
              payment_type,
              amount: amountInDollars,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
        throw new Error(`Failed to record processing payment: ${insertError.message}`);
      }

      console.log("[VERIFY-PAYMENT-INTENT] Processing payment recorded:", pendingPayment.id);

      await notifyTenantPaymentStatus(supabaseAdmin, {
        tenantId: resolvedTenantId,
        paymentId: pendingPayment.id,
        amount: baseAmountInDollars,
        title: 'Payment Processing',
        message: `$${baseAmountInDollars.toFixed(2)} ACH payment was submitted to Stripe. ACH usually clears in 3-5 business days, and your balance will update when Stripe confirms it.`,
        stripeStatus: paymentIntent.status,
        source: 'verify_payment_intent',
      });

      // Send Discord notification for ACH payment initiated
      const { data: tenantNotifyData } = await supabaseAdmin
        .from('tenants')
        .select('manager_id, user_id')
        .eq('id', resolvedTenantId)
        .single();

      if (tenantNotifyData?.manager_id) {
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', tenantNotifyData.user_id)
          .single();

        const tenantName = profileData?.full_name || 'A tenant';

        await sendDiscordNotificationIfEnabled(supabaseAdmin, tenantNotifyData.manager_id, {
          title: 'ACH Payment Initiated',
          message: `$${amountInDollars.toFixed(2)} ACH payment from ${tenantName} is processing (typically clears in 3-5 business days)`,
          type: 'rent_received',
          metadata: {
            amount: amountInDollars,
            payment_type,
            tenant: tenantName,
            status: 'processing',
          },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: pendingPayment.id,
        status: 'processing',
        isProcessing: true,
        payment_type,
        amount: amountInDollars,
        message: 'Your ACH payment is being processed. It typically takes 4-5 business days to clear.',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For any other non-succeeded status, throw error
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    // Handle application fee payments differently - no tenant/balance updates needed
    if (payment_type === 'application_fee') {
      console.log("[VERIFY-PAYMENT-INTENT] Processing application fee payment");

      if (!property_id) {
        throw new Error("Missing property_id for application fee payment");
      }

      // Get the property to find the manager (we need property_id to insert payment)
      const { data: propertyData, error: propError } = await supabaseAdmin
        .from('properties')
        .select('manager_id')
        .eq('id', property_id)
        .single();

      if (propError) {
        console.error("[VERIFY-PAYMENT-INTENT] Could not find property:", propError);
        throw new Error("Invalid property for application fee");
      }

      // Check if there's an existing tenant record for this user
      let tenantIdForPayment: string | null = null;
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (existingTenant) {
        tenantIdForPayment = existingTenant.id;
      } else {
        // Create a temporary/placeholder tenant record for the applicant
        // This allows us to properly track application fee payments
        const { data: newTenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({
            user_id: user_id,
            manager_id: propertyData.manager_id,
            is_active: false, // Not an active tenant until application is approved
            notes: 'Created for application fee tracking',
          })
          .select()
          .single();

        if (tenantError) {
          console.error("[VERIFY-PAYMENT-INTENT] Could not create tenant record:", tenantError);
          throw new Error("Failed to create applicant record");
        }
        tenantIdForPayment = newTenant.id;
        console.log("[VERIFY-PAYMENT-INTENT] Created applicant tenant record:", newTenant.id);
      }

      // Record the payment
      const { data: newPayment, error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          tenant_id: tenantIdForPayment,
          property_id: property_id,
          lease_id: null,
          amount: amountInDollars,
          convenience_fee: convenienceFeeInDollars || 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'stripe',
          payment_method_type: paymentIntent.metadata?.payment_method_type || 'card',
          status: 'completed',
          stripe_payment_intent_id: payment_intent_id,
          stripe_status: paymentIntent.status,
          payment_type: 'application_fee',
          notes: 'Application fee via Stripe (embedded)',
        })
        .select()
        .single();

      if (insertError) {
        console.error("[VERIFY-PAYMENT-INTENT] Insert error for application fee:", insertError);
        if (insertError.code === '23505') {
          const { data: racedPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', payment_intent_id)
            .maybeSingle();

          if (racedPayment) {
            return new Response(JSON.stringify({
              success: true,
              payment_id: racedPayment.id,
              already_recorded: true,
              payment_type: 'application_fee',
              amount: amountInDollars,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
        throw new Error(`Failed to record application fee: ${insertError.message}`);
      }

      console.log("[VERIFY-PAYMENT-INTENT] Application fee payment recorded:", newPayment.id);

      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: newPayment.id,
        payment_type: 'application_fee',
        amount: amountInDollars,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For non-application_fee payments, proceed with normal flow
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
      
      // Fallback: Check tenant_properties table for multi-property tenants
      if (resolvedTenantId && !resolvedPropertyId) {
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
      
      if (!resolvedPropertyId) {
        console.error("[VERIFY-PAYMENT-INTENT] Still no property_id, cannot record payment");
        throw new Error("Could not determine property for payment record. Please ensure tenant has an assigned property.");
      }
    }

    // Insert payment record (succeeded status = card payment, record as completed)
    // Store the base amount as the payment amount (what actually reduces balance)
    const { data: newPayment, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        tenant_id: resolvedTenantId,
        property_id: resolvedPropertyId,
        lease_id: lease_id || null,
        amount: baseAmountInDollars,
        convenience_fee: convenienceFeeInDollars || 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'stripe',
        payment_method_type: paymentIntent.metadata?.payment_method_type || 'card',
        status: 'completed',
        stripe_payment_intent_id: payment_intent_id,
        stripe_status: paymentIntent.status,
        payment_type: payment_type,
        notes: convenienceFee > 0 
          ? `${payment_type?.replace(/_/g, ' ')} via Stripe (embedded) - card fee: $${convenienceFeeInDollars.toFixed(2)}`
          : `${payment_type?.replace(/_/g, ' ')} via Stripe (embedded)`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[VERIFY-PAYMENT-INTENT] Insert error:", insertError);
      if (insertError.code === '23505') {
        const { data: racedPayment } = await supabaseAdmin
          .from('payments')
          .select('id, status, payment_type')
          .eq('stripe_payment_intent_id', payment_intent_id)
          .maybeSingle();

        if (racedPayment) {
          if (racedPayment.status !== 'completed') {
            const { error: updateError } = await supabaseAdmin
              .from('payments')
              .update({ status: 'completed', stripe_status: paymentIntent.status })
              .eq('id', racedPayment.id);

            if (updateError) {
              throw new Error(`Failed to mark payment completed: ${updateError.message}`);
            }
          }

          const balanceResult = await applyCompletedPaymentToBalance(
            supabaseAdmin,
            racedPayment.id,
            payment_type || racedPayment.payment_type,
            user_id,
            convenienceFeeInDollars
          );

          return new Response(JSON.stringify({
            success: true,
            payment_id: racedPayment.id,
            already_recorded: true,
            payment_type,
            amount: amountInDollars,
            balanceResult,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      throw new Error(`Failed to record payment: ${insertError.message}`);
    }

    console.log("[VERIFY-PAYMENT-INTENT] Payment recorded:", newPayment.id);

    // Send Discord notification for card payment
    const { data: tenantNotifyData } = await supabaseAdmin
      .from('tenants')
      .select('manager_id, user_id')
      .eq('id', resolvedTenantId)
      .single();

    if (tenantNotifyData?.manager_id) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', tenantNotifyData.user_id)
        .single();

      const tenantName = profileData?.full_name || 'A tenant';

      await sendDiscordNotificationIfEnabled(supabaseAdmin, tenantNotifyData.manager_id, {
        title: 'Payment Received',
        message: `$${amountInDollars.toFixed(2)} received from ${tenantName}`,
        type: 'rent_received',
        metadata: {
          amount: amountInDollars,
          payment_type,
          tenant: tenantName,
        },
      });
    }

    const balanceResult = await applyCompletedPaymentToBalance(
      supabaseAdmin,
      newPayment.id,
      payment_type,
      user_id,
      convenienceFeeInDollars
    );

    await notifyTenantPaymentStatus(supabaseAdmin, {
      tenantId: resolvedTenantId,
      paymentId: newPayment.id,
      amount: baseAmountInDollars,
      title: 'Payment Cleared',
      message: `$${baseAmountInDollars.toFixed(2)} payment was verified by Stripe and applied to your Sterling Gate ledger.`,
      stripeStatus: paymentIntent.status,
      source: 'verify_payment_intent',
    });

    return new Response(JSON.stringify({ 
      success: true, 
      payment_id: newPayment.id,
      payment_type,
      amount: amountInDollars,
      balanceResult,
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
