// LiveKit access token endpoint for Meo Meo Voice agent.
//
// GET  → health probe used by app/lib/watchdog-checks.js (checkMeoVoice).
//        Responds 200 with { livekit_configured: boolean, url?: string }.
// POST → mint a JWT for a browser client to join a LiveKit room and talk to
//        the Meo Meo Voice agent (livekit.plugins.google + Gemini Live).
//        Body: { room?: string, identity?: string, name?: string }.
//        Response: { token: string, url: string, room: string, identity: string }.
//
// JWT signed with HS256 using Web Crypto (no node deps, runs on CF Pages V8).

interface Env {
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
}

const TOKEN_TTL_SECONDS = 60 * 30; // 30 minutes
const RATE_LIMIT_PER_MIN = 10;
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false;
  entry.count++;
  return true;
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signLiveKitToken(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  room: string;
  ttlSeconds: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: opts.apiKey,
    sub: opts.identity,
    iat: now,
    nbf: now,
    exp: now + opts.ttlSeconds,
    video: {
      roomJoin: true,
      room: opts.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };
  if (opts.name) payload.name = opts.name;

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(opts.apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export async function onRequestGet(context: { env: Env }) {
  const { env } = context;
  const configured = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  return Response.json({
    livekit_configured: configured,
    url: configured ? env.LIVEKIT_URL : undefined,
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }, { status: 429 });
  }

  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return Response.json({ error: 'Voice service not configured' }, { status: 500 });
  }

  let body: { room?: string; identity?: string; name?: string } = {};
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json();
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const room = (body.room || 'meo-voice').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  const identity = (body.identity || `web-${crypto.randomUUID().slice(0, 8)}`).slice(0, 64);
  const displayName = body.name ? String(body.name).slice(0, 64) : undefined;

  const token = await signLiveKitToken({
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    identity,
    name: displayName,
    room,
    ttlSeconds: TOKEN_TTL_SECONDS,
  });

  return Response.json({
    token,
    url: env.LIVEKIT_URL,
    room,
    identity,
  });
}
