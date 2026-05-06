"use client";

import FadeIn from "./FadeIn";
import Magnet from "./Magnet";
import ContactButton from "./ContactButton";
import HeroPortrait from "./HeroPortrait";

export default function HeroSection() {
  return (
    <section className="relative h-screen flex flex-col" style={{ overflowX: "clip" }}>
      <FadeIn delay={0.15} y={40} className="mt-[348px] sm:mt-[340px] md:mt-[332px] px-4">
        <h1
          className="hero-heading font-black uppercase tracking-tight w-full text-center"
          style={{
            fontSize: "clamp(2.5rem, 12vw, 14vw)" as string,
            lineHeight: 1.18,
            paddingTop: "0.1em",
          }}
        >
          ĐỘI NGŨ AI
        </h1>
      </FadeIn>

      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 top-1/2 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-0"
        style={{ width: "min(72vw, 520px)", height: "min(72vw, 520px)" }}
      >
        <FadeIn delay={0.6} y={30}>
          <Magnet padding={150} strength={3}>
            <HeroPortrait />
          </Magnet>
        </FadeIn>
      </div>

      <div className="mt-auto px-6 md:px-10 lg:px-20 flex justify-between items-end pb-7 sm:pb-8 md:pb-10 relative z-20">
        <FadeIn delay={0.35} y={20}>
          <p
            className="font-light uppercase tracking-wide leading-snug max-w-[160px] sm:max-w-[260px] md:max-w-[320px]"
            style={{
              color: "#D7E2EA",
              fontSize: "clamp(0.75rem, 1.4vw, 1.5rem)",
            }}
          >
            đội ngũ ai 18 thành viên · vận hành 24/7 · đưa công nghệ chăm sóc sức khoẻ Việt Nam lên tầm cao mới
          </p>
        </FadeIn>
        <FadeIn delay={0.5} y={20}>
          <ContactButton label="Liên Hệ" href="/lien-he" />
        </FadeIn>
      </div>
    </section>
  );
}
