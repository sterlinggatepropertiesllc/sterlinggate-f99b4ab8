import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECONCILE-ACH] ${step}${detailsStr}`);
};

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
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    // Verify caller is a property manager
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "property_manager")
      .single();

    if (!roleData) throw new Error("Only property managers can reconcile payments");

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    logStep("Starting reconciliation", { tenant_id, requested_by: userData.user.id });

    // Find all "processing" payments for this tenant with stripe payment intent IDs
    const { data: processingPayments, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("id, amount, stripe_payment_intent_id, payment_type, tenant_id, convenience_fee")
      .eq("tenant_id", tenant_id)
      .eq("status", "processing")
      .not("stripe_payment_intent_id", "is", null);

    if (fetchError) throw new Error(`Failed to fetch payments: ${fetchError.message}`);

    if (!processingPayments || processingPayments.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No processing payments found", 
        updated: 0, 
        failed: 0,
        details: [] 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${processingPayments.length} processing payments to check`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let updated = 0;
    let failed = 0;
    const details: Array<{ payment_id: string; amount: number; stripe_status: string; action: string }> = [];

    for (const payment of processingPayments) {
      try {
        logStep("Checking payment intent", { 
          payment_id: payment.id, 
          pi: payment.stripe_payment_intent_id 
        });

        const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id!);
        logStep("Stripe status", { pi_id: pi.id, status: pi.status });

        if (pi.status === "succeeded") {
          // Update payment to completed
          const { error: updateError } = await supabaseAdmin
            .from("payments")
            .update({ status: "completed" })
            .eq("id", payment.id);

          if (updateError) {
            logStep("Failed to update payment", { error: updateError.message });
            failed++;
            details.push({ 
              payment_id: payment.id, 
              amount: payment.amount, 
              stripe_status: "succeeded", 
              action: `update_failed: ${updateError.message}` 
            });
            continue;
          }

          // Apply balance adjustment (payment reduces balance)
          const convenienceFee = payment.convenience_fee || 0;
          const convenienceFeeInDollars = convenienceFee / 100;
          const baseAmount = convenienceFee > 0 ? (payment.amount - convenienceFeeInDollars) : payment.amount;

          const { error: rpcError } = await supabaseAdmin.rpc("apply_balance_adjustment", {
            _tenant_id: tenant_id,
            _adjustment_type: "payment",
            _amount: baseAmount,
            _description: `ACH payment reconciled (was stuck in processing) - $${baseAmount.toFixed(2)}`,
            _created_by: userData.user.id,
          });

          if (rpcError) {
            logStep("Balance adjustment failed", { error: rpcError.message });
            // Payment status was already updated, note the balance issue
            details.push({ 
              payment_id: payment.id, 
              amount: payment.amount, 
              stripe_status: "succeeded", 
              action: `completed_but_balance_failed: ${rpcError.message}` 
            });
          } else {
            details.push({ 
              payment_id: payment.id, 
              amount: payment.amount, 
              stripe_status: "succeeded", 
              action: "reconciled" 
            });
          }

          updated++;
          logStep("Payment reconciled", { payment_id: payment.id, amount: payment.amount });

        } else if (pi.status === "canceled" || pi.status === "requires_payment_method") {
          // Mark as failed
          await supabaseAdmin
            .from("payments")
            .update({ status: "failed", notes: `Reconciled: Stripe status was ${pi.status}` })
            .eq("id", payment.id);

          details.push({ 
            payment_id: payment.id, 
            amount: payment.amount, 
            stripe_status: pi.status, 
            action: "marked_failed" 
          });
          failed++;
        } else {
          // Still processing or other status - skip
          details.push({ 
            payment_id: payment.id, 
            amount: payment.amount, 
            stripe_status: pi.status, 
            action: "skipped_still_processing" 
          });
        }
      } catch (stripeErr) {
        const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        logStep("Error checking payment intent", { payment_id: payment.id, error: msg });
        details.push({ 
          payment_id: payment.id, 
          amount: payment.amount, 
          stripe_status: "error", 
          action: `stripe_error: ${msg}` 
        });
        failed++;
      }
    }

    logStep("Reconciliation complete", { updated, failed });

    return new Response(JSON.stringify({ 
      message: `Reconciled ${updated} payments`, 
      updated, 
      failed,
      details 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
