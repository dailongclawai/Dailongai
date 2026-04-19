import { BetaLeadSchema } from "./_schemas";

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  LEAD_WEBHOOK_URL?: string;
  WEB_LEAD_SECRET?: string;
  TURNSTILE_SECRET?: string;
  MEO_STATS: KV;
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 600;

async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data: { success?: boolean } = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const rateKey = `rl:beta-lead:${ip}`;
  const current = parseInt((await env.MEO_STATS.get(rateKey)) || '0', 10);
  if (current >= RATE_LIMIT_MAX) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BetaLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { name, phone, turnstileToken } = parsed.data;

  if (env.TURNSTILE_SECRET) {
    if (!turnstileToken) {
      return Response.json({ error: 'Captcha required' }, { status: 400 });
    }
    const ok = await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET);
    if (!ok) {
      return Response.json({ error: 'Captcha verification failed' }, { status: 403 });
    }
  }

  await env.MEO_STATS.put(rateKey, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC });

  try {
    const webhookUrl = env.LEAD_WEBHOOK_URL || 'https://zalo.longanhai.com/api/web-lead';
    const secret = env.WEB_LEAD_SECRET;
    if (!secret) {
      console.error('[beta-lead] WEB_LEAD_SECRET not configured');
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret,
      },
      body: JSON.stringify({
        name: name || '',
        phone,
        context: 'Đăng ký nhận ưu đãi sớm từ popup beta - dailongai.com',
      }),
    });

    const data: { lead_id?: string } = await res.json();
    if (!res.ok) {
      console.error(`[beta-lead] webhook failed ${res.status}`);
      return Response.json({ error: 'Failed to save lead' }, { status: 500 });
    }

    return Response.json({ ok: true, lead_id: data.lead_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[beta-lead error]', message);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
