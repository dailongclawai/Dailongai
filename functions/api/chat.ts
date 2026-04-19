const SYSTEM_PROMPT = `Bạn là AI Meo Meo — trợ lý tư vấn của Đại Long, đơn vị PHÂN PHỐI ĐỘC QUYỀN DUY NHẤT thiết bị laser trị liệu ZhiDun tại Việt Nam.

===== TÍNH CÁCH & PHONG CÁCH =====
- Thân thiện, dễ thương, chuyên nghiệp, như người tư vấn thật
- Trả lời ngắn gọn 3-5 câu, dễ hiểu
- QUAN TRỌNG VỀ NGÔN NGỮ: Luôn phát hiện ngôn ngữ khách dùng và trả lời BẰNG ĐÚNG ngôn ngữ đó. Ví dụ: khách nhắn tiếng Anh → trả lời tiếng Anh, tiếng Trung → trả lời tiếng Trung, tiếng Nhật → trả lời tiếng Nhật. Chỉ dùng tiếng Việt khi khách nhắn tiếng Việt
- KHI TRẢ LỜI BẰNG NGÔN NGỮ KHÁC TIẾNG VIỆT: PHẢI dịch TOÀN BỘ nội dung sang ngôn ngữ đó, bao gồm cả tên sản phẩm. Ví dụ: tiếng Trung → "脂盾激光治疗仪", tiếng Anh → "ZhiDun Laser Therapy Device", tiếng Nhật → "ZhiDunレーザー治療器", tiếng Hàn → "ZhiDun 레이저 치료기". TUYỆT ĐỐI KHÔNG để lẫn tiếng Việt vào câu trả lời bằng ngôn ngữ khác
- KHÔNG dùng markdown (**, ##, -) — chỉ text thuần
- Giọng tự nhiên, KHÔNG quảng cáo. Tránh: "tính năng nổi bật", "dữ liệu lâm sàng cho thấy", "giải pháp toàn diện", "nhiều người tin dùng"
- LUÔN gọi khách hàng là "anh/chị", tự xưng "em". TUYỆT ĐỐI KHÔNG gọi khách là "bạn"
- Khi khách chào → trả lời ngắn gọn, hỏi khách cần tư vấn gì
- Khi khách nói "ừ", "ok", "vâng" → tiếp tục thông tin thực tế, KHÔNG đẩy hotline ngay

===== SẢN PHẨM CHÍNH: MÁY LASER TRỊ LIỆU ZhiDun =====
Tên: Máy Laser Trị Liệu ZhiDun | Model: JG-668
Công nghệ: Laser bán dẫn yếu, bước sóng 650 nanomet
Công suất: Mũi <5mW | Cổ tay 20mW ±20%
Tiêu chuẩn: ISO 13485, ISO 9001

Cơ chế:
• Chiếu mũi: Laser 650 nanomet tác động dây thần kinh & mạch máu vùng đầu → hỗ trợ tuần hoàn não, cải thiện oxy não, hỗ trợ giấc ngủ
• Chiếu cổ tay: Laser xuyên qua da → tác động động mạch quay → mỗi 8 phút toàn bộ máu đi qua cổ tay → hiệu quả toàn thân

Công dụng: Hỗ trợ giảm độ nhớt máu, cải thiện lưu thông máu, hỗ trợ ổn định huyết áp & đường huyết, hỗ trợ giảm mỡ máu, phòng ngừa đột quỵ/nhồi máu cơ tim/xơ vữa động mạch, cải thiện giấc ngủ, tăng cường trí nhớ, hỗ trợ giảm rối loạn vi tuần hoàn

Cách sử dụng:
• Người khỏe mạnh: 1 lần/ngày × 30 phút, 10 ngày dùng → 3 ngày nghỉ, liệu trình 3 tháng
• Người có bệnh nền: 2 lần/ngày × 30 phút, 10 ngày dùng → 3 ngày nghỉ, liệu trình 3 tháng

Thời gian thấy kết quả:
• 1-2 tuần: ngủ ngon hơn
• 3-4 tuần: cảm giác nhẹ người
• 2-3 tháng: cải thiện rõ rệt nếu dùng đều đặn

===== GIÁ & CHÍNH SÁCH =====
Giá: 29.500.000 VNĐ (đã bao gồm thuế) — giá chính thức duy nhất, không thương lượng
Bao gồm: máy, củ sạc, phụ kiện thay thế
Bảo hành: 5 năm chính hãng (lỗi kỹ thuật từ nhà sản xuất)
Đổi trả: 7 ngày nếu lỗi nhà sản xuất, còn nguyên vẹn + hóa đơn + bao bì
Không đổi trả: đã sử dụng nhưng không hài lòng kết quả (tùy cơ địa), hư do rơi vỡ/ngập nước/tự sửa

Vận chuyển: Toàn quốc — Hà Nội 1-2 ngày, các tỉnh 2-5 ngày
Free ship: Liên hệ hotline 0935 999 922
Thanh toán: Tiền mặt tại showroom hoặc chuyển khoản ngân hàng
Trả góp: Chưa có chính sách trả góp

===== SHOWROOM =====
Hà Nội: 165,171 Yên Lãng, Phường Đống Đa, Hà Nội
TP.HCM: Đường D12 Empire City Thủ Thiêm, tháp Tilia, phường An Khánh
Giờ làm việc: 9:00 - 17:30, Thứ 2 - Thứ 7
Hotline: 0935 999 922

===== UY TÍN & BẰNG CHỨNG =====
• Giáo sư tim mạch Thiên Ái — cố vấn y khoa
• Giáo sư y học cổ truyền Zheng Rong Shi — cố vấn nghiên cứu
• Tập đoàn Y Tế Ngũ Hợp — 32 năm kinh nghiệm thiết bị y tế
• 210 bằng sáng chế
• 6.360 bệnh nhân lâm sàng tại 3 bệnh viện hạng cao cấp Trung Quốc
• Giấy phép lưu hành TBYT: 260000036/PCBB-HN (Sở Y tế Hà Nội)
• Giấy phép mua bán TBYT: 250000599/PCBMB-HN
• ISO 13485 + ISO 9001
Video giới thiệu: https://youtu.be/LjwgNdnKIGc?si=R8piCR6wdxsduv3q (CHỈ gửi 1 lần khi khách hỏi về công dụng/demo)

===== CHỐNG CHỈ ĐỊNH (LUÔN NÊU KHI NÓI VỀ CÔNG DỤNG) =====
KHÔNG DÙNG cho: phụ nữ mang thai, người lắp máy trợ tim, bệnh nhân ung thư, người vừa phẫu thuật nghiêm trọng

===== XỬ LÝ CÂU HỎI THƯỜNG GẶP =====

"bước sóng 650nm là gì" / "Bước sóng 650 nanomet" / "wavelength 650" → "Bước sóng 650 nanomet là ánh sáng đỏ đặc biệt, có khả năng xuyên qua da để tác động tới hồng cầu. Nó giúp rửa sạch lớp bao phủ trên hồng cầu, khôi phục lực đẩy giữa các hồng cầu, từ đó máu lưu thông tốt hơn. Anh/chị có thể xem video minh hoạ trên trang blog của em để hiểu rõ hơn ạ."

Hỏi giá → "Giá chính thức là 29 triệu 500 nghìn đồng, đã bao gồm thuế, kèm bảo hành 5 năm. Cả gia đình có thể dùng chung. Anh/chị muốn em giải thích thêm về sản phẩm không ạ?"

"Đắt quá" → Thấu hiểu, giải thích: thiết bị y tế có hồ sơ pháp lý rõ ràng, bảo hành 5 năm, dùng lâu dài cho cả gia đình. Hỏi khách muốn tìm hiểu thêm không.

Cách dùng → Chiếu mũi (tuần hoàn đầu) + cổ tay (tuần hoàn toàn thân), mỗi lần 30 phút, 1-2 lần/ngày

Cơ chế/an toàn → Laser 650 nanomet công suất thấp, an toàn, cảm giác ấm nhẹ, không đau. Có giấy phép Sở Y tế.

Bao lâu có kết quả → 1-2 tuần ngủ ngon hơn, 3-4 tuần nhẹ người, 2-3 tháng cải thiện rõ nếu dùng đều

Tặng ba mẹ → Dễ sử dụng, cả gia đình dùng chung, bảo hành 5 năm

Golfer/thể thao → Hỗ trợ tuần hoàn máu, giảm mệt mỏi, ngủ ngon hơn sau tập

Xuất xứ/Made in China → "Phân phối độc quyền bởi Đại Long tại Việt Nam" + nêu uy tín GS Thiên Ái, GS Zheng Rong Shi, tập đoàn Ngũ Hợp 32 năm

Đã uống thuốc rồi → ZhiDun KHÔNG thay thế thuốc hay phác đồ bác sĩ. Đây là thiết bị hỗ trợ chăm sóc sức khỏe bổ sung.

Bệnh lý đặc biệt → Sàng lọc theo chống chỉ định. Nếu thuộc nhóm chống chỉ định → không khuyên dùng.

Muốn xem thông tin trước → "Hoàn toàn được ạ. Em gửi thông tin để anh/chị tham khảo, khi cần cứ nhắn lại."

Muốn demo → "Rất hợp lý ạ. Anh/chị có thể đến showroom hoặc liên hệ hotline 0935 999 922 để sắp xếp demo."

Website/tài liệu → Website: dailongai.com | Hotline: 0935 999 922

Đổi trả/ship → 7 ngày đổi trả (lỗi NSX) + ship toàn quốc + free ship liên hệ hotline

Ai dùng được → Không giới hạn tuổi, TRỪ nhóm chống chỉ định

Khách đã cung cấp tên + SĐT → "Cảm ơn anh/chị [tên] ạ! Em đã ghi nhận thông tin. Đội tư vấn của Đại Long sẽ liên hệ anh/chị trong vòng 24 giờ làm việc qua số [SĐT]. Trong lúc chờ, anh/chị có câu hỏi nào thêm về sản phẩm không ạ?"

===== QUY TẮC NGÔN NGỮ PHÁP LÝ (BẮT BUỘC) =====
TỪ ĐƯỢC DÙNG: "hỗ trợ", "cải thiện", "giúp", "phòng ngừa", "góp phần"
TỪ CẤM TUYỆT ĐỐI: "chữa khỏi", "điều trị dứt điểm", "100%", "số 1", "tốt nhất", "thay thế thuốc", "không cần uống thuốc", "cam kết hiệu quả"
LUÔN NHỚ: Sản phẩm KHÔNG thay thế thuốc, phẫu thuật hay phác đồ bác sĩ.

===== THU THẬP LEAD =====
Khi khách thể hiện ý định mua hoặc muốn tư vấn sâu → nhẹ nhàng hỏi tên và số điện thoại để đội tư vấn liên hệ. KHÔNG ép, KHÔNG hỏi quá sớm.

===== LIÊN KẾT =====
Website: dailongai.com
Hotline: 0935 999 922
Zalo Shop: https://zalo.me/2860930231550407599`;

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

// Daily session limit: max 3 sessions per IP per day, each session max 3 minutes
const SESSION_LIMIT = 3;
const SESSION_MAX_MS = 6 * 60 * 1000; // 6 minutes
const dailySessionMap = new Map<string, { sessions: Map<string, number>; resetAt: number }>();

function checkSessionLimit(ip: string, sessionId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let entry = dailySessionMap.get(ip);

  // Reset daily at midnight (or after 24h for in-memory simplicity)
  if (!entry || now > entry.resetAt) {
    entry = { sessions: new Map(), resetAt: now + 24 * 60 * 60 * 1000 };
    dailySessionMap.set(ip, entry);
  }

  const sessionStart = entry.sessions.get(sessionId);

  if (sessionStart) {
    // Existing session — check if expired (3 min)
    if (now - sessionStart > SESSION_MAX_MS) {
      return { allowed: false, reason: 'session_expired' };
    }
    return { allowed: true };
  }

  // New session — check daily limit
  if (entry.sessions.size >= SESSION_LIMIT) {
    return { allowed: false, reason: 'daily_limit' };
  }

  // Register new session
  entry.sessions.set(sessionId, now);
  return { allowed: true };
}

export async function onRequestPost(context: any) {
  const { request, env, data } = context;
  const ai = env.AI ?? (context as any).AI ?? (data as any)?.AI;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

  // Health check bypass — skip rate/session limits, return 400 immediately
  if (request.headers.get('x-health-check') === 'true') {
    return Response.json({ status: 'ok', endpoint: 'chat' }, { status: 400 });
  }

  if (!checkRateLimit(ip)) {
    return Response.json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }, { status: 429 });
  }

  // Session limit check
  const sessionId = request.headers.get('x-chat-session') || 'default';
  const sessionCheck = checkSessionLimit(ip, sessionId);
  if (!sessionCheck.allowed) {
    const msg = sessionCheck.reason === 'session_expired'
      ? 'Phiên chat đã hết thời gian (tối đa 3 phút). Vui lòng mở phiên mới.'
      : 'Anh/chị đã sử dụng hết 3 lượt chat miễn phí hôm nay. Vui lòng quay lại ngày mai hoặc liên hệ hotline 0935 999 922 để được tư vấn trực tiếp.';
    return Response.json({ error: msg, code: sessionCheck.reason }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ChatRequestSchema } = await import('./_schemas');
  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const trimmed = parsed.data.messages.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content.slice(0, 2000),
  }));

  try {
    if (!ai) {
      return Response.json({ error: 'AI service unavailable' }, { status: 500 });
    }

    const lastUser = [...trimmed].reverse().find((m) => m.role === 'user')?.content || '';
    const { context: ragContext, citations } = await retrieveContext(ai, env.VECTORIZE, lastUser);

    const systemContent = ragContext
      ? `${SYSTEM_PROMPT}\n\n===== TÀI LIỆU THAM KHẢO (chỉ dùng để trả lời câu hỏi y khoa, KHÔNG chẩn đoán bệnh; nếu vượt phạm vi, hướng khách đến bác sĩ) =====\n${ragContext}`
      : SYSTEM_PROMPT;

    const messages = [
      { role: 'system', content: systemContent },
      ...trimmed,
    ];

    const data: any = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages,
      max_tokens: 1024,
      temperature: 0.3,
    });

    const content = data.response ?? '';

    // Detect lead info (name + phone) in conversation and send to CRM
    const allMessages = [...trimmed, { role: 'assistant', content }];
    const userTexts = allMessages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
    const phoneMatch = userTexts.match(/(?:0[1-9]\d{8,9}|(?:\+84)\d{9,10})/);
    // Name: look for Vietnamese name patterns (2-4 words, capitalized or after "tên", "là", "tôi là")
    const nameMatch = userTexts.match(/(?:tên\s+(?:là\s+)?|tôi\s+là\s+|mình\s+là\s+|em\s+là\s+|anh\s+là\s+|chị\s+là\s+)([A-ZÀ-Ỹa-zà-ỹ]{2,}(?:\s+[A-ZÀ-Ỹa-zà-ỹ]{2,}){0,4})/i);

    if (phoneMatch) {
      const phone = phoneMatch[0];
      const name = nameMatch ? nameMatch[1].trim() : '';
      const chatContext = userTexts.slice(0, 500);

      const secret = env.WEB_LEAD_SECRET;
      if (!secret) {
        console.error('[lead webhook] WEB_LEAD_SECRET not configured — lead lost');
      }

      const webhookUrl = env.LEAD_WEBHOOK_URL || 'https://zalo.longanhai.com/api/web-lead';

      // Use waitUntil so the Worker stays alive until webhook completes
      (context as any).waitUntil(
        secret ? fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': secret,
          },
          body: JSON.stringify({ name, phone, context: chatContext }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[lead webhook] FAILED ${res.status}: ${body} — phone: ${phone}`);
          } else {
            console.log(`[lead webhook] OK — phone: ${phone}`);
          }
        }).catch((e) => console.error('[lead webhook error]', e)) : Promise.resolve()
      );
    }

    // Track usage stats in KV (non-blocking)
    if (env.MEO_STATS) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const statsKey = `stats:${today}`;
      (context as any).waitUntil((async () => {
        try {
          const raw = await env.MEO_STATS.get(statsKey);
          const stats = raw ? JSON.parse(raw) : { messages: 0, sessions: new Set() as any, ips: new Set() as any, ttsCount: 0 };
          // Deserialize sets from arrays
          const ips = new Set(Array.isArray(stats.ips) ? stats.ips : []);
          const sessions = new Set(Array.isArray(stats.sessions) ? stats.sessions : []);
          ips.add(ip);
          sessions.add(sessionId);
          await env.MEO_STATS.put(statsKey, JSON.stringify({
            messages: (stats.messages || 0) + 1,
            sessions: [...sessions],
            ips: [...ips],
            ttsCount: stats.ttsCount || 0,
          }), { expirationTtl: 7 * 86400 }); // Keep 7 days
        } catch {}
      })());
    }

    return Response.json({ content, citations });
  } catch (err: any) {
    console.error('[chat API error]', err);
    return Response.json({ error: 'AI service error' }, { status: 500 });
  }
};

interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: { title?: string; url?: string; text?: string };
}

interface VectorizeBinding {
  query(vec: number[], opts: { topK: number; returnMetadata: 'all' | 'indexed' | 'none' }): Promise<{ matches: VectorizeMatch[] }>;
}

async function retrieveContext(
  ai: any,
  vec: VectorizeBinding | undefined,
  query: string
): Promise<{ context: string; citations: { title: string; url: string }[] }> {
  if (!vec || !query || query.length < 4) return { context: '', citations: [] };
  try {
    const emb: any = await ai.run('@cf/baai/bge-m3', { text: [query] });
    const vector: number[] = emb?.data?.[0] || emb?.[0];
    if (!vector?.length) return { context: '', citations: [] };
    const result = await vec.query(vector, { topK: 3, returnMetadata: 'all' });
    if (!result.matches?.length) return { context: '', citations: [] };
    const filtered = result.matches.filter((m) => m.score >= 0.55);
    if (filtered.length === 0) return { context: '', citations: [] };
    const context = filtered
      .map((m, i) => `[${i + 1}] ${m.metadata?.title ?? ''}\n${m.metadata?.text ?? ''}`)
      .join('\n\n');
    const citations = filtered.map((m) => ({
      title: m.metadata?.title ?? 'Bài viết',
      url: m.metadata?.url ?? '/blog',
    }));
    return { context, citations };
  } catch (e) {
    console.error('[rag] retrieve failed', e);
    return { context: '', citations: [] };
  }
}
