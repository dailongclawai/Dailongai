"use client";

import { useEffect, useRef } from "react";
import { product } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

export default function CTASection() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(".cta-inner > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: sectionRef.current, start: "top 80%" } });
      }, sectionRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  return (
    <section ref={sectionRef} className="py-16 px-5 sm:px-8 lg:px-12 2xl:px-20 border-t border-white/5">
      <div className="max-w-4xl mx-auto glass-panel p-8 sm:p-10 md:p-14 rounded-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-container to-transparent" />

        <div className="cta-inner relative z-10 space-y-5 sm:space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black font-headline tracking-tighter text-on-surface uppercase opacity-0">
            ZhiDun<br /><span className="text-primary italic">{product.promoPrice}đ</span>
          </h2>
          <p className="text-secondary max-w-lg mx-auto text-xs sm:text-sm opacity-0">
            {t('cta.promo')}
          </p>
          <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3 justify-center opacity-0">
            <a href="tel:0935999922"
              className="bg-primary-container text-on-primary px-8 sm:px-12 py-4 sm:py-5 font-headline font-black text-[10px] sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] uppercase glow-primary hover:scale-[1.03] active:scale-95 transition-all duration-300 shadow-xl">
              {t('cta.call')} — 0935 999 922
            </a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" }); }}
              className="border border-outline-variant text-on-surface px-8 sm:px-12 py-4 sm:py-5 font-headline font-bold text-[10px] sm:text-sm tracking-[0.15em] uppercase hover:bg-surface-high transition-all text-center">
              {t('cta.submit')}
            </a>
          </div>
        </div>

        <div className="absolute -bottom-16 -right-16 sm:-bottom-20 sm:-right-20 w-40 sm:w-52 h-40 sm:h-52 border-[20px] sm:border-[30px] border-primary/5 rounded-full" />
        <div className="absolute -top-16 -left-16 sm:-top-20 sm:-left-20 w-40 sm:w-52 h-40 sm:h-52 border-[20px] sm:border-[30px] border-tertiary/5 rounded-full" />
      </div>
    </section>
  );
}
