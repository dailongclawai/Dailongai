"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

const ARTICLES = [
  {
    url: "https://1thegioi.vn/may-laser-ban-dan-zhi-dun-dot-pha-cong-nghe-y-te-gia-dinh-255179.html",
    image: "/images/press/bao-mtg-thumb-v2.webp",
    quoteKey: "press.quote",
    metaKey: "press.meta",
    altKey: "press.image_alt",
  },
  {
    url: "https://vnexpress.net/cham-soc-suc-khoe-tim-mach-tai-nha-bang-laser-ban-dan-5102139.html",
    image: "/images/press/bao-vnexpress-thumb.webp",
    quoteKey: "press.quote_2",
    metaKey: "press.meta_2",
    altKey: "press.image_alt_2",
  },
];

export default function PressSection() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".press-reveal",
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: ".press-strip", start: "top 88%" },
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

  return (
    <section
      ref={sectionRef}
      id="press"
      className="px-5 sm:px-8 lg:px-12 2xl:px-20 bg-surface"
    >
      <div className="max-w-screen-2xl mx-auto">
        <div className="press-strip border-t border-b border-outline/15 py-8 sm:py-10">
          <p className="press-reveal text-[10px] font-headline font-bold uppercase tracking-[0.26em] text-secondary mb-5">
            {t("press.label")}
          </p>

          {ARTICLES.map((article, index) => (
            <div
              key={article.url}
              className={`grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_auto] gap-6 lg:gap-10 items-center${
                index > 0 ? " mt-6 pt-6 border-t border-outline/10" : ""
              }`}
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener"
                className="press-reveal block rounded-lg overflow-hidden border border-outline/20 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 transition-colors"
              >
                <Image
                  src={article.image}
                  alt={t(article.altKey)}
                  width={700}
                  height={330}
                  loading="lazy"
                  className="w-full h-auto"
                />
              </a>

              <div className="press-reveal">
                <p className="text-base sm:text-lg leading-snug font-medium tracking-tight text-on-surface max-w-3xl">
                  {t(article.quoteKey)}
                </p>
                <p className="text-[11px] sm:text-xs text-secondary mt-2">
                  {t(article.metaKey)}
                </p>
              </div>

              <a
                href={article.url}
                target="_blank"
                rel="noopener"
                className="press-reveal inline-flex items-center gap-2 text-sm font-headline font-bold text-primary border-b border-transparent hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 py-1 pb-0.5 transition-colors whitespace-nowrap"
              >
                {t("press.cta")}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
