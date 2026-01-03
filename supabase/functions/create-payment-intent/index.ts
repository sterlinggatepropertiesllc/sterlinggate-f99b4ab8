import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentIntentRequest {
  payment_type: 'application_fee' | 'security_deposit' | 'rent' | 'balance';
  property_id?: string;
  lease_id?: string;
  tenant_id?: string;
  amount: number; // In cents
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[CREATE-PAYMENT-INTENT] Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      console.error("[CREATE-PAYMENT-INTENT] Auth error:", userError);
      throw new Error("User not authenticated or email not available");
    }

    const user = userData.user;
    console.log("[CREATE-PAYMENT-INTENT] User authenticated:", user.email, user.id);

    // Parse request body
    const body: PaymentIntentRequest = await req.json();
    const { payment_type, property_id, lease_id, amount } = body;
    console.log("[CREATE-PAYMENT-INTENT] Request:", { payment_type, property_id, lease_id, tenant_id: body.tenant_id, amount });

    if (!payment_type) {
      throw new Error("payment_type is required");
    }

    if (!amount || amount < 100) {
      throw new Error("amount must be at least 100 cents ($1.00)");
    }

    // Validate based on payment type
    if (payment_type === 'balance' && !body.tenant_id) {
      throw new Error("tenant_id is required for balance payments");
    }

    if ((payment_type === 'security_deposit' || payment_type === 'rent') && !lease_id) {
      throw new Error("lease_id is required for deposit/rent payments");
    }

    if (payment_type === 'application_fee' && !property_id) {
      throw new Error("property_id is required for application fee payments");
    }

    // Build metadata with proper ownership validation
    const metadata: Record<string, string> = {
      payment_type,
      user_id: user.id,
    };

    let resolvedPropertyId = property_id;

    // Handle application fee payments
    if (payment_type === 'application_fee') {
      // For application fees, we just need the property_id
      // The user is applying for this property, so no tenant/lease validation needed
      console.log("[CREATE-PAYMENT-INTENT] Application fee for property:", property_id);
      metadata.property_id = property_id!;
    }

    // Validate ownership based on payment type
    if (payment_type === 'balance') {
      // For balance payments, verify tenant record belongs to user
      const { data: tenantData, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, user_id, property_id')
        .eq('id', body.tenant_id)
        .eq('is_active', true)
        .single();

      if (tenantError || !tenantData) {
        console.error("[CREATE-PAYMENT-INTENT] Tenant lookup error:", tenantError);
        throw new Error("Tenant record not found");
      }

      if (tenantData.user_id !== user.id) {
        console.error("[CREATE-PAYMENT-INTENT] Ownership mismatch:", { tenantUserId: tenantData.user_id, userId: user.id });
        throw new Error("Unauthorized: You can only pay your own balance");
      }

      metadata.tenant_id = body.tenant_id!;
      resolvedPropertyId = tenantData.property_id;
      
      // If tenant has no property_id, try to find it from an active lease
      if (!resolvedPropertyId) {
        console.log("[CREATE-PAYMENT-INTENT] No property_id on tenant, checking leases...");
        const { data: leaseData } = await supabaseAdmin
          .from('leases')
          .select('property_id')
          .eq('tenant_id', user.id)
          .in('status', ['completed', 'pending_tenant_signature', 'pending_manager_signature'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (leaseData?.property_id) {
          resolvedPropertyId = leaseData.property_id;
          console.log("[CREATE-PAYMENT-INTENT] Found property_id from lease:", resolvedPropertyId);
        }
      }
      
      console.log("[CREATE-PAYMENT-INTENT] Balance payment validated for tenant:", body.tenant_id);
    }

    if (payment_type === 'rent' || payment_type === 'security_deposit') {
      // For lease-based payments, verify lease belongs to user
      const { data: leaseData, error: leaseError } = await supabaseAdmin
        .from('leases')
        .select('id, tenant_id, property_id')
        .eq('id', lease_id)
        .single();

      if (leaseError || !leaseData) {
        console.error("[CREATE-PAYMENT-INTENT] Lease lookup error:", leaseError);
        throw new Error("Lease not found");
      }

      if (leaseData.tenant_id !== user.id) {
        console.error("[CREATE-PAYMENT-INTENT] Lease ownership mismatch:", { leaseTenantId: leaseData.tenant_id, userId: user.id });
        throw new Error("Unauthorized: You can only pay for your own lease");
      }

      metadata.lease_id = lease_id!;
      resolvedPropertyId = leaseData.property_id;

      // Get tenant record ID
      const { data: tenantRecord } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (tenantRecord) {
        metadata.tenant_id = tenantRecord.id;
      }

      console.log("[CREATE-PAYMENT-INTENT] Lease payment validated for lease:", lease_id);
    }

    // Include property_id in metadata (for non-application_fee types)
    if (payment_type !== 'application_fee') {
      if (resolvedPropertyId) {
        metadata.property_id = resolvedPropertyId;
      } else if (property_id) {
        metadata.property_id = property_id;
      }
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("[CREATE-PAYMENT-INTENT] Found existing customer:", customerId);
    } else {
      // Create a new customer
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = newCustomer.id;
      console.log("[CREATE-PAYMENT-INTENT] Created new customer:", customerId);
    }

    // Build description based on payment type
    const descriptions: Record<string, string> = {
      application_fee: 'Application Fee',
      security_deposit: 'Security Deposit',
      rent: 'Rent Payment',
      balance: 'Balance Payment',
    };

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      metadata,
      description: descriptions[payment_type] || 'Payment',
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log("[CREATE-PAYMENT-INTENT] PaymentIntent created:", paymentIntent.id);

    return new Response(JSON.stringify({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-PAYMENT-INTENT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
