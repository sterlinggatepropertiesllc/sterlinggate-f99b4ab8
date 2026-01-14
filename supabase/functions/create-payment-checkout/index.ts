import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  payment_type: 'application_fee' | 'security_deposit' | 'rent' | 'balance';
  payment_method?: 'ach' | 'card'; // Payment method type
  property_id?: string;
  lease_id?: string;
  tenant_id?: string;
  amount?: number; // In cents, for dynamic amounts (deposit/rent/balance)
}

interface PaymentMethodSettings {
  ach_enabled: boolean;
  card_enabled: boolean;
  card_fee_percentage: number;
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
    console.log("[CREATE-CHECKOUT] Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      console.error("[CREATE-CHECKOUT] Auth error:", userError);
      throw new Error("User not authenticated or email not available");
    }

    const user = userData.user;
    console.log("[CREATE-CHECKOUT] User authenticated:", user.email, user.id);

    // Parse request body
    const body: CheckoutRequest = await req.json();
    const { payment_type, payment_method, property_id, lease_id, amount } = body;
    console.log("[CREATE-CHECKOUT] Request:", { payment_type, payment_method, property_id, lease_id, tenant_id: body.tenant_id, amount });

    if (!payment_type) {
      throw new Error("payment_type is required");
    }

    // Validate required fields based on payment type
    if (payment_type === 'application_fee' && !property_id) {
      throw new Error("property_id is required for application fee");
    }

    if (payment_type === 'security_deposit' && !lease_id) {
      throw new Error("lease_id is required for deposit payments");
    }

    // Rent can be paid via lease_id OR tenant_id (for prepay without active lease)
    if (payment_type === 'rent' && !lease_id && !body.tenant_id) {
      throw new Error("lease_id or tenant_id is required for rent payments");
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

    // Build metadata with proper ownership validation
    const metadata: Record<string, string> = {
      payment_type,
      user_id: user.id,
    };

    let resolvedPropertyId = property_id;

    // Validate ownership and get property_id based on payment type
    if (payment_type === 'balance') {
      // For balance payments, verify tenant record belongs to user
      const { data: tenantData, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, user_id, property_id')
        .eq('id', body.tenant_id)
        .eq('is_active', true)
        .single();

      if (tenantError || !tenantData) {
        console.error("[CREATE-CHECKOUT] Tenant lookup error:", tenantError);
        throw new Error("Tenant record not found");
      }

      if (tenantData.user_id !== user.id) {
        console.error("[CREATE-CHECKOUT] Ownership mismatch:", { tenantUserId: tenantData.user_id, userId: user.id });
        throw new Error("Unauthorized: You can only pay your own balance");
      }

      metadata.tenant_id = body.tenant_id!;
      resolvedPropertyId = tenantData.property_id;
      
      // Fallback: If tenant has no property_id, look up from user's active lease
      if (!resolvedPropertyId) {
        console.log("[CREATE-CHECKOUT] Tenant has no property_id, looking up from lease");
        const { data: leaseData } = await supabaseAdmin
          .from('leases')
          .select('property_id')
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (leaseData?.property_id) {
          resolvedPropertyId = leaseData.property_id;
          console.log("[CREATE-CHECKOUT] Found property from lease:", resolvedPropertyId);
        }
      }
      
      console.log("[CREATE-CHECKOUT] Balance payment validated for tenant:", body.tenant_id);
    }

    if (payment_type === 'security_deposit') {
      // Security deposit always requires a lease
      const { data: leaseData, error: leaseError } = await supabaseAdmin
        .from('leases')
        .select('id, tenant_id, property_id')
        .eq('id', lease_id)
        .single();

      if (leaseError || !leaseData) {
        console.error("[CREATE-CHECKOUT] Lease lookup error:", leaseError);
        throw new Error("Lease not found");
      }

      if (leaseData.tenant_id !== user.id) {
        console.error("[CREATE-CHECKOUT] Lease ownership mismatch:", { leaseTenantId: leaseData.tenant_id, userId: user.id });
        throw new Error("Unauthorized: You can only pay for your own lease");
      }

      metadata.lease_id = lease_id!;
      resolvedPropertyId = leaseData.property_id;

      // Also get tenant record ID for proper payment recording
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

      console.log("[CREATE-CHECKOUT] Deposit payment validated for lease:", lease_id);
    }

    if (payment_type === 'rent') {
      // Rent can be paid via lease OR tenant_id
      if (lease_id) {
        // Lease-based rent payment
        const { data: leaseData, error: leaseError } = await supabaseAdmin
          .from('leases')
          .select('id, tenant_id, property_id')
          .eq('id', lease_id)
          .single();

        if (leaseError || !leaseData) {
          console.error("[CREATE-CHECKOUT] Lease lookup error:", leaseError);
          throw new Error("Lease not found");
        }

        if (leaseData.tenant_id !== user.id) {
          console.error("[CREATE-CHECKOUT] Lease ownership mismatch:", { leaseTenantId: leaseData.tenant_id, userId: user.id });
          throw new Error("Unauthorized: You can only pay for your own lease");
        }

        metadata.lease_id = lease_id;
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

        console.log("[CREATE-CHECKOUT] Rent payment validated for lease:", lease_id);
      } else if (body.tenant_id) {
        // Tenant-based rent payment (no lease required - prepay scenario)
        const { data: tenantData, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, user_id, property_id')
          .eq('id', body.tenant_id)
          .eq('is_active', true)
          .single();

        if (tenantError || !tenantData) {
          console.error("[CREATE-CHECKOUT] Tenant lookup error:", tenantError);
          throw new Error("Tenant record not found");
        }

        if (tenantData.user_id !== user.id) {
          console.error("[CREATE-CHECKOUT] Ownership mismatch:", { tenantUserId: tenantData.user_id, userId: user.id });
          throw new Error("Unauthorized: You can only pay your own rent");
        }

        metadata.tenant_id = body.tenant_id;
        resolvedPropertyId = tenantData.property_id;

        // Fallback: If tenant has no property_id, look up from user's active lease
        if (!resolvedPropertyId) {
          console.log("[CREATE-CHECKOUT] Tenant has no property_id, looking up from lease");
          const { data: leaseData } = await supabaseAdmin
            .from('leases')
            .select('property_id')
            .eq('tenant_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (leaseData?.property_id) {
            resolvedPropertyId = leaseData.property_id;
            console.log("[CREATE-CHECKOUT] Found property from lease:", resolvedPropertyId);
          }
        }

        console.log("[CREATE-CHECKOUT] Rent payment validated for tenant:", body.tenant_id);
      }
    }

    // Always include property_id in metadata
    if (resolvedPropertyId) {
      metadata.property_id = resolvedPropertyId;
    } else if (property_id) {
      metadata.property_id = property_id;
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

    // Fetch payment method settings for card fee percentage
    let cardFeePercentage = 3.0; // Default 3%
    if (payment_method === 'card') {
      const { data: paymentSettingsData } = await supabaseClient
        .from('app_settings')
        .select('value')
        .eq('key', 'payment_methods')
        .single();
      
      if (paymentSettingsData?.value) {
        const pmSettings = paymentSettingsData.value as PaymentMethodSettings;
        if (pmSettings.card_fee_percentage) {
          cardFeePercentage = pmSettings.card_fee_percentage;
        }
      }
      console.log("[CREATE-CHECKOUT] Card fee percentage:", cardFeePercentage);
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

    // Calculate convenience fee for card payments
    let baseAmount = amount || 0;
    let convenienceFee = 0;
    let totalAmount = baseAmount;

    if (payment_method === 'card' && payment_type !== 'application_fee') {
      convenienceFee = Math.round(baseAmount * (cardFeePercentage / 100));
      totalAmount = baseAmount + convenienceFee;
      console.log("[CREATE-CHECKOUT] Card payment fee calculation:", { baseAmount, convenienceFee, totalAmount });
    }

    // Add payment method and fee info to metadata
    if (payment_method) {
      metadata.payment_method_type = payment_method;
    }
    if (convenienceFee > 0) {
      metadata.convenience_fee = String(convenienceFee);
      metadata.base_amount = String(baseAmount);
    }

    // Determine payment method types for Stripe
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = 
      payment_method === 'ach' ? ['us_bank_account'] : ['card'];

    // Build line items based on payment type
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let paymentDescription: string;

    if (payment_type === 'application_fee') {
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
      if (payment_method === 'card' && convenienceFee > 0) {
        // Show base amount + fee as separate items for transparency
        lineItems = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Balance Payment',
              },
              unit_amount: baseAmount,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Processing Fee (${cardFeePercentage}%)`,
              },
              unit_amount: convenienceFee,
            },
            quantity: 1,
          },
        ];
        paymentDescription = `Balance Payment + ${cardFeePercentage}% processing fee`;
      } else {
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Balance Payment',
            },
            unit_amount: baseAmount,
          },
          quantity: 1,
        }];
        paymentDescription = "Balance Payment";
      }
    } else {
      const productName = payment_type === 'security_deposit' ? 'Security Deposit' : 'Rent Payment';
      if (payment_method === 'card' && convenienceFee > 0) {
        lineItems = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName,
              },
              unit_amount: baseAmount,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Processing Fee (${cardFeePercentage}%)`,
              },
              unit_amount: convenienceFee,
            },
            quantity: 1,
          },
        ];
        paymentDescription = `${productName} + ${cardFeePercentage}% processing fee`;
      } else {
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
            },
            unit_amount: baseAmount,
          },
          quantity: 1,
        }];
        paymentDescription = productName;
      }
    }

    console.log("[CREATE-CHECKOUT] Creating session with metadata:", metadata);

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: paymentMethodTypes,
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
