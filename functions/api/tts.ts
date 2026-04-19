import { TtsSchema } from "./_schemas";

const RATE_LIMIT = 20;
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }, { status: 429 });
  }

  if (!env.OPENAI_API_KEY) {
    return Response.json({ error: 'TTS service not configured' }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TtsSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { text, voice } = parsed.data;

  try {
    // Use Cloudflare AI Gateway to avoid region restrictions on OpenAI
    const gateway = env.AI_GATEWAY_URL || 'https://gateway.ai.cloudflare.com/v1';
    const accountId = env.CF_ACCOUNT_ID;
    const gatewayId = env.AI_GATEWAY_ID;

    // If AI Gateway is configured, use it; otherwise try direct OpenAI
    const apiUrl = (accountId && gatewayId)
      ? `${gateway}/${accountId}/${gatewayId}/openai/audio/speech`
      : 'https://api.openai.com/v1/audio/speech';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'cf-skip-cache': 'true',  // Skip AI Gateway cache — binary audio responses cache incorrectly
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[tts API error] OpenAI returned ${response.status}: ${errBody}`);
      return Response.json({ error: 'TTS generation failed', status: response.status, detail: errBody.slice(0, 200) }, { status: 500 });
    }

    // Track TTS usage in KV (non-blocking)
    if (env.MEO_STATS) {
      const today = new Date().toISOString().slice(0, 10);
      const statsKey = `stats:${today}`;
      (context as any).waitUntil((async () => {
        try {
          const raw = await env.MEO_STATS.get(statsKey);
          const stats = raw ? JSON.parse(raw) : { messages: 0, sessions: [], ips: [], ttsCount: 0 };
          stats.ttsCount = (stats.ttsCount || 0) + 1;
          await env.MEO_STATS.put(statsKey, JSON.stringify(stats), { expirationTtl: 7 * 86400 });
        } catch {}
      })());
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('[tts API error]', err);
    return Response.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}
