"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

export default function SolutionsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { t, locale } = useI18n();

  const marqueeItems = ["ZhiDun", "Laser 650nm", t('marquee.warranty'), "ISO 13485", t('marquee.consult'), t('marquee.shipping')];

  const solutions = [
    {
      id: 1,
      title: t('solutions.s1_title'),
      description: t('solutions.s1_desc'),
      image: "/images/zhidun-2.webp",
      highlights: [t('solutions.h1_1'), t('solutions.h1_2'), t('solutions.h1_3')],
    },
    {
      id: 2,
      title: t('solutions.s2_title'),
      description: t('solutions.s2_desc'),
      image: "/images/zhidun-3.webp",
      highlights: [t('solutions.h2_1'), t('solutions.h2_2'), t('solutions.h2_3')],
    },
    {
      id: 3,
      title: t('solutions.s3_title'),
      description: t('solutions.s3_desc'),
      image: "",
      icon: "consult",
      highlights: [t('solutions.h3_1'), t('solutions.h3_2'), t('solutions.h3_3')],
    },
    {
      id: 4,
      title: t('solutions.s4_title'),
      description: t('solutions.s4_desc'),
      image: "",
      icon: "support",
      highlights: [t('solutions.h4_1'), t('solutions.h4_2'), t('solutions.h4_3')],
    },
  ];

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(".sol-head > *", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".sol-head", start: "top 80%" } });
        gsap.fromTo(".sol-card", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: "power3.out", scrollTrigger: { trigger: ".sol-grid", start: "top 85%" } });
      }, sectionRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  return (
    <section ref={sectionRef} id="solutions" className="relative py-24 sm:py-32 px-5 sm:px-8 lg:px-12 2xl:px-20 overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-container/5 to-transparent pointer-events-none" />

      <div className="overflow-hidden py-4 sm:py-5 border-b border-white/5 mb-10">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="flex items-center gap-5 sm:gap-6 px-4 sm:px-6 whitespace-nowrap">
              <span className="text-secondary/40 text-[10px] sm:text-xs font-headline font-bold uppercase tracking-[0.2em]">{item}</span>
              <span className="w-1 h-1 rounded-full bg-primary/40" />
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto relative z-10">
        <div className="sol-head text-center mb-14 sm:mb-16">
          <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase mb-3 opacity-0">{t('solutions.subtitle')}</h2>
          <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-headline tracking-tighter uppercase opacity-0">
            {t('solutions.heading')}
          </h3>
        </div>

        {/* Asymmetric: first 2 cards large, next 2 smaller */}
        <div className="sol-grid grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
          {solutions.map((sol) => {
            const hasImage = sol.image && sol.image.length > 0;
            const iconKey = (sol as Record<string, unknown>).icon as string | undefined;
            const span = hasImage ? "md:col-span-7" : "md:col-span-5";
            const spanAlt = sol.id === 2 ? "md:col-span-5" : sol.id === 1 ? "md:col-span-7" : span;

            return (
              <div key={sol.id} className={`sol-card group overflow-hidden opacity-0 text-center ${spanAlt} ${hasImage ? "glass-panel rounded-xl" : "bg-surface-container rounded-xl border-l-2 border-tertiary/30"}`}>
                {hasImage ? (
                  <div className="img-dark-tint relative h-40 sm:h-48 overflow-hidden">
                    <Image src={sol.image} alt={sol.title} fill
                      className={`transition-transform duration-700 group-hover:scale-105 ${sol.id === 1 ? "object-cover object-[center_65%] scale-110" : "object-cover"}`}
                      sizes="(max-width: 768px) 100vw, 58vw" />
                    <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-background/80 to-transparent z-[2]" />
                    <div className="absolute bottom-2 left-3 sm:bottom-3 sm:left-4 z-[3]">
                      <span className="bg-tertiary-container/20 text-tertiary border border-tertiary/30 px-2 py-0.5 text-[8px] sm:text-[9px] font-bold tracking-widest uppercase backdrop-blur-md">
                        {sol.id === 1 ? t('solutions.main_product') : t('solutions.handheld')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-16 sm:h-20 flex items-center px-4 sm:px-6">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-tertiary/40 mr-3 sm:mr-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {iconKey === "consult" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
                      {iconKey === "support" && <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>}
                    </svg>
                    <h4 className="text-base sm:text-lg font-bold font-headline uppercase tracking-tight text-on-surface">{sol.title}</h4>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  {hasImage && <h4 className="text-sm sm:text-base font-bold font-headline uppercase tracking-tight mb-2 group-hover:text-primary transition-colors">{sol.title}</h4>}
                  <p className="text-secondary text-xs sm:text-sm mb-3 leading-relaxed">{sol.description}</p>
                  <ul className="space-y-1 mb-3 sm:mb-4">
                    {sol.highlights.map((hl) => (
                      <li key={hl} className="flex items-center gap-2 text-xs sm:text-sm text-on-surface/80">
                        <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                        {hl}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact" onClick={(e) => { e.preventDefault(); document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" }); }}
                    className="text-[9px] sm:text-[10px] font-headline font-bold text-primary tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all uppercase">
                    {t('solutions.consult')} <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
