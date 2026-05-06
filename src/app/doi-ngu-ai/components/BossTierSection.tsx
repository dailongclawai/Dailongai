"use client";

import FadeIn from "./FadeIn";

export default function BossTierSection() {
  return (
    <section className="relative flex flex-col items-center px-6 md:px-12 py-24 md:py-32 max-w-7xl mx-auto">
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255, 144, 105, 0.12) 0%, rgba(14, 14, 17, 0) 70%)",
        }}
      />

      <FadeIn delay={0} y={30}>
        <div className="relative group">
          <div
            className="absolute -inset-4 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "rgba(255, 144, 105, 0.25)" }}
          />
          <div
            className="relative w-48 h-48 md:w-56 md:h-56 rounded-full flex items-center justify-center text-8xl overflow-hidden"
            style={{
              background: "#19191d",
              border: "2px solid rgba(255, 144, 105, 0.3)",
            }}
          >
            👑
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.15} y={30} className="mt-8 text-center">
        <h2
          className="font-extrabold tracking-tighter uppercase mb-4"
          style={{
            color: "#f0edf1",
            fontSize: "clamp(2.5rem, 6vw, 4rem)" as string,
            lineHeight: 0.95,
          }}
        >
          Ông Chủ
        </h2>
        <p
          className="font-semibold tracking-widest uppercase mb-6 text-sm md:text-base"
          style={{ color: "#ff9069", letterSpacing: "0.2em" }}
        >
          Founder &amp; Chairman · Đại Long Medical
        </p>
        <div
          className="max-w-2xl mx-auto p-6 rounded-2xl backdrop-blur-md"
          style={{
            background: "rgba(19, 19, 22, 0.5)",
            border: "1px solid rgba(72, 71, 75, 0.25)",
          }}
        >
          <p
            className="leading-relaxed text-base md:text-lg"
            style={{ color: "#acaaae" }}
          >
            Người sáng lập Đại Long Medical · Kiến trúc sư AI fleet 17 agent. Tầm nhìn dẫn dắt hệ sinh thái y tế số tương lai.
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
