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
  {
    num: "01",
    category: "Marketing",
    name: "Sen TikTok Pipeline",
    description:
      "Tự động lấy video thể thao trending, tự caption + hashtag tiếng Việt, đăng kênh TikTok Đại Long. Anti-detection upload, auto-cover selection. Chạy 24/7 không cần can thiệp.",
    accent: "#ffea00",
    leadAvatar: "/images/team/sen-tiktok.jpeg",
    highlights: [
      { label: "Posts/tuần", value: "21+" },
      { label: "Auto pipeline", value: "100%" },
    ],
  },
  {
    num: "02",
    category: "Khách hàng",
    name: "Sen Voice 24/7",
    description:
      "Hệ thống tư vấn giọng nói tiếng Việt qua điện thoại. Sen Voice trò chuyện tự nhiên với khách hàng về thiết bị laser bán dẫn, ghi lead realtime vào CRM. LiveKit + Gemini Live backend.",
    accent: "#00ff88",
    leadAvatar: "/images/team/sen-voice.png",
    highlights: [
      { label: "Uptime", value: "24/7" },
      { label: "Ngôn ngữ", value: "VI native" },
    ],
  },
  {
    num: "03",
    category: "Marketing Ops",
    name: "Sen Marketing Ops",
    description:
      "Lead enrichment hằng ngày 8h sáng — pull GSC, GA4, outreach campaign, tổng hợp digest gửi Boss qua Telegram. Phát hiện sớm bottleneck pipeline lead → revenue.",
    accent: "#00f2ff",
    leadAvatar: "/images/team/sen-marketing-ops.jpeg",
    highlights: [
      { label: "Digest", value: "Daily 8AM" },
      { label: "Sources", value: "GA4 + GSC + Outreach" },
    ],
  },
];

function ProjectCard({ project, index, total, scrollProgress }: {
  project: Project;
  index: number;
  total: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const targetScale = 1 - (total - 1 - index) * 0.03;
  const scale = useTransform(scrollProgress, [index / total, 1], [1, targetScale]);

  return (
    <motion.div
      style={{
        scale,
        top: `${index * 28}px`,
      }}
      className="sticky top-24 md:top-32"
    >
      <div
        className="rounded-[40px] sm:rounded-[50px] md:rounded-[60px] p-4 sm:p-6 md:p-8"
        style={{
          background: "#0C0C0C",
          border: `2px solid ${project.accent}`,
          boxShadow: `0 0 40px ${project.accent}33`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-4 sm:gap-6 flex-1">
            <div
              className="font-black flex-none"
              style={{
                color: project.accent,
                fontSize: "clamp(2.5rem, 8vw, 100px)" as string,
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
                  fontSize: "clamp(1.5rem, 3vw, 2.4rem)" as string,
                  lineHeight: 1,
                }}
              >
                {project.name}
              </div>
            </div>
          </div>
          <div className="live-project-btn px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base inline-block self-start md:self-auto">
            Xem Chi Tiết
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 flex flex-col gap-4">
            <div
              className="rounded-[24px] sm:rounded-[32px] md:rounded-[40px] flex items-center justify-center overflow-hidden"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${project.accent}33, transparent 65%), linear-gradient(180deg, rgba(20,20,28,0.95), rgba(8,8,14,1))`,
                border: `1px solid ${project.accent}55`,
                height: "clamp(160px, 18vw, 240px)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.leadAvatar}
                alt={project.name}
                style={{
                  width: "60%",
                  height: "60%",
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: `3px solid ${project.accent}`,
                  boxShadow: `0 0 30px ${project.accent}99`,
                }}
              />
            </div>
            <div
              className="rounded-[24px] sm:rounded-[32px] md:rounded-[40px] p-6 flex flex-col justify-center gap-3"
              style={{
                background: `linear-gradient(135deg, ${project.accent}22, ${project.accent}11)`,
                border: `1px solid ${project.accent}55`,
                height: "clamp(180px, 22vw, 340px)",
              }}
            >
              {project.highlights.map((h) => (
                <div key={h.label} className="flex justify-between items-baseline">
                  <div
                    style={{
                      color: "#7a8092",
                      fontSize: 11,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h.label}
                  </div>
                  <div
                    style={{
                      color: project.accent,
                      fontSize: "clamp(1.2rem, 2.4vw, 2rem)" as string,
                      fontWeight: 700,
                    }}
                  >
                    {h.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="md:col-span-3 rounded-[24px] sm:rounded-[32px] md:rounded-[40px] p-8 flex flex-col justify-end overflow-hidden"
            style={{
              background: `radial-gradient(circle at 70% 30%, ${project.accent}22, transparent 60%), linear-gradient(180deg, rgba(20,20,28,0.95), rgba(8,8,14,1))`,
              border: `1px solid ${project.accent}55`,
              minHeight: "clamp(360px, 45vw, 600px)",
            }}
          >
            <p
              style={{
                color: "#D7E2EA",
                fontSize: "clamp(0.95rem, 1.8vw, 1.4rem)" as string,
                lineHeight: 1.6,
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
          className="hero-heading font-black uppercase text-center mb-16 sm:mb-20 md:mb-24 leading-none tracking-tight"
          style={{ fontSize: "clamp(3rem, 12vw, 160px)" as string }}
        >
          Showcase
        </h2>
      </FadeIn>

      <div ref={containerRef}>
        {PROJECTS.map((p, i) => (
          <div key={p.num} style={{ height: "85vh" }}>
            <ProjectCard project={p} index={i} total={PROJECTS.length} scrollProgress={scrollYProgress} />
          </div>
        ))}
      </div>
    </section>
  );
}
