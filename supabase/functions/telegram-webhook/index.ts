import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const update = await req.json();
    console.log("Telegram webhook update:", JSON.stringify(update));

    const message = update.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telegramUserId = String(message.from?.id);
    const chatId = message.chat?.id;
    const text = message.text || "";

    if (!telegramUserId || !chatId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle /start command
    if (text.startsWith("/start")) {
      // Find profile by telegram_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, telegram_chat_id")
        .eq("telegram_id", telegramUserId)
        .maybeSingle();

      if (profile) {
        // Update chat_id
        await supabase
          .from("profiles")
          .update({ telegram_chat_id: chatId })
          .eq("id", profile.id);

        // Get user role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .single();

        const roleName = roleData?.role === "property_manager" ? "Property Manager" : "Tenant";

        // Send welcome message
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ <b>Notifications Enabled!</b>\n\nHi ${profile.full_name || "there"}! Your Sterling Gate notifications are now linked.\n\n<b>Role:</b> ${roleName}\n\nYou'll receive real-time notifications relevant to your role. You can manage your notification preferences in the app settings.`,
            parse_mode: "HTML",
          }),
        });
      } else {
        // User not found - tell them to log in first
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "⚠️ Your Telegram account is not linked to a Sterling Gate account yet.\n\nPlease open the Sterling Gate Mini App first to link your account, then send /start again.",
            parse_mode: "HTML",
          }),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("telegram-webhook error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
