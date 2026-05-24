// Sends a payout-change OTP to a dealer via Zalo OA.
//
// Triggered by the frontend right after `request_payout_otp` RPC succeeds:
//   POST /functions/v1/send-payout-otp
//   Authorization: Bearer <anon key>
//   { "otp_id": "<uuid>" }
//
// The function:
//   1. Reads the pending OTP row (service_role bypasses RLS).
//   2. Looks up zalo_user_id for the phone in `zalo_oa_users` mapping table.
//   3. POSTs to the Zalo bot's bridge endpoint (https://zalo.longanhai.com/payout-otp)
//      which calls Zalo OA sendMessage(user_id, "Mã xác nhận: 123456 ...").
//   4. If mapping missing OR bot returns not_found → falls back to Telegram alert
//      to Boss (@SenCoder1_bot) with the code so dealer can be helped manually.
//
// Required secrets:
//   PAYOUT_OTP_BRIDGE_TOKEN  shared secret with bot's /payout-otp endpoint
//   TELEGRAM_FALLBACK_TOKEN  Sen Coder bot token (already in fleet)
//   TELEGRAM_FALLBACK_CHAT   Boss chat_id (6052313595)

// @ts-expect-error — Deno deploy runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error — Deno global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-expect-error — Deno global
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// @ts-expect-error — Deno global
const BRIDGE_TOKEN = Deno.env.get('PAYOUT_OTP_BRIDGE_TOKEN') ?? '';
// @ts-expect-error — Deno global
const TG_TOKEN = Deno.env.get('TELEGRAM_FALLBACK_TOKEN') ?? '';
// @ts-expect-error — Deno global
const TG_CHAT = Deno.env.get('TELEGRAM_FALLBACK_CHAT') ?? '';

const BRIDGE_URL = 'https://zalo.longanhai.com/payout-otp';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function telegramFallback(payload: {
  phone: string; code: string; holder: string; account: string; bank: string;
}): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT) return;
  const text =
    `🔐 Payout OTP fallback (Zalo mapping missing)\n` +
    `Phone: ${payload.phone}\nCode: ${payload.code}\n` +
    `Bank: ${payload.bank} / ${payload.account}\nHolder: ${payload.holder}`;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text }),
  }).catch(() => undefined);
}

// @ts-expect-error — Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS });
  }

  let body: { otp_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  if (!body.otp_id) {
    return new Response(JSON.stringify({ error: 'otp_id required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: otp, error: otpErr } = await sb
    .from('payout_otp')
    .select('id, code, zalo_phone, bank_short, bank_account, bank_holder, used_at, expires_at')
    .eq('id', body.otp_id)
    .maybeSingle();

  if (otpErr || !otp) {
    return new Response(JSON.stringify({ error: 'otp_not_found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (otp.used_at) {
    return new Response(JSON.stringify({ error: 'otp_used' }), {
      status: 409, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const phone = otp.zalo_phone;
  const fallbackPayload = {
    phone, code: otp.code, holder: otp.bank_holder,
    account: otp.bank_account, bank: otp.bank_short,
  };

  // Try Zalo bridge first
  let delivered: 'zalo' | 'telegram_fallback' = 'telegram_fallback';
  try {
    const r = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': BRIDGE_TOKEN },
      body: JSON.stringify({ phone, code: otp.code }),
    });
    if (r.ok) {
      const j = (await r.json().catch(() => ({}))) as { sent?: boolean };
      if (j.sent) delivered = 'zalo';
    }
  } catch { /* swallow, fall through */ }

  if (delivered === 'telegram_fallback') {
    await telegramFallback(fallbackPayload);
  }

  await sb.from('payout_otp').update({ delivered_via: delivered }).eq('id', otp.id);

  return new Response(JSON.stringify({ ok: true, delivered }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
