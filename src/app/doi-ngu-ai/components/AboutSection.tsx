"use client";

import FadeIn from "./FadeIn";
import AnimatedText from "./AnimatedText";
import ContactButton from "./ContactButton";
import { useI18n } from "@/lib/i18n";

function Blob({
  position,
  color,
  size,
  delay,
  fromX,
}: {
  position: string;
  color: string;
  size: string;
  delay: number;
  fromX: number;
}) {
  return (
    <FadeIn
      delay={delay}
      duration={0.9}
      x={fromX}
      y={0}
      className={`absolute ${position} ${size} pointer-events-none`}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `radial-gradient(circle, ${color}aa, ${color}33 50%, transparent 75%)`,
          filter: "blur(12px)",
        }}
      />
    </FadeIn>
  );
}

export default function AboutSection() {
  const { t } = useI18n();
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 md:px-10 py-20 overflow-hidden"
      style={{ background: "#0C0C0C" }}
    >
      <Blob
        position="top-[4%] left-[1%] sm:left-[2%] md:left-[4%]"
        color="#ff9069"
        size="w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[210px] md:h-[210px]"
        delay={0.1}
        fromX={-80}
      />
      <Blob
        position="bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%]"
        color="#00f2ff"
        size="w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] md:w-[180px] md:h-[180px]"
        delay={0.25}
        fromX={-80}
      />
      <Blob
        position="top-[4%] right-[1%] sm:right-[2%] md:right-[4%]"
        color="#ff2d88"
        size="w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[210px] md:h-[210px]"
        delay={0.15}
        fromX={80}
      />
      <Blob
        position="bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%]"
        color="#ffea00"
        size="w-[130px] h-[130px] sm:w-[170px] sm:h-[170px] md:w-[220px] md:h-[220px]"
        delay={0.3}
        fromX={80}
      />

      <div className="flex flex-col items-center gap-10 sm:gap-14 md:gap-16 relative z-10">
        <FadeIn delay={0} y={40}>
          <h2
            className="hero-heading font-black uppercase tracking-tight text-center"
            style={{ fontSize: "clamp(3rem, 12vw, 160px)" as string }}
          >
            {t("team.about.heading")}
          </h2>
        </FadeIn>

        <AnimatedText
          text={t("team.about.body")}
          className="font-medium text-center leading-relaxed max-w-[680px]"
        />

        <FadeIn delay={0.2} y={20}>
          <ContactButton label={t("team.cta.button")} href="/lien-he" />
        </FadeIn>
      </div>
    </section>
  );
}
