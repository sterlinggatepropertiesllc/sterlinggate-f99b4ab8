import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[GET-STRIPE-PUBLISHABLE-KEY] Function called");
    
    // Get the publishable key from environment
    const publishableKey = Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY");
    
    if (!publishableKey) {
      console.error("[GET-STRIPE-PUBLISHABLE-KEY] VITE_STRIPE_PUBLISHABLE_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe publishable key not configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log("[GET-STRIPE-PUBLISHABLE-KEY] Key found, returning");
    
    return new Response(
      JSON.stringify({ publishableKey }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[GET-STRIPE-PUBLISHABLE-KEY] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
