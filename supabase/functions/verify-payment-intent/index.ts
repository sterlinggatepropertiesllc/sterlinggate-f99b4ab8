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

// Helper function to send Discord notification if enabled
async function sendDiscordNotificationIfEnabled(
  supabaseAdmin: any,
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

    // Check if payment already recorded (idempotency) - check both fields
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .or(`stripe_session_id.eq.${payment_intent_id},stripe_payment_intent_id.eq.${payment_intent_id}`)
      .limit(1)
      .single();

    if (existingPayment) {
      console.log("[VERIFY-PAYMENT-INTENT] Payment already recorded:", existingPayment.id, "status:", existingPayment.status);
      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: existingPayment.id,
        already_recorded: true,
        status: existingPayment.status,
        isProcessing: existingPayment.status === 'processing',
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
          amount: amountInDollars,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'stripe',
          payment_method_type: 'ach',
          status: 'processing',
          stripe_payment_intent_id: payment_intent_id,
          payment_type: payment_type,
          notes: `${payment_type?.replace(/_/g, ' ')} via ACH (processing)`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[VERIFY-PAYMENT-INTENT] Insert error for processing payment:", insertError);
        throw new Error(`Failed to record processing payment: ${insertError.message}`);
      }

      console.log("[VERIFY-PAYMENT-INTENT] Processing payment recorded:", pendingPayment.id);

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
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'stripe',
          status: 'completed',
          stripe_session_id: payment_intent_id,
          payment_type: 'application_fee',
          notes: 'Application fee via Stripe (embedded)',
        })
        .select()
        .single();

      if (insertError) {
        console.error("[VERIFY-PAYMENT-INTENT] Insert error for application fee:", insertError);
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
        convenience_fee: convenienceFee > 0 ? convenienceFee : null,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'stripe',
        payment_method_type: 'card',
        status: 'completed',
        stripe_payment_intent_id: payment_intent_id,
        payment_type: payment_type,
        notes: convenienceFee > 0 
          ? `${payment_type?.replace(/_/g, ' ')} via Stripe (embedded) - card fee: $${convenienceFeeInDollars.toFixed(2)}`
          : `${payment_type?.replace(/_/g, ' ')} via Stripe (embedded)`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[VERIFY-PAYMENT-INTENT] Insert error:", insertError);
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
        // Use baseAmountInDollars for balance reduction (excludes card fee)
        const newBalance = previousBalance - baseAmountInDollars;

        console.log("[VERIFY-PAYMENT-INTENT] Balance update:", { previousBalance, baseAmountInDollars, newBalance, convenienceFee });

        const { error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ current_balance: newBalance })
          .eq('id', resolvedTenantId);

        if (updateError) {
          console.error("[VERIFY-PAYMENT-INTENT] Failed to update balance:", updateError);
        } else {
          console.log("[VERIFY-PAYMENT-INTENT] Balance updated successfully");

          // Insert balance adjustment record with base amount
          const { error: adjustmentError } = await supabaseAdmin
            .from('balance_adjustments')
            .insert({
              tenant_id: resolvedTenantId,
              adjustment_type: 'payment',
              amount: baseAmountInDollars,
              previous_balance: previousBalance,
              new_balance: newBalance,
              description: convenienceFee > 0 
                ? `Stripe ${payment_type} payment (embedded) - base amount, card fee: $${convenienceFeeInDollars.toFixed(2)}`
                : `Stripe ${payment_type} payment (embedded)`,
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
