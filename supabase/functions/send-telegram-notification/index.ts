import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  topic_key: string;
  user_ids?: string[];
  user_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
  idempotency_source?: string;
  entity_id?: string;
}

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

    const body: NotificationRequest = await req.json();
    const { topic_key, message, metadata = {}, idempotency_source, entity_id } = body;
    const userIds = body.user_ids || (body.user_id ? [body.user_id] : []);

    if (!topic_key || !message) {
      return new Response(
        JSON.stringify({ error: "topic_key and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get topic to verify role_scope
    const { data: topic, error: topicError } = await supabase
      .from("telegram_notification_topics")
      .select("key, role_scope")
      .eq("key", topic_key)
      .single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ error: `Unknown topic: ${topic_key}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map role_scope to app_role
    const allowedRoles: string[] = [];
    if (topic.role_scope === "property_manager" || topic.role_scope === "both") {
      allowedRoles.push("property_manager");
    }
    if (topic.role_scope === "tenant" || topic.role_scope === "both") {
      allowedRoles.push("tenant");
    }

    let targetUserIds = userIds;

    // If no specific user_ids, find all users with matching role
    if (targetUserIds.length === 0) {
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", allowedRoles);
      targetUserIds = (roleUsers || []).map((r) => r.user_id);
    }

    const results: Array<{ user_id: string; status: string; error?: string }> = [];

    for (const userId of targetUserIds) {
      // 1. Verify user role matches topic scope
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (!userRole || !allowedRoles.includes(userRole.role)) {
        results.push({ user_id: userId, status: "skipped", error: "Role mismatch" });
        continue;
      }

      // 2. Check notification preferences
      const { data: pref } = await supabase
        .from("telegram_notification_prefs")
        .select("enabled")
        .eq("user_id", userId)
        .eq("topic_key", topic_key)
        .maybeSingle();

      // If pref exists and is disabled, skip. If no pref exists, default to enabled.
      if (pref && !pref.enabled) {
        results.push({ user_id: userId, status: "skipped", error: "Disabled by user" });
        continue;
      }

      // 3. Get telegram_chat_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_chat_id, telegram_id")
        .eq("id", userId)
        .single();

      const chatId = profile?.telegram_chat_id;

      // 4. Generate idempotency key
      const idempotencyKey = idempotency_source && entity_id
        ? `${idempotency_source}:${entity_id}:${userId}`
        : `${topic_key}:${crypto.randomUUID()}:${userId}`;

      // 5. Check for duplicate
      const { data: existing } = await supabase
        .from("telegram_notification_deliveries")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing) {
        results.push({ user_id: userId, status: "skipped", error: "Duplicate (idempotency)" });
        continue;
      }

      if (!chatId) {
        // Record as failed - no chat_id
        await supabase.from("telegram_notification_deliveries").insert({
          user_id: userId,
          topic_key,
          telegram_chat_id: null,
          message_text: message,
          status: "failed",
          attempts: 1,
          last_error: "User has not started the bot with /start",
          idempotency_key: idempotencyKey,
          metadata,
        });
        results.push({ user_id: userId, status: "failed", error: "No chat_id" });
        continue;
      }

      // 6. Send via Telegram Bot API
      try {
        const telegramRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "HTML",
            }),
          }
        );

        const telegramData = await telegramRes.json();

        if (telegramData.ok) {
          await supabase.from("telegram_notification_deliveries").insert({
            user_id: userId,
            topic_key,
            telegram_chat_id: chatId,
            message_text: message,
            status: "sent",
            attempts: 1,
            idempotency_key: idempotencyKey,
            metadata,
          });
          results.push({ user_id: userId, status: "sent" });
        } else {
          await supabase.from("telegram_notification_deliveries").insert({
            user_id: userId,
            topic_key,
            telegram_chat_id: chatId,
            message_text: message,
            status: "failed",
            attempts: 1,
            last_error: telegramData.description || "Telegram API error",
            idempotency_key: idempotencyKey,
            metadata,
          });
          results.push({ user_id: userId, status: "failed", error: telegramData.description });
        }
      } catch (sendError) {
        await supabase.from("telegram_notification_deliveries").insert({
          user_id: userId,
          topic_key,
          telegram_chat_id: chatId,
          message_text: message,
          status: "failed",
          attempts: 1,
          last_error: sendError instanceof Error ? sendError.message : "Unknown send error",
          idempotency_key: idempotencyKey,
          metadata,
        });
        results.push({ user_id: userId, status: "failed", error: String(sendError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-telegram-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
