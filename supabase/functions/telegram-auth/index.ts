import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateInitData(initDataRaw: string, botToken: string): Promise<Record<string, string>> {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash in initData");

  // Build sorted key=value pairs, excluding hash
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  // HMAC-SHA256 of bot token with key "WebAppData"
  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  // HMAC-SHA256 of data check string with secret key
  const computedHash = bufToHex(await hmacSha256(secretKey, dataCheckString));

  if (computedHash !== hash) {
    throw new Error("Invalid initData signature");
  }

  // Return parsed params as object
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData } = await req.json();
    if (!initData) {
      return new Response(JSON.stringify({ error: "Missing initData" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    // Validate the initData signature
    const parsed = await validateInitData(initData, botToken);

    // Extract user info
    const userDataStr = parsed.user;
    if (!userDataStr) throw new Error("No user data in initData");
    const telegramUser = JSON.parse(userDataStr);
    const telegramId = String(telegramUser.id);

    // Create admin Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if a profile with this telegram_id exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      // Create a new user with a generated email
      const email = `tg_${telegramId}@telegram.user`;
      const password = crypto.randomUUID() + crypto.randomUUID(); // random strong password

      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" "),
          telegram_id: telegramId,
        },
      });

      if (signUpError) throw signUpError;
      userId = signUpData.user.id;

      // Update profile with telegram_id
      await supabase
        .from("profiles")
        .update({ telegram_id: telegramId })
        .eq("id", userId);

      // Assign tenant role by default for Telegram users
      await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "tenant" })
        .select();
    }

    // Generate a session for this user directly using admin API
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    if (!userData.user) throw new Error("User not found");

    // Use the Supabase Admin API to generate link and extract token
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
    });

    if (linkError) throw linkError;

    // Extract the OTP token from the action link
    const actionLink = new URL(linkData.properties.action_link);
    const token = actionLink.searchParams.get("token") || "";

    // Verify the token server-side to get a real session
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (sessionError) throw sessionError;

    // Return the session tokens so the client can set them directly
    return new Response(
      JSON.stringify({
        access_token: sessionData.session?.access_token,
        refresh_token: sessionData.session?.refresh_token,
        user_id: userId,
        telegram_user: telegramUser,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("telegram-auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
