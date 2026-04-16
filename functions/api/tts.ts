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

  let body: { text: string; voice?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text, voice } = body;
  if (!text || typeof text !== 'string' || text.length === 0) {
    return Response.json({ error: 'text is required' }, { status: 400 });
  }
  if (text.length > 2000) {
    return Response.json({ error: 'text must be 2000 characters or less' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice || 'nova',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      console.error(`[tts API error] OpenAI returned ${response.status}`);
      return Response.json({ error: 'TTS generation failed' }, { status: 500 });
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
