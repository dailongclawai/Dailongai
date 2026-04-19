"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

const iconNames: Record<string, string> = {
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  cpu: "M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
};

export default function AboutSection() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);

  const aboutFeatures = [
    { icon: "shield", title: t('about.feat1_title'), description: t('about.feat1_desc') },
    { icon: "cpu", title: t('about.feat2_title'), description: t('about.feat2_desc') },
    { icon: "users", title: t('about.feat3_title'), description: t('about.feat3_desc') },
    { icon: "heart", title: t('about.feat4_title'), description: t('about.feat4_desc') },
  ];

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(".about-head > *", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".about-head", start: "top 80%" } });
        gsap.fromTo(".about-card", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".about-grid", start: "top 85%" } });
      }, sectionRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  return (
    <section ref={sectionRef} id="about" className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 2xl:px-20 bg-surface-low">
      <div className="max-w-screen-2xl mx-auto">
        {/* Asymmetric header */}
        <div className="about-head text-center mb-14 sm:mb-16 space-y-4">
          <div className="space-y-3">
            <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase">{t('about.title')}</h2>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline leading-tight tracking-tighter">
              {t('about.heading')}
            </h3>
          </div>
        </div>

        {/* Bento grid: first card spans 2 cols, rest 1 col each */}
        <div className="about-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
          {aboutFeatures.map((f, i) => (
            <div key={f.title} className={`about-card glass-panel p-5 sm:p-6 rounded-xl space-y-3 text-center sm:space-y-4 group transition-all opacity-0 ${
              i === 0 ? "lg:col-span-7" : i === 1 ? "lg:col-span-5" : i === 2 ? "lg:col-span-5" : "lg:col-span-7"
            }`}>
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconNames[f.icon]} />
              </svg>
              <h4 className="text-base sm:text-lg font-bold font-headline uppercase tracking-tight">{f.title}</h4>
              <p className="text-secondary text-xs sm:text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
