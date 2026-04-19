"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type CertItem = {
  src: string;
  titleKey: string;
  issuerKey: string;
  alt: string;
};

export default function CertificationsSection() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const certs: CertItem[] = [
    {
      src: "/certificates/giay-phep-luu-hanh.webp",
      titleKey: "cert_section.item1_title",
      issuerKey: "cert_section.item1_issuer",
      alt: "Giấy phép lưu hành ZhiDun tại Việt Nam",
    },
    {
      src: "/certificates/partner-vn-consular.webp",
      titleKey: "cert_section.item2_title",
      issuerKey: "cert_section.item2_issuer",
      alt: "Chứng nhận của lãnh sự Đại Sứ Quán Việt Nam tại Bắc Kinh",
    },
    {
      src: "/certificates/partner-cn-registration.webp",
      titleKey: "cert_section.item3_title",
      issuerKey: "cert_section.item3_issuer",
      alt: "Đăng ký kinh doanh Quảng Châu Kangzheng",
    },
    {
      src: "/certificates/partner-ccpit-cert.webp",
      titleKey: "cert_section.item4_title",
      issuerKey: "cert_section.item4_issuer",
      alt: "Chứng nhận CCPIT",
    },
    {
      src: "/certificates/partner-ccpit-cover.webp",
      titleKey: "cert_section.item5_title",
      issuerKey: "cert_section.item5_issuer",
      alt: "CCPIT — Bìa chứng nhận",
    },
  ];

  const close = useCallback(() => setActiveIndex(null), []);
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i + 1) % certs.length)),
    [certs.length],
  );
  const prev = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i - 1 + certs.length) % certs.length)),
    [certs.length],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex, close, next, prev]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".cert-head > *",
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: { trigger: ".cert-head", start: "top 80%" },
          },
        );
        gsap.fromTo(
          ".cert-card",
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: ".cert-grid", start: "top 85%" },
          },
        );
      }, sectionRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => {
        clearTimeout(timer);
        ctx.revert();
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [locale]);

  const active = activeIndex !== null ? certs[activeIndex] : null;

  return (
    <section
      ref={sectionRef}
      id="certifications"
      className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 2xl:px-20 bg-surface-high"
    >
      <div className="max-w-screen-2xl mx-auto">
        <div className="cert-head text-center mb-14 sm:mb-16 space-y-4">
          <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase">
            {t("cert_section.title")}
          </h2>
          <h3 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline leading-tight tracking-tighter">
            {t("cert_section.heading")}
          </h3>
          <p className="text-secondary text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {t("cert_section.subheading")}
          </p>
        </div>

        <div className="cert-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
          {certs.map((c, i) => (
            <button
              key={c.src}
              type="button"
              onClick={() => setActiveIndex(i)}
              className="cert-card group relative flex flex-col text-left glass-panel rounded-xl overflow-hidden opacity-0 transition-all hover:ring-1 hover:ring-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t(c.titleKey)}
            >
              <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-low">
                <Image
                  src={c.src}
                  alt={c.alt}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute top-2 right-2 text-[9px] sm:text-[10px] tracking-widest uppercase bg-black/50 backdrop-blur px-2 py-1 rounded text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("cert_section.zoom_hint")}
                </span>
              </div>
              <div className="p-3 sm:p-4 space-y-1">
                <h4 className="text-xs sm:text-sm font-bold font-headline leading-tight line-clamp-2">
                  {t(c.titleKey)}
                </h4>
                <p className="text-secondary text-[10px] sm:text-xs leading-snug line-clamp-1">
                  {t(c.issuerKey)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(active.titleKey)}
          onClick={close}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label={t("cert_section.close")}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label={t("cert_section.prev")}
            className="absolute left-2 sm:left-6 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t("cert_section.next")}
            className="absolute right-2 sm:right-6 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center gap-3 max-h-full max-w-full"
          >
            <div className="relative w-[min(92vw,900px)] h-[min(78vh,1200px)]">
              <Image
                key={active.src}
                src={active.src}
                alt={active.alt}
                fill
                sizes="(max-width: 640px) 92vw, 900px"
                className="object-contain"
                priority
              />
            </div>
            <div className="text-center text-white space-y-1 px-2">
              <h4 className="text-base sm:text-lg font-bold font-headline">{t(active.titleKey)}</h4>
              <p className="text-white/70 text-xs sm:text-sm">{t(active.issuerKey)}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
