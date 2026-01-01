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

  // Use service role for inserting payment records
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const user = userData.user;
    console.log("[VERIFY-PAYMENT] User authenticated:", user.id);

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

    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    // Verify the session belongs to this user
    if (session.metadata?.user_id !== user.id) {
      throw new Error("Unauthorized: Session does not belong to this user");
    }

    // Check if payment already recorded
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
    const { payment_type, property_id, lease_id } = session.metadata || {};
    const amountPaid = session.amount_total || 0;

    // For application fees, we need to get tenant_id from tenants table or use user_id directly
    // For rent/deposits, we get tenant info from the lease
    let tenantId: string | null = null;
    let finalPropertyId = property_id;

    if (payment_type === 'application_fee') {
      // For application fees, check if user has a tenant record or create payment directly
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (tenantData) {
        tenantId = tenantData.id;
      }
    } else if (lease_id) {
      // Get tenant and property info from lease
      const { data: leaseData, error: leaseError } = await supabaseAdmin
        .from('leases')
        .select('tenant_id, property_id')
        .eq('id', lease_id)
        .single();

      if (leaseError || !leaseData) {
        throw new Error("Could not find lease information");
      }

      // Get tenant id from tenants table using the lease's tenant_id (which is user_id)
      const { data: tenantRecord } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', leaseData.tenant_id)
        .limit(1)
        .single();

      tenantId = tenantRecord?.id || null;
      finalPropertyId = leaseData.property_id;
    }

    // If we still don't have a tenant ID, we need to handle this case
    // For now, we'll skip recording if no tenant record exists (application fee case)
    if (!tenantId && payment_type !== 'application_fee') {
      throw new Error("Could not determine tenant for payment record");
    }

    // Only record payment if we have tenant ID, otherwise just return success
    let paymentRecord = null;
    if (tenantId && finalPropertyId) {
      const { data: newPayment, error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          tenant_id: tenantId,
          property_id: finalPropertyId,
          lease_id: lease_id || null,
          amount: amountPaid / 100, // Convert from cents to dollars
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

      paymentRecord = newPayment;
      console.log("[VERIFY-PAYMENT] Payment recorded:", paymentRecord.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      payment_id: paymentRecord?.id || null,
      payment_type,
      amount: amountPaid / 100,
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
