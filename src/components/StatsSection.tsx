"use client";

import { useEffect, useRef } from "react";
import { certifications } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

export default function StatsSection() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);

  const infographicData = [
    { value: "650nm", sub: t('stats.laser_label'), desc: t('stats.laser_desc'), color: "primary" as const },
    { value: t('stats.warranty_val'), sub: t('stats.warranty_label'), desc: t('stats.warranty_desc'), color: "tertiary" as const },
    { value: "GP", sub: t('stats.license_label'), desc: t('stats.license_desc'), color: "primary" as const },
    { value: "ISO", sub: "13485", desc: t('stats.iso_desc'), color: "tertiary" as const },
    { value: t('stats.return_val'), sub: t('stats.return_label'), desc: t('stats.return_desc'), color: "primary" as const },
    { value: "29.5tr", sub: t('stats.currency'), desc: t('stats.price_desc'), color: "tertiary" as const },
  ];

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(".stat-head > *", { y: 40 }, {
          y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out",
          scrollTrigger: { trigger: ".stat-head", start: "top 85%" },
        });

        // Zigzag: even items from left, odd from right
        document.querySelectorAll(".zigzag-item").forEach((el, i) => {
          gsap.fromTo(el,
            { x: i % 2 === 0 ? -60 : 60, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.7, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 88%" },
            }
          );
        });

        gsap.fromTo(".cert-strip > *", { y: 20, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out",
          scrollTrigger: { trigger: ".cert-strip", start: "top 88%" },
        });
      }, sectionRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  const certLabels: Record<string, string> = {
    "ISO 13485": t('cert.iso13485'),
    "ISO 9001": t('cert.iso9001'),
    "GP Lưu hành VN": t('cert.license_vn'),
    "GP Lưu hành TQ": t('cert.license_cn'),
    "GP Mua bán": t('cert.trade_license'),
  };

  return (
    <section ref={sectionRef} className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 2xl:px-20 bg-surface-low relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-container/5 to-transparent pointer-events-none" />

      <div className="max-w-screen-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="stat-head text-center mb-14 sm:mb-16 space-y-4">
          <div className="space-y-3">
            <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase">{t('stats.subtitle')}</h2>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline leading-tight tracking-tighter">
              {(() => {
                const [brand, emphasis] = t('stats.heading').split('|');
                return (
                  <>
                    {brand}
                    <br className="hidden sm:block" />
                    <span className="text-primary italic"> {emphasis}</span>
                  </>
                );
              })()}
            </h3>
          </div>
          <p className="max-w-3xl mx-auto text-secondary text-sm leading-relaxed">
            {t('stats.desc')}
          </p>
        </div>

        {/* Zigzag infographic */}
        <div className="relative max-w-6xl mx-auto">
          {/* Vertical center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-tertiary/20 to-primary/30 hidden sm:block" />

          <div className="space-y-4 sm:space-y-0">
            {infographicData.map((item, i) => {
              const isLeft = i % 2 === 0;
              return (
                <div key={item.value + item.sub} className={`zigzag-item relative opacity-0 sm:flex sm:items-center sm:min-h-[100px] ${isLeft ? "sm:flex-row" : "sm:flex-row-reverse"}`}>
                  {/* Content card */}
                  <div className={`flex-1 ${isLeft ? "sm:pr-10 sm:text-right" : "sm:pl-10 sm:text-left"}`}>
                    <div className={`bg-surface-container p-4 sm:p-5 rounded-xl border-l-2 sm:border-l-0 ${
                      isLeft ? "sm:border-r-2" : "sm:border-l-2"
                    } ${item.color === "primary" ? "border-primary/30" : "border-tertiary/30"}`}>
                      <p className="text-secondary text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>

                  {/* Center node */}
                  <div className="hidden sm:flex flex-col items-center z-10 flex-shrink-0 w-24">
                    <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center ${
                      item.color === "primary" ? "bg-primary-container/15 border border-primary/20" : "bg-tertiary-container/15 border border-tertiary/20"
                    }`}>
                      <span className={`text-sm font-black font-headline tracking-tight ${item.color === "primary" ? "text-primary" : "text-tertiary"}`}>{item.value}</span>
                      <span className="text-[8px] text-secondary uppercase tracking-wider">{item.sub}</span>
                    </div>
                  </div>

                  {/* Mobile: inline value */}
                  <div className="sm:hidden flex items-center gap-3 mb-2">
                    <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
                      item.color === "primary" ? "bg-primary-container/15 border border-primary/20" : "bg-tertiary-container/15 border border-tertiary/20"
                    }`}>
                      <span className={`text-xs font-black font-headline ${item.color === "primary" ? "text-primary" : "text-tertiary"}`}>{item.value}</span>
                      <span className="text-[7px] text-secondary uppercase">{item.sub}</span>
                    </div>
                  </div>

                  {/* Spacer for the other side */}
                  <div className="flex-1 hidden sm:block" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Certification strip */}
        <div className="cert-strip mt-10 sm:mt-14 flex flex-wrap justify-center gap-3 sm:gap-4">
          {certifications.map((c) => (
            <div key={c.code} className="flex items-center gap-2 bg-surface-container px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-white/5 opacity-0">
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-headline font-bold text-[10px] sm:text-xs text-on-surface uppercase tracking-tight">{c.code}</span>
                <span className="text-secondary text-[9px] sm:text-[10px] ml-1.5 hidden sm:inline">{certLabels[c.code] || c.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
