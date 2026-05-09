import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-web-push-secret",
};

interface PushRequest {
  notification_id?: string;
  user_id?: string;
  title?: string;
  message?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

function formatPushError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }

  const candidate = error as {
    body?: string;
    message?: string;
    statusCode?: number;
  };

  return {
    message: candidate.message || "Push provider rejected the notification",
    statusCode: candidate.statusCode || null,
    body: candidate.body || null,
  };
}

function getNotificationUrl(type?: string) {
  if (type === "rent_received") return "/dashboard?tab=audit";
  if (type === "application_received") return "/dashboard?tab=applications";
  if (type === "maintenance_request") return "/dashboard?tab=maintenance";
  if (type === "message_received") return "/dashboard?tab=messages";
  if (type === "lease_signed") return "/dashboard?tab=leases";
  return "/dashboard";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@sterlinggateproperty.com";
    const dispatchSecret = Deno.env.get("WEB_PUSH_DISPATCH_SECRET");

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys are not configured");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const dispatchHeader = req.headers.get("x-web-push-secret") || "";
    const authorizedByServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const authorizedByDispatchSecret = Boolean(dispatchSecret && dispatchHeader === dispatchSecret);

    if (!authorizedByServiceRole && !authorizedByDispatchSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateJWK = JSON.parse(vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as PushRequest;
    let notification = {
      id: body.notification_id || "",
      user_id: body.user_id || "",
      title: body.title || "Sterling Gate Properties",
      message: body.message || "You have a new portfolio notification.",
      type: body.type || "message_received",
      metadata: body.metadata || {},
    };

    if (body.notification_id && (!body.title || !body.message || !body.user_id)) {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, title, message, type, metadata")
        .eq("id", body.notification_id)
        .single();

      if (error) throw error;
      notification = data;
    }

    if (!notification.user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.user_id);

    if (subscriptionError) throw subscriptionError;

    const payload = {
      title: notification.title,
      body: notification.message,
      type: notification.type,
      notification_id: notification.id,
      metadata: notification.metadata || {},
      url: getNotificationUrl(notification.type),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: notification.id || `${notification.type}-${Date.now()}`,
    };

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (subscription) => {
        try {
          const pushRequest = await buildPushHTTPRequest({
            privateJWK,
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            message: {
              payload,
              adminContact: vapidSubject,
              options: {
                ttl: 86400,
                urgency: "high",
              },
            },
          });

          const pushResponse = await fetch(pushRequest.endpoint, {
            method: "POST",
            headers: pushRequest.headers,
            body: pushRequest.body,
          });

          if (!pushResponse.ok) {
            const responseBody = await pushResponse.text();
            const statusCode = pushResponse.status;

            if (statusCode === 404 || statusCode === 410) {
              await supabase.from("web_push_subscriptions").delete().eq("id", subscription.id);
              return { id: subscription.id, status: "deleted_stale", statusCode };
            }

            throw {
              message: `Push provider returned ${statusCode}`,
              statusCode,
              body: responseBody.slice(0, 500),
            };
          }

          await supabase
            .from("web_push_subscriptions")
            .update({
              last_success_at: new Date().toISOString(),
              last_failure_at: null,
              failure_count: 0,
            })
            .eq("id", subscription.id);
          return { id: subscription.id, status: "sent", statusCode: pushResponse.status };
        } catch (error) {
          const statusCode = typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null;

          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("web_push_subscriptions").delete().eq("id", subscription.id);
            return { id: subscription.id, status: "deleted_stale" };
          }

          const formattedError = formatPushError(error);
          console.error("[WEB-PUSH] Delivery failed:", formattedError);

          await supabase
            .from("web_push_subscriptions")
            .update({
              last_failure_at: new Date().toISOString(),
              failure_count: 1,
            })
            .eq("id", subscription.id);

          return { id: subscription.id, status: "failed", error: formattedError };
        }
      })
    );

    return new Response(JSON.stringify({
      delivered: results.filter((result) => result.status === "fulfilled" && result.value.status === "sent").length,
      attempted: subscriptions?.length || 0,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[WEB-PUSH] Failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
