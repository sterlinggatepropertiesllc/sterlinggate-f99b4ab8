import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  payment_type: 'application_fee' | 'security_deposit' | 'rent' | 'balance';
  property_id?: string;
  lease_id?: string;
  tenant_id?: string;
  amount?: number; // In cents, for dynamic amounts (deposit/rent/balance)
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

  try {
    console.log("[CREATE-CHECKOUT] Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    const user = userData.user;
    console.log("[CREATE-CHECKOUT] User authenticated:", user.email);

    // Parse request body
    const body: CheckoutRequest = await req.json();
    const { payment_type, property_id, lease_id, amount } = body;
    console.log("[CREATE-CHECKOUT] Request:", { payment_type, property_id, lease_id, amount });

    if (!payment_type) {
      throw new Error("payment_type is required");
    }

    // Validate required fields based on payment type
    if (payment_type === 'application_fee' && !property_id) {
      throw new Error("property_id is required for application fee");
    }

    if ((payment_type === 'security_deposit' || payment_type === 'rent') && !lease_id) {
      throw new Error("lease_id is required for deposit/rent payments");
    }

    if ((payment_type === 'security_deposit' || payment_type === 'rent') && !amount) {
      throw new Error("amount is required for deposit/rent payments");
    }

    if (payment_type === 'balance' && !body.tenant_id) {
      throw new Error("tenant_id is required for balance payments");
    }

    if (payment_type === 'balance' && !amount) {
      throw new Error("amount is required for balance payments");
    }

    // Fetch application fee from settings if needed
    let applicationFeeAmount = 5000; // Default $50 in cents
    if (payment_type === 'application_fee') {
      const { data: settingsData } = await supabaseClient
        .from('app_settings')
        .select('value')
        .eq('key', 'application_fee')
        .single();
      
      if (settingsData?.value) {
        const feeValue = settingsData.value as { amount?: number };
        if (feeValue.amount) {
          applicationFeeAmount = feeValue.amount;
        }
      }
      console.log("[CREATE-CHECKOUT] Application fee amount:", applicationFeeAmount);
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
      console.log("[CREATE-CHECKOUT] Found existing customer:", customerId);
    }

    // Build line items based on payment type
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let paymentDescription: string;

    if (payment_type === 'application_fee') {
      // Use dynamic price_data for application fee from settings
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Application Fee',
          },
          unit_amount: applicationFeeAmount,
        },
        quantity: 1,
      }];
      paymentDescription = "Application Fee";
    } else if (payment_type === 'balance') {
      // Balance payment
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Balance Payment',
          },
          unit_amount: amount,
        },
        quantity: 1,
      }];
      paymentDescription = "Balance Payment";
    } else {
      // Dynamic amount for deposits and rent
      const productName = payment_type === 'security_deposit' ? 'Security Deposit' : 'Rent Payment';
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }];
      paymentDescription = productName;
    }

    // Build metadata for tracking
    const metadata: Record<string, string> = {
      payment_type,
      user_id: user.id,
    };

    if (property_id) metadata.property_id = property_id;
    if (lease_id) metadata.lease_id = lease_id;
    if (body.tenant_id) metadata.tenant_id = body.tenant_id;

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=${payment_type}`,
      cancel_url: `${origin}/payment-cancelled?type=${payment_type}`,
      metadata,
      payment_intent_data: {
        metadata,
        description: paymentDescription,
      },
    });

    console.log("[CREATE-CHECKOUT] Session created:", session.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CHECKOUT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
