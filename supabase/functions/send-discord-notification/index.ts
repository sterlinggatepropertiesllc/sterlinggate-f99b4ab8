import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp?: string;
  footer?: { text: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

interface RequestBody {
  webhook_url: string;
  title: string;
  message: string;
  type: string;
  color?: number;
  metadata?: Record<string, unknown>;
}

const typeColors: Record<string, number> = {
  application_received: 0x3b82f6, // Blue
  application_approved: 0x10b981, // Green
  application_rejected: 0xef4444, // Red
  rent_received: 0x10b981, // Green
  maintenance_request: 0xf59e0b, // Yellow/Orange
  lease_signed: 0x8b5cf6, // Purple
  message_received: 0x6366f1, // Indigo
  test: 0x10b981, // Green
};

const typeEmojis: Record<string, string> = {
  application_received: '📋',
  application_approved: '✅',
  application_rejected: '❌',
  rent_received: '💰',
  maintenance_request: '🔧',
  lease_signed: '📝',
  message_received: '💬',
  test: '🔔',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { webhook_url, title, message, type, color, metadata } = body;

    if (!webhook_url || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate webhook URL format
    if (!webhook_url.startsWith("https://discord.com/api/webhooks/")) {
      return new Response(
        JSON.stringify({ error: "Invalid Discord webhook URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emoji = typeEmojis[type] || '🔔';
    const embedColor = color || typeColors[type] || 0x6b7280;

    const embed: DiscordEmbed = {
      title: `${emoji} ${title}`,
      description: message,
      color: embedColor,
      timestamp: new Date().toISOString(),
      footer: { text: "Sterling Gate Properties" },
    };

    // Add metadata fields if present
    if (metadata && Object.keys(metadata).length > 0) {
      embed.fields = Object.entries(metadata)
        .filter(([_, value]) => value !== undefined && value !== null)
        .slice(0, 5) // Max 5 fields
        .map(([key, value]) => ({
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: String(value),
          inline: true,
        }));
    }

    const discordPayload = {
      embeds: [embed],
    };

    console.log("Sending to Discord:", JSON.stringify(discordPayload));

    const response = await fetch(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send to Discord", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
