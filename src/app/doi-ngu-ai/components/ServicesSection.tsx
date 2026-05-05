"use client";

import FadeIn from "./FadeIn";

type Service = {
  num: string;
  emoji: string;
  name: string;
  description: string;
};

const SERVICES: Service[] = [
  {
    num: "01",
    emoji: "⚡",
    name: "Điều Phối",
    description: "Tổ chức và điều phối hoạt động fleet — Sen Prime quản lý chat 24/7, Sen CEO theo dõi P&L, Sen Dispatch phân phối task chéo agent, Sen Manus deep research thị trường.",
  },
  {
    num: "02",
    emoji: "📣",
    name: "Marketing & Sales",
    description: "Sản xuất nội dung và quảng bá thương hiệu — Sen Meta đăng Facebook + duyệt ad, Sen TikTok lên video thể thao auto-caption, Sen Designer thiết kế poster qua Playwright, Sen Outreach tìm đối tác B2B.",
  },
  {
    num: "03",
    emoji: "💬",
    name: "Khách Hàng",
    description: "Tư vấn và hỗ trợ khách hàng 24/7 — Sen Voice trò chuyện điện thoại tiếng Việt tự nhiên, Sen Meo Meo chatbot trên dailongai.com, Sen Marketing Ops phân tích lead + analytics digest hằng ngày.",
  },
  {
    num: "04",
    emoji: "🔧",
    name: "Kỹ Thuật & Vận Hành",
    description: "Lập trình, devops, giám sát hệ thống — Sen Coder code AI fleet, Sen VPS deploy + restart, Sen Auditor quét secrets/SSL/cost, Sen Watchdog auto-recovery, Sen Daily Report digest, Sen Osin Data thu thập transcript.",
  },
  {
    num: "05",
    emoji: "🛠️",
    name: "Hạ Tầng Kỹ Thuật",
    description: "6 lớp công nghệ vận hành fleet — Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5, Supabase shared memory + fleet event bus, Mac local + VPS Linux, Telegram MCP + Zalo OA + LiveKit, Next.js 15 + React 19, Wrangler + Playwright + Cloudflare Pages.",
  },
];

export default function ServicesSection() {
  return (
    <section
      className="px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px]"
      style={{ background: "#FFFFFF", color: "#0C0C0C" }}
    >
      <FadeIn delay={0} y={40}>
        <h2
          className="font-black uppercase text-center mb-16 sm:mb-20 md:mb-28"
          style={{
            color: "#0C0C0C",
            fontSize: "clamp(3rem, 12vw, 160px)" as string,
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
          }}
        >
          Phòng Ban
        </h2>
      </FadeIn>

      <div className="max-w-5xl mx-auto">
        {SERVICES.map((s, i) => (
          <FadeIn key={s.num} delay={i * 0.1} y={30}>
            <div
              className="flex flex-col sm:flex-row gap-4 sm:gap-8 md:gap-12 items-start sm:items-center py-8 sm:py-10 md:py-12"
              style={{ borderTop: i === 0 ? "1px solid rgba(12,12,12,0.15)" : "none", borderBottom: "1px solid rgba(12,12,12,0.15)" }}
            >
              <div
                className="font-black flex-none"
                style={{
                  color: "#0C0C0C",
                  fontSize: "clamp(2.5rem, 10vw, 140px)" as string,
                  lineHeight: 0.9,
                  width: "min(20vw, 200px)",
                }}
              >
                {s.num}
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div
                  className="font-medium uppercase"
                  style={{
                    fontSize: "clamp(1.1rem, 2.2vw, 2.1rem)" as string,
                    letterSpacing: "0.02em",
                  }}
                >
                  {s.emoji} {s.name}
                </div>
                <div
                  className="font-light leading-relaxed max-w-2xl"
                  style={{
                    color: "rgba(12,12,12,0.6)",
                    fontSize: "clamp(0.85rem, 1.6vw, 1.25rem)" as string,
                  }}
                >
                  {s.description}
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
