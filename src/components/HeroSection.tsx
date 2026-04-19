"use client";

import dynamic from "next/dynamic";
import { product, contactInfo } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

const LaserPulse = dynamic(() => import("@/components/LaserPulse"), { ssr: false });

export default function HeroSection() {
  const { t } = useI18n();

  const heroStats = [
    { value: "650nm", label: t('hero.stat_laser') },
    { value: t('hero.stat_warranty_val'), label: t('hero.stat_warranty') },
    { value: "ISO 13485", label: t('hero.stat_cert') },
  ];

  return (
    <section id="hero" className="relative min-h-screen px-5 sm:px-8 lg:px-12 2xl:px-20 overflow-hidden">
      <div className="absolute top-1/4 -right-1/4 w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(var(--color-primary-container), 0.15) 0%, transparent 70%)", contain: "layout paint" }} />
      <div className="absolute bottom-0 -left-1/4 w-[250px] h-[250px] sm:w-[350px] sm:h-[350px] rounded-full" style={{ background: "radial-gradient(circle, rgba(var(--color-tertiary), 0.08) 0%, transparent 70%)", contain: "layout paint" }} />

      <div className="max-w-screen-2xl mx-auto w-full" style={{ paddingTop: "100px", paddingBottom: "48px" }}>
        {/* Headline + description — single animation wrapper to reduce composite layers */}
        <div className="relative text-center max-w-5xl mx-auto mb-10 sm:mb-14 animate-[fadeUp_0.5s_ease-out_both]">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-highest border border-primary/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[9px] sm:text-[10px] font-headline font-bold uppercase tracking-widest text-primary">{t('hero.exclusive')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black font-headline tracking-tighter leading-[0.9] text-on-surface mb-6">
            ZHIDUN <span className="text-primary italic">CEO.</span>
          </h1>

          <p className="text-secondary max-w-2xl mx-auto leading-relaxed text-sm sm:text-base font-normal">
            {t('hero.tagline')}. {t('hero.description')}
          </p>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-6 sm:pt-8">
            {heroStats.map((s) => (
              <div key={s.label} className="glass-panel px-3 sm:px-5 py-2 sm:py-3 rounded-lg">
                <p className="text-sm sm:text-lg font-black font-headline tracking-tight text-on-surface">{s.value}</p>
                <p className="text-[8px] sm:text-[10px] text-secondary mt-0.5 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Laser Pulse 3D animation */}
        <div className="w-full h-[250px] sm:h-[320px] lg:h-[380px] mb-8 sm:mb-12">
          <LaserPulse />
        </div>

        {/* Product images — no animation, render immediately for LCP */}
        <div className="relative max-w-4xl mx-auto">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(var(--color-primary-container), 0.15) 0%, transparent 70%)" }} />
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl overflow-hidden border border-white/5 bg-surface-low shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <img src="/images/home-banner-840.webp" srcSet="/images/home-banner-560.webp 560w, /images/home-banner-840.webp 840w" sizes="(max-width: 672px) 100vw, 672px" alt={t('hero.product_alt')} width={840} height={1468} loading="eager" fetchPriority="high" decoding="async" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>

        {/* Price + CTA — below product images */}
        <div className="text-center max-w-3xl mx-auto mt-10 sm:mt-14">
          <div className="mb-5 sm:mb-6">
            <p className="text-[10px] sm:text-xs text-primary/80 uppercase tracking-[0.25em] font-headline font-bold mb-1">{t('hero.price_prefix')}</p>
            <span className="text-3xl sm:text-4xl md:text-5xl font-black font-headline text-primary">{product.price}đ</span>
            <p className="text-[10px] sm:text-xs text-secondary mt-1 uppercase tracking-wider font-headline">{t('hero.price_label')}</p>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
            <a href="/#contact" className="bg-primary-container text-on-primary px-6 sm:px-8 py-3.5 sm:py-4 font-headline font-black text-[10px] sm:text-xs tracking-[0.15em] uppercase transition-all flex items-center gap-2">
              {t('hero.order')} — {contactInfo.hotline}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            <a href="/san-pham" className="border border-outline-variant text-on-surface px-6 sm:px-8 py-3.5 sm:py-4 font-headline font-bold text-[10px] sm:text-xs tracking-[0.15em] uppercase hover:bg-surface-high transition-all">
              {t('hero.details')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
