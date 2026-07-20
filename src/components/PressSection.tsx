"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

const ARTICLE_URL =
  "https://1thegioi.vn/may-laser-ban-dan-zhi-dun-dot-pha-cong-nghe-y-te-gia-dinh-255179.html";

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
        <div className="press-strip grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_auto] gap-6 lg:gap-10 items-center border-t border-b border-outline/15 py-8 sm:py-10">
          <a
            href={ARTICLE_URL}
            target="_blank"
            rel="noopener"
            className="press-reveal block rounded-lg overflow-hidden border border-outline/20 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 transition-colors"
          >
            <Image
              src="/images/press/bao-mtg-thumb-v2.webp"
              alt={t("press.image_alt")}
              width={700}
              height={330}
              loading="lazy"
              className="w-full h-auto"
            />
          </a>

          <div className="press-reveal">
            <p className="text-[10px] font-headline font-bold uppercase tracking-[0.26em] text-secondary mb-2.5">
              {t("press.label")}
            </p>
            <p className="text-base sm:text-lg leading-snug font-medium tracking-tight text-on-surface max-w-3xl">
              {t("press.quote")}
            </p>
            <p className="text-[11px] sm:text-xs text-secondary mt-2">
              {t("press.meta")}
            </p>
          </div>

          <a
            href={ARTICLE_URL}
            target="_blank"
            rel="noopener"
            className="press-reveal inline-flex items-center gap-2 text-sm font-headline font-bold text-primary border-b border-transparent hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 pb-0.5 transition-colors whitespace-nowrap"
          >
            {t("press.cta")}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
