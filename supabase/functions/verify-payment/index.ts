import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  session_id: string;
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
    ? `Stripe ${paymentType} payment - base amount, card fee: $${convenienceFeeInDollars.toFixed(2)}`
    : `Stripe ${paymentType} payment`;

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
      .eq('type', 'rent_received')
      .eq('metadata->>payment_id', input.paymentId)
      .eq('metadata->>tenant_payment_status', input.stripeStatus)
      .limit(1)
      .maybeSingle();

    if (existingNotification?.id) return;

    await supabaseAdmin.from('notifications').insert({
      user_id: tenantData.user_id,
      type: 'rent_received',
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
    console.error('[VERIFY-PAYMENT] Tenant payment notification unavailable:', err);
  }
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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent'],
    });

    console.log("[VERIFY-PAYMENT] Session status:", session.payment_status);
    console.log("[VERIFY-PAYMENT] Session metadata:", session.metadata);

    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;
    const paymentIntentStatus = typeof session.payment_intent === 'string'
      ? session.payment_status === 'paid' ? 'succeeded' : session.payment_status
      : session.payment_intent?.status || (session.payment_status === 'paid' ? 'succeeded' : session.payment_status);

    // Get user_id from session metadata (set during checkout creation by authenticated user)
    const userId = session.metadata?.user_id;
    if (!userId) {
      console.error("[VERIFY-PAYMENT] No user_id in session metadata");
      throw new Error("Invalid session: missing user information");
    }
    
    console.log("[VERIFY-PAYMENT] User from metadata:", userId);

    // Extract metadata
    const { payment_type, property_id, lease_id, tenant_id, convenience_fee: convenienceFeeStr, base_amount: baseAmountStr, payment_method_type } = session.metadata || {};
    const amountPaid = session.amount_total || 0;
    const amountInDollars = amountPaid / 100;
    const convenienceFeeCents = parseInt(convenienceFeeStr || '0', 10) || 0;
    const convenienceFeeInDollars = convenienceFeeCents / 100;
    const baseAmountInDollars = baseAmountStr
      ? (parseInt(baseAmountStr, 10) || 0) / 100
      : amountInDollars - convenienceFeeInDollars;

    console.log("[VERIFY-PAYMENT] Payment details:", { payment_type, property_id, lease_id, tenant_id, amountInDollars, baseAmountInDollars, convenienceFeeInDollars, paymentIntentId });

    // Check if payment already recorded (idempotency)
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status, payment_type, tenant_id, amount, balance_adjustment_id')
      .or(`stripe_session_id.eq.${session_id}${paymentIntentId ? `,stripe_payment_intent_id.eq.${paymentIntentId}` : ''}`)
      .limit(1)
      .maybeSingle();

    if (existingPayment) {
      console.log("[VERIFY-PAYMENT] Payment already recorded:", existingPayment.id);

      if (existingPayment.status !== 'completed') {
        const paymentUpdate: Record<string, unknown> = {
          status: 'completed',
          stripe_session_id: session_id,
          stripe_status: paymentIntentStatus,
        };

        if (paymentIntentId) {
          paymentUpdate.stripe_payment_intent_id = paymentIntentId;
        }

        const { error: updateError } = await supabaseAdmin
          .from('payments')
          .update(paymentUpdate)
          .eq('id', existingPayment.id);

        if (updateError) {
          throw new Error(`Failed to mark payment completed: ${updateError.message}`);
        }
      }
      else {
        await supabaseAdmin
          .from('payments')
          .update({ stripe_status: paymentIntentStatus })
          .eq('id', existingPayment.id);
      }

      const balanceResult = await applyCompletedPaymentToBalance(
        supabaseAdmin,
        existingPayment.id,
        payment_type || existingPayment.payment_type,
        userId,
        convenienceFeeInDollars
      );

      await notifyTenantPaymentStatus(supabaseAdmin, {
        tenantId: existingPayment.tenant_id,
        paymentId: existingPayment.id,
        amount: Number(existingPayment.amount || baseAmountInDollars || 0),
        title: 'Payment Cleared',
        message: `$${Number(existingPayment.amount || baseAmountInDollars || 0).toFixed(2)} payment was verified by Stripe and applied to your Sterling Gate ledger.`,
        stripeStatus: paymentIntentStatus,
        source: 'verify_payment',
      });

      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: existingPayment.id,
        already_recorded: true,
        balanceResult,
        amount: amountInDollars,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
        amount: baseAmountInDollars,
        convenience_fee: convenienceFeeInDollars || 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'stripe',
        payment_method_type: payment_method_type || null,
        status: 'completed',
        stripe_session_id: session_id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_status: paymentIntentStatus,
        payment_type: payment_type,
        notes: convenienceFeeInDollars > 0
          ? `${payment_type?.replace(/_/g, ' ')} via Stripe - card fee: $${convenienceFeeInDollars.toFixed(2)}`
          : `${payment_type?.replace(/_/g, ' ')} via Stripe`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[VERIFY-PAYMENT] Insert error:", insertError);
      if (insertError.code === '23505') {
        const { data: racedPayment } = await supabaseAdmin
          .from('payments')
          .select('id, status, payment_type')
          .or(`stripe_session_id.eq.${session_id}${paymentIntentId ? `,stripe_payment_intent_id.eq.${paymentIntentId}` : ''}`)
          .limit(1)
          .maybeSingle();

        if (racedPayment) {
          if (racedPayment.status !== 'completed') {
            const paymentUpdate: Record<string, unknown> = {
              status: 'completed',
              stripe_session_id: session_id,
              stripe_status: paymentIntentStatus,
            };

            if (paymentIntentId) {
              paymentUpdate.stripe_payment_intent_id = paymentIntentId;
            }

            const { error: updateError } = await supabaseAdmin
              .from('payments')
              .update(paymentUpdate)
              .eq('id', racedPayment.id);

            if (updateError) {
              throw new Error(`Failed to mark payment completed: ${updateError.message}`);
            }
          }

          const balanceResult = await applyCompletedPaymentToBalance(
            supabaseAdmin,
            racedPayment.id,
            payment_type || racedPayment.payment_type,
            userId,
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

    console.log("[VERIFY-PAYMENT] Payment recorded:", newPayment.id);

    const balanceResult = await applyCompletedPaymentToBalance(
      supabaseAdmin,
      newPayment.id,
      payment_type,
      userId,
      convenienceFeeInDollars
    );

    await notifyTenantPaymentStatus(supabaseAdmin, {
      tenantId: resolvedTenantId,
      paymentId: newPayment.id,
      amount: baseAmountInDollars,
      title: 'Payment Cleared',
      message: `$${baseAmountInDollars.toFixed(2)} payment was verified by Stripe and applied to your Sterling Gate ledger.`,
      stripeStatus: paymentIntentStatus,
      source: 'verify_payment',
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
    console.error("[VERIFY-PAYMENT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
