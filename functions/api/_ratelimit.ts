// Quota shared by every AI endpoint, held in KV.
//
// Two reasons this is not a module-level Map: each Workers isolate gets its own
// heap and is recycled constantly, so in-memory counters barely bind at all; and
// /api/chat and /api/chat-stream bill the same Workers AI account, so they must
// draw down one counter or a caller just switches endpoint to reset the quota.

export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const RATE_WINDOW_SEC = 60;

// Daily session limit: max 3 sessions per IP per day, each session max 6 minutes
const SESSION_LIMIT = 3;
const SESSION_MAX_MS = 6 * 60 * 1000;
const SESSION_DAY_SEC = 24 * 60 * 60;

export async function checkRateLimit(kv: KV, bucket: string, ip: string, limit: number): Promise<boolean> {
  const key = `rl:${bucket}:${ip}`;
  const current = parseInt((await kv.get(key)) || '0', 10);
  if (current >= limit) return false;
  await kv.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SEC });
  return true;
}

export async function checkSessionLimit(
  kv: KV,
  ip: string,
  sessionId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const now = Date.now();
  const sessionKey = `sess:${ip}:${sessionId}`;

  // Keep the start stamp for a full day so an elapsed session reports as expired
  // instead of silently costing the caller another daily slot.
  const startRaw = await kv.get(sessionKey);
  if (startRaw) {
    if (now - parseInt(startRaw, 10) > SESSION_MAX_MS) {
      return { allowed: false, reason: 'session_expired' };
    }
    return { allowed: true };
  }

  const countKey = `sessday:${ip}`;
  const used = parseInt((await kv.get(countKey)) || '0', 10);
  if (used >= SESSION_LIMIT) {
    return { allowed: false, reason: 'daily_limit' };
  }

  await kv.put(sessionKey, String(now), { expirationTtl: SESSION_DAY_SEC });
  await kv.put(countKey, String(used + 1), { expirationTtl: SESSION_DAY_SEC });
  return { allowed: true };
}
