"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { product, certifications, contactInfo } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

export default function ProductPage() {
  const [activeImg, setActiveImg] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useI18n();

  const galleryImages = [
    { src: "/images/sp-1.webp", alt: t('product.alt1'), label: t('product.label1') },
    { src: "/images/sp-3.webp", alt: t('product.alt2'), label: t('product.label2') },
    { src: "/images/sp-4.webp", alt: t('product.alt3'), label: t('product.label3') },
  ];

  const specCards = [
    {
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      title: t('product.spec1_title'),
      desc: t('product.spec1_desc'),
      color: "tertiary" as const,
      span: 2,
    },
    {
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      title: t('product.spec2_title'),
      desc: t('product.spec2_desc'),
      color: "primary" as const,
      span: 1,
    },
    {
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      title: t('product.spec3_title'),
      desc: t('product.spec3_desc'),
      color: "primary" as const,
      span: 1,
    },
    {
      icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
      title: t('product.spec4_title'),
      desc: t('product.spec4_desc'),
      color: "tertiary" as const,
      span: 1,
    },
    {
      icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
      title: t('product.spec5_title'),
      desc: t('product.spec5_desc'),
      color: "primary" as const,
      span: 2,
    },
    {
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
      title: t('product.spec6_title'),
      desc: t('product.spec6_desc'),
      color: "tertiary" as const,
      span: 1,
    },
  ];

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        try {
          gsap.fromTo(".prod-left", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, delay: 0.2, ease: "power3.out" });
          gsap.fromTo(".prod-right > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, delay: 0.3, ease: "power3.out" });
          gsap.fromTo(".spec-card", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: ".specs-section", start: "top 80%" } });
        } catch { /* animation not critical */ }
      }, pageRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  return (
    <div ref={pageRef} className="min-h-screen" style={{ paddingTop: "80px" }}>
      {/* ═══ Product Hero Banner ═══ */}
      <div className="relative overflow-hidden border-b border-white/5" style={{ background: "linear-gradient(to right, #131316, #19191d, #131316)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full -translate-y-1/2" style={{ background: "radial-gradient(circle, rgba(var(--color-primary-container), 0.08) 0%, transparent 70%)" }} />
          <div className="absolute top-0 left-1/4 w-[300px] h-[300px] rounded-full" style={{ background: "radial-gradient(circle, rgba(var(--color-tertiary), 0.05) 0%, transparent 70%)" }} />
        </div>
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12 2xl:px-20 py-8 sm:py-12 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-[10px] text-secondary mb-3">
                <a href="/" className="hover:text-primary transition-colors">{t('nav.home')}</a>
                <span className="text-secondary/30">/</span>
                <span className="text-primary font-bold">{t('nav.products')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tighter text-on-surface">
                ZhiDun <span className="text-primary italic">CEO</span>
              </h2>
              <p className="text-secondary text-xs sm:text-sm mt-1">{t('product.subtitle')}</p>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center px-4 py-2 bg-surface-highest/50 rounded-lg border border-white/5">
                <p className="text-primary font-headline font-black text-lg sm:text-xl">210+</p>
                <p className="text-[8px] sm:text-[9px] text-secondary uppercase tracking-widest">{t('product.patents')}</p>
              </div>
              <div className="text-center px-4 py-2 bg-surface-highest/50 rounded-lg border border-white/5">
                <p className="text-primary font-headline font-black text-lg sm:text-xl">{t('product.warranty_value')}</p>
                <p className="text-[8px] sm:text-[9px] text-secondary uppercase tracking-widest">{t('product.warranty')}</p>
              </div>
              <div className="text-center px-4 py-2 bg-surface-highest/50 rounded-lg border border-white/5">
                <p className="text-primary font-headline font-black text-lg sm:text-xl">650nm</p>
                <p className="text-[8px] sm:text-[9px] text-secondary uppercase tracking-widest">{t('product.semiconductor')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12 2xl:px-20 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-16 lg:gap-20 items-start">

          {/* ═══ LEFT: Product Gallery (sticky on desktop) ═══ */}
          <div className="lg:col-span-7 prod-left opacity-0">
            <div className="lg:sticky lg:top-28">
              {/* Main image */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface-low group">
                <Image
                  src={galleryImages[activeImg].src}
                  alt={galleryImages[activeImg].alt}
                  fill
                  className="object-cover opacity-90"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  priority
                />

                {/* HUD overlay */}
                <div className="absolute inset-0 pointer-events-none border border-tertiary/15 m-3 sm:m-4 flex flex-col justify-between p-4 sm:p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] sm:text-[10px] text-tertiary font-headline tracking-[0.2em] uppercase">Model: {product.model}</span>
                      <span className="text-[9px] sm:text-[10px] text-tertiary/50 font-headline tracking-[0.2em] uppercase">{t('product.wavelength_label')}: {product.wavelength}</span>
                    </div>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-tertiary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="w-16 h-16 sm:w-24 sm:h-24 border-b border-r border-tertiary/30 self-end" />
                </div>

              </div>

              {/* Thumbnails */}
              <div className="mt-4 sm:mt-6 grid grid-cols-4 gap-2 sm:gap-3">
                {galleryImages.map((img, i) => (
                  <button key={i} onClick={() => { if (i >= 0 && i < galleryImages.length) setActiveImg(i); }}
                    className={`aspect-square overflow-hidden p-0.5 sm:p-1 transition-all ${
                      activeImg === i ? "bg-surface-highest border border-primary-container/40" : "bg-surface-container hover:bg-surface-high border border-transparent"
                    }`}>
                    <Image src={img.src} alt={img.alt} width={200} height={200}
                      className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: Configuration & Pricing ═══ */}
          <div className="lg:col-span-5 prod-right space-y-10 sm:space-y-14">
            {/* Header */}
            <header className="opacity-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-tertiary-container/20 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-headline font-bold text-tertiary tracking-widest uppercase">{t('product.accepting_orders')}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline tracking-tighter text-on-surface mb-3">
                {product.name}<br /><span className="text-primary italic">MODEL {product.model}</span>
              </h1>
              <p className="text-secondary leading-relaxed text-sm max-w-md">
                {t('product.hero_tagline')} — {t('product.wavelength_label').toLowerCase()} {product.wavelength}. {t('product.tagline_full')}
              </p>
            </header>

            {/* Product variant */}
            <div className="space-y-5 opacity-0">
              <div className="flex justify-between items-end">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary font-headline">{t('product.package')}</label>
                <span className="text-[10px] text-tertiary uppercase font-headline cursor-pointer hover:underline">{t('product.view_specs')}</span>
              </div>
              <div className="space-y-3">
                {/* Main product */}
                <div className="flex items-center justify-between p-4 sm:p-5 bg-surface-high border-2 border-primary-container text-left">
                  <div>
                    <p className="font-headline font-bold text-base sm:text-lg">{product.name} — {product.model}</p>
                    <p className="text-[10px] sm:text-xs text-secondary">{t('product.full_accessories')}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-headline font-bold text-primary text-sm sm:text-base">{product.price}đ</p>
                    <p className="text-[9px] text-secondary">{t('product.tax_included')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-4 opacity-0">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary font-headline">{t('product.benefits_title')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  t('product.benefit_b1'),
                  t('product.benefit_b2'),
                  t('product.benefit_b3'),
                  t('product.benefit_b4'),
                ].map((b) => (
                  <div key={b} className="flex items-start gap-2 text-xs sm:text-sm text-secondary bg-surface-container px-3 py-2.5 rounded">
                    <span className="w-1 h-1 rounded-full bg-tertiary mt-1.5 flex-shrink-0" />
                    {b}
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="pt-8 border-t border-white/5 grid grid-cols-4 gap-4 sm:gap-6 opacity-0">
              {(() => {
                const certCodeLabels: Record<string, string> = {
                  "ISO 13485": "ISO 13485",
                  "ISO 9001": "ISO 9001",
                  "GP Lưu hành VN": t('product.cert_vn_code'),
                  "GP Lưu hành TQ": t('product.cert_cn_code'),
                };
                return certifications.slice(0, 4).map((c) => (
                  <div key={c.code} className="flex flex-col items-center text-center gap-1.5 sm:gap-2">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-secondary font-headline">{certCodeLabels[c.code] ?? c.code}</span>
                  </div>
                ));
              })()}
            </div>

            {/* Pricing & CTA */}
            <div className="bg-surface-highest/50 backdrop-blur-md p-6 sm:p-10 rounded-xl space-y-5 sm:space-y-6 opacity-0">
              <div className="flex justify-between items-center">
                <span className="text-secondary text-xs sm:text-sm">{product.name} {product.model}</span>
                <span className="text-on-surface font-headline font-bold text-sm sm:text-base">{product.price}đ</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary text-xs sm:text-sm">{t('product.nationwide_shipping')}</span>
                <span className="text-tertiary font-headline font-bold text-sm">{t('product.shipping_fee')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary text-xs sm:text-sm">{t('product.warranty')}</span>
                <span className="text-tertiary font-headline font-bold text-sm">{t('product.warranty_official')}</span>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-secondary font-headline">{t('product.warranty')}</p>
                  <p className="text-sm sm:text-lg font-headline font-bold text-on-surface">{t('product.warranty_official')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-primary font-headline">{t('product.total')}</p>
                  <p className="text-2xl sm:text-3xl font-headline font-black text-on-surface">{product.price}đ</p>
                  <p className="text-[9px] text-secondary">{t('product.tax_included')}</p>
                </div>
              </div>

              <a href={`tel:${contactInfo.hotline.replace(/\s/g, "")}`}
                className="block w-full py-4 sm:py-5 bg-primary-container text-on-primary font-headline font-black tracking-widest text-xs sm:text-sm text-center uppercase glow-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                {t('product.order_now')} — {contactInfo.hotline}
              </a>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <a href={contactInfo.zalo} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 border border-[#0068ff]/30 text-[#4da6ff] font-headline font-bold tracking-widest text-[10px] sm:text-xs text-center uppercase hover:bg-[#0068ff]/10 transition-all">
                  {t('product.zalo_consult')}
                </a>
                <a href="#specs"
                  className="flex-1 py-3 border border-outline-variant text-on-surface font-headline font-bold tracking-widest text-[10px] sm:text-xs text-center uppercase hover:bg-surface-high transition-all">
                  {t('product.view_specs_btn')}
                </a>
              </div>

              <p className="text-center text-[9px] sm:text-[10px] text-secondary/40">{t('product.return_policy')}</p>
            </div>
          </div>
        </div>

        {/* ═══ SPECS SECTION ═══ */}
        <section id="specs" className="specs-section mt-24 sm:mt-36 pt-16 sm:pt-20 border-t border-white/5 space-y-10 sm:space-y-14">
          <div className="flex items-center gap-4 sm:gap-6">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tighter uppercase">{t('product.tech_specs')}</h2>
            <div className="h-px flex-grow bg-gradient-to-r from-primary/20 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
            {specCards.map((s) => (
              <div key={s.title} className={`spec-card space-y-3 p-5 sm:p-6 rounded-xl opacity-0 ${
                s.span === 2 ? "sm:col-span-2" : ""
              } ${s.color === "tertiary" ? "bg-surface-low border-l-2 border-tertiary/30" : "bg-surface-container border-l-2 border-primary-container/30"}`}>
                <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${s.color === "tertiary" ? "text-tertiary" : "text-primary"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                </svg>
                <h3 className="font-headline font-bold text-base sm:text-lg uppercase italic tracking-tight">{s.title}</h3>
                <p className="text-xs sm:text-sm text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ DETAILED PRODUCT INFO ═══ */}
        <section className="mt-24 sm:mt-36 pt-16 sm:pt-20 border-t border-white/5">
          <div className="max-w-4xl mx-auto space-y-16 sm:space-y-20">

            {/* Header */}
            <div className="text-center space-y-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline tracking-tighter uppercase">
                {t('product.content_heading')} <span className="text-primary italic">ZhiDun</span>
              </h2>
              <p className="text-lg sm:text-xl text-secondary max-w-2xl mx-auto">
                {t('product.content_subheading')}
              </p>
            </div>

            {/* Intro */}
            <div className="space-y-5 text-secondary leading-relaxed text-sm sm:text-base">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
                {t('product.content_intro_title')}
              </h3>
              <p>
                {t('product.content_intro_p1')}
              </p>
              <p>
                {t('product.content_intro_p2')}
              </p>
            </div>

            {/* What is it */}
            <div className="bg-surface-container rounded-2xl p-6 sm:p-10 space-y-5">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
                {t('product.content_what_title')}
              </h3>
              <p className="text-secondary text-sm sm:text-base leading-relaxed">
                {t('product.content_what_desc')}
              </p>
              <ul className="space-y-2 text-secondary text-sm sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {t('product.content_what_item1')}
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {t('product.content_what_item2')}
                </li>
              </ul>
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs sm:text-sm uppercase font-bold tracking-widest text-primary font-headline mb-4">{t('product.content_mechanism')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    t('product.content_mech1'),
                    t('product.content_mech2'),
                    t('product.content_mech3'),
                    t('product.content_mech4'),
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 bg-surface-low px-4 py-3 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary mt-2 flex-shrink-0" />
                      <span className="text-sm text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-8">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
                {t('product.key_benefits')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    title: t('product.benefit_circulation'),
                    items: [t('product.benefit_circulation_1'), t('product.benefit_circulation_2')],
                    color: "primary" as const,
                  },
                  {
                    title: t('product.benefit_pressure'),
                    items: [t('product.benefit_pressure_1'), t('product.benefit_pressure_2')],
                    color: "tertiary" as const,
                  },
                  {
                    title: t('product.benefit_stroke'),
                    items: [t('product.benefit_stroke_1'), t('product.benefit_stroke_2')],
                    color: "primary" as const,
                  },
                  {
                    title: t('product.benefit_immunity'),
                    items: [t('product.benefit_immunity_1'), t('product.benefit_immunity_2')],
                    color: "tertiary" as const,
                  },
                  {
                    title: t('product.benefit_sleep'),
                    items: [t('product.benefit_sleep_1'), t('product.benefit_sleep_2')],
                    color: "primary" as const,
                  },
                ].map((b) => (
                  <div key={b.title} className={`p-5 sm:p-6 rounded-xl space-y-3 ${
                    b.color === "tertiary" ? "bg-surface-low border-l-2 border-tertiary/30" : "bg-surface-container border-l-2 border-primary-container/30"
                  }`}>
                    <h4 className={`font-headline font-bold text-sm sm:text-base ${
                      b.color === "tertiary" ? "text-tertiary" : "text-primary"
                    }`}>{b.title}</h4>
                    <ul className="space-y-2">
                      {b.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-xs sm:text-sm text-secondary">
                          <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${
                            b.color === "tertiary" ? "bg-tertiary" : "bg-primary"
                          }`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Target audience */}
            <div className="bg-surface-container rounded-2xl p-6 sm:p-10 space-y-6">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
                {t('product.target_audience')}
              </h3>
              <p className="text-secondary text-sm sm:text-base leading-relaxed">
                {t('product.target_desc')}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  t('product.target1'),
                  t('product.target2'),
                  t('product.target3'),
                  t('product.target4'),
                  t('product.target5'),
                  t('product.target6'),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 bg-surface-low px-4 py-3 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Advantages */}
            <div className="space-y-6">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
                {t('product.advantages')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  t('product.adv1'),
                  t('product.adv2'),
                  t('product.adv3'),
                  t('product.adv4'),
                  t('product.adv5'),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 bg-surface-high px-5 py-4 rounded-xl border border-white/5">
                    <svg className="w-5 h-5 text-tertiary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm sm:text-base text-on-surface">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Home care solution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-container rounded-2xl p-6 sm:p-8 space-y-4">
                <h3 className="text-lg sm:text-xl font-headline font-bold text-on-surface tracking-tight">
                  {t('product.homecare_title')}
                </h3>
                <p className="text-xs sm:text-sm uppercase font-bold tracking-widest text-secondary font-headline">{t('product.homecare_instead')}</p>
                <ul className="space-y-2">
                  {[t('product.homecare_bad1'), t('product.homecare_bad2'), t('product.homecare_bad3')].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-secondary">
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-primary-container/10 border border-primary-container/20 rounded-2xl p-6 sm:p-8 space-y-4">
                <h3 className="text-lg sm:text-xl font-headline font-bold text-primary tracking-tight">
                  {t('product.homecare_good_title')}
                </h3>
                <ul className="space-y-2">
                  {[t('product.homecare_good1'), t('product.homecare_good2'), t('product.homecare_good3')].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-on-surface">
                      <svg className="w-4 h-4 text-tertiary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Why now */}
            <div className="bg-surface-low rounded-2xl p-6 sm:p-10 text-center space-y-6 border border-white/5">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
                {t('product.why_own_today')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <p className="text-2xl sm:text-3xl font-black font-headline text-primary">+40%</p>
                  <p className="text-xs sm:text-sm text-secondary">{t('product.stat_stroke')}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl sm:text-3xl font-black font-headline text-tertiary">80%</p>
                  <p className="text-xs sm:text-sm text-secondary">{t('product.stat_prevention')}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl sm:text-3xl font-black font-headline text-on-surface">#1</p>
                  <p className="text-xs sm:text-sm text-secondary">{t('product.stat_investment')}</p>
                </div>
              </div>
              <a href="/#contact"
                className="inline-flex items-center gap-2 bg-primary-container text-on-primary px-8 py-4 font-headline font-black text-xs tracking-[0.15em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">
                {t('product.consult_now')} — {contactInfo.hotline}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
            </div>

          </div>
        </section>

        {/* Bottom spacer */}
        <div className="h-16 sm:h-24" />
      </div>
    </div>
  );
}
