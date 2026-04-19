import { StatsQuerySchema } from "./_schemas";

export async function onRequestGet(context: any) {
  const { env, request } = context;

  // Simple auth via secret header
  const secret = request.headers.get('x-stats-secret');
  if (!secret || secret !== env.STATS_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.MEO_STATS) {
    return Response.json({ error: 'Stats not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const queryParsed = StatsQuerySchema.safeParse({ date: url.searchParams.get('date') ?? undefined });
  if (!queryParsed.success) {
    return Response.json({ error: 'Invalid date parameter' }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const dateParam = queryParsed.data.date || today;
  const statsKey = `stats:${dateParam}`;

  const raw = await env.MEO_STATS.get(statsKey);
  if (!raw) {
    return Response.json({ date: dateParam, messages: 0, uniqueUsers: 0, sessions: 0, ttsCount: 0 });
  }

  const stats = JSON.parse(raw);
  return Response.json({
    date: dateParam,
    messages: stats.messages || 0,
    uniqueUsers: Array.isArray(stats.ips) ? stats.ips.length : 0,
    sessions: Array.isArray(stats.sessions) ? stats.sessions.length : 0,
    ttsCount: stats.ttsCount || 0,
  });
}
