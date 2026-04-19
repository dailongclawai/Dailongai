import { ChatRequestSchema } from "./_schemas";

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const ai = env.AI;
  if (!ai) return Response.json({ error: 'AI service unavailable' }, { status: 500 });

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const trimmed = parsed.data.messages.slice(-10);
  const lastUser = [...trimmed].reverse().find((m) => m.role === 'user')?.content || '';

  const { context: ragContext, citations } = await retrieveContext(ai, env.VECTORIZE, lastUser);

  const SYSTEM = `Bạn là AI Meo Meo — trợ lý của Đại Long. Trả lời ngắn (3-5 câu), thân thiện, KHÔNG dùng markdown. KHÔNG chẩn đoán bệnh; nếu câu hỏi vượt phạm vi y khoa cơ bản, hướng khách đến bác sĩ hoặc hotline 0935 999 922.${ragContext ? `\n\nTÀI LIỆU THAM KHẢO:\n${ragContext}` : ''}`;

  const aiResp: any = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [{ role: 'system', content: SYSTEM }, ...trimmed],
    max_tokens: 1024,
    temperature: 0.3,
    stream: true,
  });

  const encoder = new TextEncoder();
  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = (aiResp as ReadableStream).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.response) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: evt.response })}\n\n`));
              }
            } catch { /* skip non-JSON lines */ }
          }
        }
        controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ citations })}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (err) {
        console.error('[chat-stream]', err);
        controller.enqueue(encoder.encode(`event: error\ndata: {"error":"stream failed"}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

interface VectorizeMatch { id: string; score: number; metadata?: { title?: string; url?: string; text?: string } }
interface VectorizeBinding { query(vec: number[], opts: { topK: number; returnMetadata: 'all' | 'indexed' | 'none' }): Promise<{ matches: VectorizeMatch[] }> }

async function retrieveContext(ai: any, vec: VectorizeBinding | undefined, query: string) {
  if (!vec || !query || query.length < 4) return { context: '', citations: [] as { title: string; url: string }[] };
  try {
    const emb: any = await ai.run('@cf/baai/bge-m3', { text: [query] });
    const vector: number[] = emb?.data?.[0] || emb?.[0];
    if (!vector?.length) return { context: '', citations: [] };
    const result = await vec.query(vector, { topK: 3, returnMetadata: 'all' });
    const filtered = (result.matches || []).filter((m) => m.score >= 0.55);
    if (filtered.length === 0) return { context: '', citations: [] };
    return {
      context: filtered.map((m, i) => `[${i + 1}] ${m.metadata?.title ?? ''}\n${m.metadata?.text ?? ''}`).join('\n\n'),
      citations: filtered.map((m) => ({ title: m.metadata?.title ?? 'Bài viết', url: m.metadata?.url ?? '/blog' })),
    };
  } catch {
    return { context: '', citations: [] };
  }
}
