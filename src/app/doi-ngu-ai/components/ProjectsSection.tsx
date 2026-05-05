"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import FadeIn from "./FadeIn";

type Project = {
  num: string;
  category: string;
  name: string;
  description: string;
  accent: string;
  leadAvatar: string;
  highlights: { label: string; value: string }[];
};

const PROJECTS: Project[] = [
  // ĐIỀU PHỐI · cyan
  {
    num: "01",
    category: "Điều Phối",
    name: "Sen Prime",
    description: "Điều Phối Tổng — quản lý chat, route task chéo agent qua MCP, giám sát fleet 24/7. Memory consolidator + comms hub trung tâm.",
    accent: "#00f2ff",
    leadAvatar: "/images/team/sen-prime.jpg",
    highlights: [{ label: "Uptime", value: "24/7" }, { label: "Tasks routed", value: "1000+/ngày" }],
  },
  {
    num: "02",
    category: "Điều Phối",
    name: "Sen CEO",
    description: "CEO Đại Long Medical — tracking P&L, outreach Zhi Dun, lead-to-revenue pipeline. ClawHub native skills, weekly retro CN 21h VN.",
    accent: "#00f2ff",
    leadAvatar: "/images/team/sen-ceo.jpeg",
    highlights: [{ label: "P&L", value: "Real-time" }, { label: "Retro", value: "Weekly" }],
  },
  {
    num: "03",
    category: "Điều Phối",
    name: "Sen Dispatch",
    description: "Orchestrator generalist — điều phối task chéo agent, thu thập transcript Cowork, proxy approve task delegation.",
    accent: "#00f2ff",
    leadAvatar: "/images/team/sen-dispatch.png",
    highlights: [{ label: "Proxy approve", value: "ON" }, { label: "Transcript", value: "Auto collect" }],
  },
  {
    num: "04",
    category: "Điều Phối",
    name: "Sen Manus",
    description: "Deep Research — browser task, market study, competitor analysis chuyên sâu. Manus AI Pro client của Sen GPT Bridge MCP.",
    accent: "#00f2ff",
    leadAvatar: "/images/team/sen-manus.png",
    highlights: [{ label: "Manus Pro", value: "MCP" }, { label: "Heartbeat", value: "Per-request" }],
  },
  // MARKETING · yellow
  {
    num: "05",
    category: "Marketing",
    name: "Sen Meta",
    description: "Facebook Manager — đăng bài Page Đại Long, ad approval workflow qua @SenMetaSocial_bot. Phase 1 stable, content scheduling Page B.",
    accent: "#ffea00",
    leadAvatar: "/images/team/sen-meta.jpeg",
    highlights: [{ label: "FB Pages", value: "2 active" }, { label: "Approval gate", value: "Telegram" }],
  },
  {
    num: "06",
    category: "Marketing",
    name: "Sen TikTok",
    description: "TikTok Producer — sports repost (golf swing, F1 highlight), video upload anti-detection, auto-caption + hashtag tiếng Việt.",
    accent: "#ffea00",
    leadAvatar: "/images/team/sen-tiktok.jpeg",
    highlights: [{ label: "Posts/tuần", value: "21+" }, { label: "Auto pipeline", value: "100%" }],
  },
  {
    num: "07",
    category: "Marketing",
    name: "Sen Designer",
    description: "Designer — tạo poster, thumbnail, banner qua claude -p (Max sub) → Playwright PNG/PDF render. cgm to_gateway worker.",
    accent: "#ffea00",
    leadAvatar: "/images/team/sen-designer.jpeg",
    highlights: [{ label: "Output", value: "PNG/PDF" }, { label: "Engine", value: "Playwright" }],
  },
  {
    num: "08",
    category: "Marketing",
    name: "Sen Outreach",
    description: "Partner Outreach — tìm kiếm và tiếp cận đối tác B2B chiến lược. Schema-driven, AI lead scoring, campaign execution.",
    accent: "#ffea00",
    leadAvatar: "/images/team/sen-outreach.png",
    highlights: [{ label: "Partners", value: "B2B" }, { label: "Schema", value: "AI-driven" }],
  },
  // KHÁCH HÀNG · green
  {
    num: "09",
    category: "Khách Hàng",
    name: "Sen Voice",
    description: "Tư Vấn Giọng Nói tiếng Việt 24/7 qua điện thoại tự nhiên. LiveKit + Gemini Live backend, ghi lead realtime vào CRM.",
    accent: "#00ff88",
    leadAvatar: "/images/team/sen-voice.png",
    highlights: [{ label: "Uptime", value: "24/7" }, { label: "Ngôn ngữ", value: "VI native" }],
  },
  {
    num: "10",
    category: "Khách Hàng",
    name: "Sen Meo Meo",
    description: "Chatbot Web — tư vấn và thu lead trên dailongai.com. Voice agent integration, knowledge base RAG từ 187 chunk blog.",
    accent: "#00ff88",
    leadAvatar: "/images/team/sen-meo-meo.png",
    highlights: [{ label: "Web chat", value: "Realtime" }, { label: "RAG", value: "187 chunks" }],
  },
  {
    num: "11",
    category: "Khách Hàng",
    name: "Sen Marketing Ops",
    description: "Marketing Ops — lead enrichment 8h sáng + analytics digest qua GSC/GA4/outreach, Telegram digest gửi Boss hằng ngày.",
    accent: "#00ff88",
    leadAvatar: "/images/team/sen-marketing-ops.jpeg",
    highlights: [{ label: "Digest", value: "Daily 8AM" }, { label: "Sources", value: "GA4+GSC" }],
  },
  // KỸ THUẬT · magenta
  {
    num: "12",
    category: "Kỹ Thuật",
    name: "Sen Coder",
    description: "Kỹ Sư Phần Mềm AI — lập trình, debug, devops cho toàn bộ AI fleet. Claude Code CLI, full filesystem + tool access.",
    accent: "#ff00ff",
    leadAvatar: "/images/team/sen-coder.jpeg",
    highlights: [{ label: "Stack", value: "Full-stack" }, { label: "Mode", value: "Code+Devops" }],
  },
  {
    num: "13",
    category: "Kỹ Thuật",
    name: "Sen VPS",
    description: "VPS Operator — deploy, health, log, restart cho VPS sản xuất. SSH automation, atomic deploy với rsync swap.",
    accent: "#ff00ff",
    leadAvatar: "/images/team/sen-vps.jpg",
    highlights: [{ label: "Host", value: "VPS Linux" }, { label: "Restart", value: "Auto" }],
  },
  {
    num: "14",
    category: "Kỹ Thuật",
    name: "Sen Auditor",
    description: "Auditor MVP — quét secrets, SSL expiry, cost scanner định kỳ. Bash+Node hybrid, no daemon.",
    accent: "#ff00ff",
    leadAvatar: "/images/team/sen-auditor.jpeg",
    highlights: [{ label: "Scan", value: "Secrets+SSL+Cost" }, { label: "Findings", value: "0 critical" }],
  },
  {
    num: "15",
    category: "Kỹ Thuật",
    name: "Sen Watchdog",
    description: "Watchdog — giám sát Telegram/Zalo/Gateway 24/7, SLA monitoring, auto-recovery khi service down.",
    accent: "#ff00ff",
    leadAvatar: "/images/team/sen-watchdog.jpeg",
    highlights: [{ label: "Channels", value: "TG+Zalo+GW" }, { label: "Recovery", value: "Auto" }],
  },
  {
    num: "16",
    category: "Kỹ Thuật",
    name: "Sen Daily Report",
    description: "Daily Report — tổng hợp digest fleet hằng ngày qua Telegram. Memory consolidation từ shared_memory + fleet_events.",
    accent: "#ff00ff",
    leadAvatar: "/images/team/sen-daily-report.jpg",
    highlights: [{ label: "Cadence", value: "Daily" }, { label: "Channel", value: "Telegram" }],
  },
  {
    num: "17",
    category: "Kỹ Thuật",
    name: "Sen Osin Data",
    description: "OSINT Data — thu thập transcript Cowork, làm sạch, phân loại. Auto-extract skill 2h cron, sen-skill CLI integration.",
    accent: "#ff00ff",
    leadAvatar: "/images/team/sen-osin-data.jpeg",
    highlights: [{ label: "Cron", value: "2h" }, { label: "Output", value: "Skill extract" }],
  },
];

const PROJECT_HEIGHT_VH = 60;
const SCALE_STEP = 0.012;
const TOP_STEP_PX = 12;

function ProjectCard({
  project,
  index,
  total,
  scrollProgress,
}: {
  project: Project;
  index: number;
  total: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const targetScale = 1 - (total - 1 - index) * SCALE_STEP;
  const scale = useTransform(scrollProgress, [index / total, 1], [1, targetScale]);

  return (
    <motion.div
      style={{
        scale,
        top: `${index * TOP_STEP_PX}px`,
      }}
      className="sticky top-24 md:top-32"
    >
      <div
        className="rounded-[36px] sm:rounded-[44px] md:rounded-[56px] p-4 sm:p-5 md:p-7"
        style={{
          background: "#0C0C0C",
          border: `2px solid ${project.accent}`,
          boxShadow: `0 0 36px ${project.accent}33`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 mb-5 md:mb-6">
          <div className="flex items-center gap-4 sm:gap-6 flex-1">
            <div
              className="font-black flex-none"
              style={{
                color: project.accent,
                fontSize: "clamp(2rem, 6vw, 80px)" as string,
                lineHeight: 0.9,
              }}
            >
              {project.num}
            </div>
            <div className="flex flex-col gap-1">
              <div
                className="uppercase font-medium tracking-widest"
                style={{ color: project.accent, fontSize: 11, letterSpacing: "0.2em" }}
              >
                {project.category}
              </div>
              <div
                className="font-medium"
                style={{
                  color: "#fff",
                  fontSize: "clamp(1.3rem, 2.6vw, 2rem)" as string,
                  lineHeight: 1,
                }}
              >
                {project.name}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
          <div className="md:col-span-2 flex flex-row md:flex-col gap-3 md:gap-4">
            <div
              className="rounded-[20px] sm:rounded-[26px] md:rounded-[32px] flex items-center justify-center overflow-hidden flex-1"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${project.accent}33, transparent 65%), linear-gradient(180deg, rgba(20,20,28,0.95), rgba(8,8,14,1))`,
                border: `1px solid ${project.accent}55`,
                aspectRatio: "1",
                maxHeight: "clamp(140px, 16vw, 200px)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.leadAvatar}
                alt={project.name}
                style={{
                  width: "65%",
                  height: "65%",
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: `3px solid ${project.accent}`,
                  boxShadow: `0 0 24px ${project.accent}99`,
                }}
              />
            </div>
            <div
              className="rounded-[20px] sm:rounded-[26px] md:rounded-[32px] p-4 md:p-5 flex flex-col justify-center gap-2 md:gap-3 flex-1"
              style={{
                background: `linear-gradient(135deg, ${project.accent}22, ${project.accent}11)`,
                border: `1px solid ${project.accent}55`,
              }}
            >
              {project.highlights.map((h) => (
                <div key={h.label} className="flex justify-between items-baseline gap-2">
                  <div
                    style={{
                      color: "#7a8092",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h.label}
                  </div>
                  <div
                    style={{
                      color: project.accent,
                      fontSize: "clamp(0.95rem, 1.6vw, 1.4rem)" as string,
                      fontWeight: 700,
                      textAlign: "right",
                    }}
                  >
                    {h.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="md:col-span-3 rounded-[20px] sm:rounded-[26px] md:rounded-[32px] p-5 md:p-7 flex flex-col justify-end overflow-hidden"
            style={{
              background: `radial-gradient(circle at 70% 30%, ${project.accent}22, transparent 60%), linear-gradient(180deg, rgba(20,20,28,0.95), rgba(8,8,14,1))`,
              border: `1px solid ${project.accent}55`,
              minHeight: "clamp(180px, 24vw, 320px)",
            }}
          >
            <p
              style={{
                color: "#D7E2EA",
                fontSize: "clamp(0.9rem, 1.5vw, 1.2rem)" as string,
                lineHeight: 1.55,
                fontWeight: 300,
              }}
            >
              {project.description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ProjectsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <section
      className="rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 relative z-10 px-5 sm:px-8 md:px-10 py-20"
      style={{ background: "#0C0C0C" }}
    >
      <FadeIn delay={0} y={40}>
        <h2
          className="hero-heading font-black uppercase text-center mb-12 sm:mb-16 md:mb-20 leading-none tracking-tight"
          style={{ fontSize: "clamp(3rem, 12vw, 160px)" as string }}
        >
          Showcase 17 Sen
        </h2>
      </FadeIn>

      <div ref={containerRef}>
        {PROJECTS.map((p, i) => (
          <div key={p.num} style={{ height: `${PROJECT_HEIGHT_VH}vh` }}>
            <ProjectCard project={p} index={i} total={PROJECTS.length} scrollProgress={scrollYProgress} />
          </div>
        ))}
      </div>
    </section>
  );
}
