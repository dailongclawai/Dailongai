"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { contactInfo } from "@/data/siteData";
import { useI18n } from "@/lib/i18n";

const DnaHelix = dynamic(() => import("@/components/DnaHelix"), { ssr: false });

/* ═══ STATIC DATA (no translations needed) ═══ */
const diabetesGrowth = [
  { year: "2002", rate: "2.7%", bar: 15 },
  { year: "2010", rate: "4.5%", bar: 30 },
  { year: "2017", rate: "5.8%", bar: 45 },
  { year: "2021", rate: "7.1%", bar: 60 },
  { year: "2030*", rate: "~9%", bar: 78 },
];

const diabetesAgeGroups = [
  { range: "20-34", pct: "1.5%", bar: 8 },
  { range: "35-44", pct: "3.8%", bar: 20 },
  { range: "45-54", pct: "8.2%", bar: 45 },
  { range: "55-64", pct: "14.5%", bar: 72 },
  { range: "65+", pct: "18%+", bar: 90 },
];

const hypertensionAgeGroups = [
  { range: "25-44", pct: "~15%", bar: 25 },
  { range: "45-59", pct: "30-40%", bar: 55 },
  { range: "60+", pct: "50-60%", bar: 85 },
];

const riskFactorIcons = [
  "M12 6v6m0 0v6m0-6h6m-6 0H6",
  "M13 10V3L4 14h7v7l9-11h-7z",
  "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
];


/* economicImpact values are built with translated units inside the component */

/* ═══ COMPONENT ═══ */
export default function HealthStatsPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useI18n();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap, ScrollTrigger } = await (await import("@/lib/gsap-loader")).loadGSAP();
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(".hero-stat", { y: 40, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.7, stagger: 0.12, delay: 0.3, ease: "power3.out",
        });
        gsap.fromTo(".section-anim > *", { y: 30, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power3.out",
          scrollTrigger: { trigger: ".section-anim", start: "top 80%" },
        });

        document.querySelectorAll(".stat-section").forEach((sec) => {
          gsap.fromTo(sec.querySelectorAll(".fade-in"), { y: 30, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out",
            scrollTrigger: { trigger: sec, start: "top 80%" },
          });
        });
      }, pageRef);
      const timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      cleanup = () => { clearTimeout(timer); ctx.revert(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [locale]);

  /* Translated data */
  const M = t('health.million');
  const B = t('health.billion');
  const PY = t('health.per_year');
  const EST = t('health.estimate');

  const projections: { year: string; diabetes: string; hypertension: string }[] = [
    { year: "2024-2025", diabetes: `~7 ${M} (~7,3%)`,        hypertension: `~12 ${M} (~26%)` },
    { year: "2026",      diabetes: `~7,5 ${M} (${EST})`,     hypertension: `~13-14 ${M} (${EST})` },
    { year: "2028",      diabetes: `~8 ${M} (${EST})`,       hypertension: `~15-16 ${M} (${EST})` },
    { year: "2030",      diabetes: `~8,5-9 ${M} (${EST})`,   hypertension: `~17-18 ${M} (${EST})` },
  ];

  const heroNumbers = [
    { value: locale === 'zh' ? '七百五十万' : `7,5 ${M}`, label: t('health.hero_diabetes'), src: "IDF Diabetes Atlas" },
    { value: locale === 'zh' ? '一千三百至一千四百万' : `13-14 ${M}`, label: t('health.hero_hypertension'), src: t('health.src_moh') },
    { value: "77%", label: t('health.hero_ncd'), src: "WHO Vietnam" },
  ];

  const diabetesStats = [
    { value: locale === 'zh' ? '七百五十万' : `7,5 ${M}`, label: t('health.d_stat1'), color: "primary" as const },
    { value: "7.1%", label: t('health.d_stat2'), color: "tertiary" as const },
    { value: "x3", label: t('health.d_stat3'), color: "primary" as const },
    { value: "50-70%", label: t('health.d_stat4'), color: "tertiary" as const },
  ];

  const diabetesAgeNotes = [
    t('health.age_note1'),
    t('health.age_note2'),
    t('health.age_note3'),
    t('health.age_note4'),
    t('health.age_note5'),
  ];

  const hypertensionStats = [
    { value: locale === 'zh' ? '一千三百至一千四百万' : `13-14 ${M}`, label: t('health.h_stat1'), color: "primary" as const },
    { value: "25-28%", label: t('health.h_stat2'), color: "tertiary" as const },
    { value: "50-60%", label: t('health.h_stat3'), color: "primary" as const },
    { value: "14-30%", label: t('health.h_stat4'), color: "tertiary" as const },
  ];

  const hypertensionAgeNotes = [
    t('health.h_age_note1'),
    t('health.h_age_note2'),
    t('health.h_age_note3'),
  ];

  const riskFactors = [
    { factor: t('health.risk_salt'), detail: t('health.risk_salt_detail'), icon: riskFactorIcons[0] },
    { factor: t('health.risk_sedentary'), detail: t('health.risk_sedentary_detail'), icon: riskFactorIcons[1] },
    { factor: t('health.risk_urban'), detail: t('health.risk_urban_detail'), icon: riskFactorIcons[2] },
  ];

  const economicImpact = [
    { label: t('health.econ1'), value: locale === 'zh' ? `$2-3亿${PY}` : `$200-300 ${M}${PY}` },
    { label: t('health.econ2'), value: locale === 'zh' ? `十到十五亿美金${PY}` : `$1-1.5 ${B}${PY}` },
    { label: t('health.econ3'), value: `~33% ${t('health.of_total_deaths')}` },
    { label: t('health.econ4'), value: `~77% ${t('health.of_total_mortality')}` },
  ];

  return (
    <div ref={pageRef} className="pt-24 sm:pt-28">

      {/* ═══ HERO ═══ */}
      <section className="px-5 sm:px-8 lg:px-12 2xl:px-20 pt-20 sm:pt-24 pb-28 sm:pb-36 relative overflow-hidden">
        <div className="absolute top-1/3 -right-1/4 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(var(--color-primary-container), 0.10) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 -left-1/4 w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(var(--color-tertiary), 0.05) 0%, transparent 70%)" }} />

        <div className="max-w-screen-2xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12 mb-16 sm:mb-20">
            <div className="max-w-3xl lg:flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container/10 border border-primary/20 mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-headline font-bold uppercase tracking-widest text-primary">{t('health.badge')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black font-headline tracking-tighter leading-[1.25] text-on-surface mb-6">
                {t('health.title1')}<br /><span className="text-primary italic">{t('health.title2')}<br />{t('health.title3')}</span>
              </h1>
              <p className="text-secondary text-sm sm:text-base leading-relaxed max-w-xl">
                {t('health.intro')}
              </p>
            </div>
            <div className="w-full h-[280px] sm:h-[340px] lg:w-[420px] xl:w-[500px] lg:h-[420px] xl:h-[480px] flex-shrink-0">
              <DnaHelix />
            </div>
          </div>

          {/* Big numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {heroNumbers.map((n) => (
              <div key={n.label} className="hero-stat glass-panel p-5 sm:p-6 rounded-xl border-l-2 border-primary/30 opacity-0">
                <p className="text-2xl sm:text-3xl md:text-4xl font-black font-headline text-on-surface tracking-tight">{n.value}</p>
                <p className="text-sm text-secondary mt-1">{n.label}</p>
                <p className="text-[9px] text-secondary/40 mt-2 uppercase tracking-wider italic">{t('health.source')}: {n.src}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DIABETES SECTION ═══ */}
      <section className="stat-section px-5 sm:px-8 lg:px-12 2xl:px-20 py-28 sm:py-36 bg-surface-low">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-14 sm:mb-16">
            <div>
              <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase fade-in">{t('health.diabetes_section')}</h2>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black font-headline tracking-tighter mt-3 fade-in">
                {t('health.diabetes_heading').split(' ').slice(0, -2).join(' ')} <span className="text-primary italic">{t('health.diabetes_heading').split(' ').slice(-2).join(' ').toUpperCase()}</span>
              </h3>
            </div>
            <p className="text-secondary text-sm max-w-sm fade-in">
              {t('health.diabetes_intro')}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16 sm:mb-20">
            {diabetesStats.map((s) => (
              <div key={s.label} className={`fade-in bg-surface-container p-5 rounded-xl border-l-2 ${s.color === "primary" ? "border-primary/30" : "border-tertiary/30"}`}>
                <p className={`text-xl sm:text-2xl font-black font-headline ${s.color === "primary" ? "text-primary" : "text-tertiary"}`}>{s.value}</p>
                <p className="text-secondary text-xs sm:text-sm mt-1 leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Growth chart + Age breakdown side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
            {/* Growth over years */}
            <div className="fade-in glass-panel p-5 sm:p-6 rounded-xl">
              <h4 className="font-headline font-bold text-sm uppercase tracking-tight mb-5">{t('health.diabetes_trend')}</h4>
              <div className="space-y-3">
                {diabetesGrowth.map((g) => (
                  <div key={g.year} className="flex items-center gap-3">
                    <span className="font-headline font-bold text-xs w-12 text-secondary flex-shrink-0">{g.year}</span>
                    <div className="flex-1 h-6 bg-surface-container rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary-container/60 to-primary/40 rounded flex items-center justify-end pr-2"
                        style={{ width: `${g.bar}%` }}>
                        <span className="text-[10px] font-headline font-bold text-on-surface">{g.rate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-secondary/40 mt-4 italic">{t('health.forecast_note')}</p>
            </div>

            {/* Age breakdown */}
            <div className="fade-in glass-panel p-5 sm:p-6 rounded-xl">
              <h4 className="font-headline font-bold text-sm uppercase tracking-tight mb-5">{t('health.age_groups')}</h4>
              <div className="space-y-4">
                {diabetesAgeGroups.map((a, i) => (
                  <div key={a.range}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-headline font-bold text-xs text-on-surface">{a.range} {t('health.age_unit')}</span>
                      <span className="font-headline font-bold text-xs text-primary">{a.pct}</span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${a.bar}%` }} />
                    </div>
                    <p className="text-[9px] text-secondary/50 mt-0.5">{diabetesAgeNotes[i]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HYPERTENSION SECTION ═══ */}
      <section className="stat-section px-5 sm:px-8 lg:px-12 2xl:px-20 py-28 sm:py-36 border-t border-white/5">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-14 sm:mb-16">
            <div>
              <h2 className="text-tertiary font-headline font-bold tracking-[0.3em] text-[10px] uppercase fade-in">{t('health.hypertension_section')}</h2>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black font-headline tracking-tighter mt-3 fade-in">
                {t('health.hypertension_heading').split(' ').slice(0, -2).join(' ')} <span className="text-tertiary italic">{t('health.hypertension_heading').split(' ').slice(-2).join(' ').toUpperCase()}</span>
              </h3>
            </div>
            <p className="text-secondary text-sm max-w-sm fade-in">
              {t('health.hypertension_intro')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16 sm:mb-20">
            {hypertensionStats.map((s) => (
              <div key={s.label} className={`fade-in bg-surface-container p-5 rounded-xl border-l-2 ${s.color === "primary" ? "border-primary/30" : "border-tertiary/30"}`}>
                <p className={`text-xl sm:text-2xl font-black font-headline ${s.color === "primary" ? "text-primary" : "text-tertiary"}`}>{s.value}</p>
                <p className="text-secondary text-xs sm:text-sm mt-1 leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Age groups */}
            <div className="lg:col-span-5 fade-in glass-panel p-5 sm:p-6 rounded-xl">
              <h4 className="font-headline font-bold text-sm uppercase tracking-tight mb-5">{t('health.age_groups')}</h4>
              <div className="space-y-4">
                {hypertensionAgeGroups.map((a, i) => (
                  <div key={a.range}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-headline font-bold text-xs text-on-surface">{a.range} {t('health.age_unit')}</span>
                      <span className="font-headline font-bold text-xs text-tertiary">{a.pct}</span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-tertiary rounded-full" style={{ width: `${a.bar}%` }} />
                    </div>
                    <p className="text-[9px] text-secondary/50 mt-0.5">{hypertensionAgeNotes[i]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk factors */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              <h4 className="font-headline font-bold text-sm uppercase tracking-tight fade-in">{t('health.risk_title')}</h4>
              {riskFactors.map((r) => (
                <div key={r.factor} className="fade-in flex items-start gap-4 bg-surface-container p-4 sm:p-5 rounded-xl border-l-2 border-tertiary/20">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-tertiary-container/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={r.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-on-surface uppercase tracking-tight">{r.factor}</p>
                    <p className="text-secondary text-xs sm:text-sm leading-relaxed">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROJECTIONS + ECONOMIC IMPACT ═══ */}
      <section className="stat-section px-5 sm:px-8 lg:px-12 2xl:px-20 py-28 sm:py-36 bg-surface-low relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-container/5 to-transparent pointer-events-none" />
        <div className="max-w-screen-2xl mx-auto relative z-10">
          <div className="text-center mb-14 sm:mb-16">
            <h2 className="text-primary font-headline font-bold tracking-[0.3em] text-[10px] uppercase fade-in">{t('health.forecast_section')}</h2>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black font-headline tracking-tighter mt-3 fade-in">
              {(() => {
                const [prefix, highlight] = t('health.forecast_heading').split('|');
                return (
                  <>
                    {prefix}
                    <span className="text-primary italic">{highlight}</span>
                  </>
                );
              })()}
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
            {/* Projections table */}
            <div className="fade-in glass-panel p-5 sm:p-6 rounded-xl">
              <h4 className="font-headline font-bold text-sm uppercase tracking-tight mb-5">{t('health.forecast_table_title')}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 text-[10px] text-secondary uppercase tracking-wider font-headline">{t('health.year')}</th>
                      <th className="text-left py-3 text-[10px] text-primary uppercase tracking-wider font-headline">{t('health.diabetes')}</th>
                      <th className="text-left py-3 text-[10px] text-tertiary uppercase tracking-wider font-headline">{t('health.hypertension')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((p) => (
                      <tr key={p.year} className="border-b border-white/5">
                        <td className="py-3 font-headline font-bold text-secondary">{p.year}</td>
                        <td className="py-3 font-headline font-bold text-primary">{p.diabetes}</td>
                        <td className="py-3 font-headline font-bold text-tertiary">{p.hypertension}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-secondary/40 mt-3 italic">{t('health.source')}: IDF Diabetes Atlas, {t('health.src_moh')}, WHO</p>
            </div>

            {/* Economic impact */}
            <div className="fade-in space-y-4 sm:space-y-5">
              <h4 className="font-headline font-bold text-sm uppercase tracking-tight">{t('health.economic_burden')}</h4>
              {economicImpact.map((e) => (
                <div key={e.label} className="bg-surface-container p-4 sm:p-5 rounded-xl border-l-2 border-primary/20">
                  <p className="text-lg sm:text-xl font-black font-headline text-on-surface">{e.value}</p>
                  <p className="text-secondary text-xs sm:text-sm mt-0.5">{e.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA — PHÒNG NGỪA ═══ */}
      <section className="px-5 sm:px-8 lg:px-12 2xl:px-20 py-28 sm:py-36 border-t border-white/5">
        <div className="max-w-5xl mx-auto glass-panel p-8 sm:p-10 md:p-14 rounded-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-container to-transparent" />

          <div className="relative z-10 space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-headline tracking-tighter text-on-surface uppercase">
              {t('health.prevention_heading').replace('.', '')} <span className="text-primary italic">{t('health.prevention_heading').split(' ').pop()}</span>
            </h2>
            <p className="text-secondary max-w-lg mx-auto text-xs sm:text-sm leading-relaxed">
              {t('health.prevention_desc')}
            </p>
            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/san-pham"
                className="bg-primary-container text-on-primary px-8 sm:px-10 py-4 font-headline font-black text-[10px] sm:text-xs tracking-[0.15em] uppercase glow-primary-hover hover:scale-[1.03] active:scale-95 transition-all duration-300 shadow-xl">
                {t('health.learn_more')}
              </a>
              <a href={`tel:${contactInfo.hotline.replace(/\s/g, "")}`}
                className="border border-outline-variant text-on-surface px-8 sm:px-10 py-4 font-headline font-bold text-[10px] sm:text-xs tracking-[0.15em] uppercase hover:bg-surface-high transition-all text-center">
                {t('health.call_consult')} — {contactInfo.hotline}
              </a>
            </div>
          </div>

          <div className="absolute -bottom-16 -right-16 w-40 h-40 border-[20px] border-primary/5 rounded-full" />
          <div className="absolute -top-16 -left-16 w-40 h-40 border-[20px] border-tertiary/5 rounded-full" />
        </div>

        <p className="text-center text-[9px] text-secondary/30 mt-10 sm:mt-12 max-w-2xl mx-auto leading-relaxed">
          {t('health.disclaimer')}
        </p>
      </section>
    </div>
  );
}
