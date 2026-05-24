// send-push edge function — called by Database Webhook on portal_messages INSERT
// Receives: { type: "INSERT", table: "portal_messages", record: { ... }, ... }
// Looks up Expo push tokens for recipient, batches via Expo Push API → APNS

import { Expo, type ExpoPushMessage } from "npm:expo-server-sdk@3.10.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const expo = new Expo();
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface MessageRow {
  id: string;
  recipient_user_id: string;
  title: string | null;
  body: string | null;
  type: string;
  data: Record<string, unknown> | null;
}

async function deliver(row: MessageRow) {
  const { data: tokens, error } = await sb
    .from("device_tokens")
    .select("expo_token")
    .eq("user_id", row.recipient_user_id)
    .eq("platform", "ios")
    .gte("last_active_at", new Date(Date.now() - 60 * 86400 * 1000).toISOString());

  if (error) { console.error("device_tokens lookup error:", error); return; }
  if (!tokens || tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.expo_token))
    .map((t) => ({
      to: t.expo_token,
      sound: "default",
      title: row.title ?? "Đại Long Portal",
      body: row.body ?? "",
      data: {
        type: row.type,
        message_id: row.id,
        ...(row.data ?? {}),
      },
    }));

  if (messages.length === 0) return;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          // Mark token inactive so it's excluded from future lookups
          await sb
            .from("device_tokens")
            .update({ last_active_at: new Date(0).toISOString() })
            .eq("expo_token", chunk[i].to as string);
        }
      }
    } catch (e) {
      console.error("push chunk send failed:", e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = await req.json();
    // Database webhook sends: { type, table, schema, record, old_record }
    const row = (body.record ?? body) as MessageRow;
    if (!row.recipient_user_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "no recipient" }), {
        headers: { "content-type": "application/json" },
      });
    }
    await deliver(row);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("send-push handler error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
