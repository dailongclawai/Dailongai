'use client';

import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n";

const LuminousFilaments = dynamic(() => import("@/components/LuminousFilaments"), { ssr: false });

export default function AboutUsContent() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen pt-24 sm:pt-28">
      {/* Hero */}
      <section className="relative pt-16 sm:pt-24 pb-32 sm:pb-40 px-5 sm:px-8 lg:px-12 2xl:px-20 max-w-screen-2xl mx-auto overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-container/10 blur-[120px] rounded-full -mr-40 -mt-40" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8 relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] font-extrabold leading-[0.9] tracking-tighter mb-8 font-headline">
              {t('aboutpage.hero_heading')}
            </h1>
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start md:items-center">
              <div className="h-[2px] w-24 bg-primary-container" />
              <p className="text-base sm:text-lg text-secondary max-w-xl font-normal leading-relaxed">
                {t('aboutpage.hero_desc')}
              </p>
            </div>
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-square rounded-[48px] overflow-hidden border border-white/5 bg-surface-high/30 backdrop-blur-md">
              <LuminousFilaments />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <span className="text-primary text-5xl sm:text-6xl font-black font-headline drop-shadow-lg">32+</span>
                <span className="text-secondary text-[10px] uppercase tracking-[0.2em] font-headline font-bold mt-1">{t('aboutpage.years_rd')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="px-5 sm:px-8 lg:px-12 2xl:px-20 max-w-screen-2xl mx-auto mb-24 sm:mb-40">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-5 sm:gap-6">

          {/* Large Feature */}
          <div className="md:col-span-4 lg:col-span-4 bg-surface-container rounded-[48px] flex flex-col justify-between min-h-[400px] sm:min-h-[500px] relative overflow-hidden group">
            <img src="/images/heritage.webp" alt={t('aboutpage.heritage_title')} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700" loading="lazy" decoding="async" width={1200} height={686} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-surface-container/80 to-transparent" />
            <div className="relative z-10 p-8 sm:p-12 flex flex-col justify-between flex-1">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 font-headline">{t('aboutpage.heritage_title')}</h2>
                <p className="text-secondary text-base sm:text-lg max-w-md leading-relaxed">
                  {t('aboutpage.heritage_desc')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-8 pt-12">
                <div>
                  <div className="text-3xl font-bold text-primary mb-1">210+</div>
                  <div className="text-xs uppercase tracking-tight text-secondary">{t('aboutpage.patents')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-1">6360</div>
                  <div className="text-xs uppercase tracking-tight text-secondary">{t('aboutpage.clinical_patients')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Vision */}
          <div className="md:col-span-2 lg:col-span-2 bg-surface-high rounded-[48px] overflow-hidden flex flex-col min-h-[340px] relative group">
            <div className="relative h-48 sm:h-56 overflow-hidden">
              <img src="/images/vision.webp" alt={t('aboutpage.vision')} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" width={800} height={800} />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-high via-transparent to-transparent" />
            </div>
            <div className="p-8 pt-4 flex flex-col flex-1 justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold font-headline mb-1">{t('aboutpage.vision')}</h3>
                <p className="text-primary text-[10px] uppercase tracking-[0.2em] font-headline font-bold mb-4">Vision</p>
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                {t('aboutpage.vision_desc')}
              </p>
            </div>
          </div>

          {/* Mission */}
          <div className="md:col-span-2 lg:col-span-2 bg-surface-high rounded-[48px] overflow-hidden flex flex-col min-h-[340px] relative group">
            <div className="relative h-48 sm:h-56 overflow-hidden">
              <img src="/images/mission.webp" alt={t('aboutpage.mission')} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" width={800} height={800} />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-high via-transparent to-transparent" />
            </div>
            <div className="p-8 pt-4 flex flex-col flex-1 justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold font-headline mb-1">{t('aboutpage.mission')}</h3>
                <p className="text-primary text-[10px] uppercase tracking-[0.2em] font-headline font-bold mb-4">Mission</p>
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                {t('aboutpage.mission_desc')}
              </p>
            </div>
          </div>

          {/* Clinical Credibility */}
          <div className="md:col-span-4 lg:col-span-4 bg-surface-container rounded-[48px] flex flex-col justify-center relative overflow-hidden group">
            <img src="/images/clinical.webp" alt={t('aboutpage.clinical_title')} className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all duration-700" loading="lazy" decoding="async" width={1200} height={686} />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-container via-surface-container/85 to-surface-container/60" />
            <div className="relative z-10 p-8 sm:p-12">
              <div className="flex items-center gap-4 mb-6 sm:mb-8">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h4 className="text-xl sm:text-2xl font-bold font-headline uppercase tracking-tight">{t('aboutpage.clinical_title')}</h4>
              </div>
              <p className="text-base sm:text-lg text-secondary mb-8 sm:mb-10 leading-relaxed font-normal">
                {t('aboutpage.clinical_desc')}
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {["ISO 13485", "ISO 9001", "GP Lưu hành Việt Nam", "GP Lưu hành Trung Quốc"].map((c) => (
                  <div key={c} className="px-4 sm:px-6 py-2 sm:py-3 bg-surface-lowest/80 backdrop-blur-sm rounded-full border border-white/10 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs sm:text-sm font-bold">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="mb-24 sm:mb-40 px-5 sm:px-8 lg:px-12 2xl:px-20 max-w-screen-2xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 sm:gap-24 items-center">
          <div className="lg:w-1/2 relative">
            <div className="absolute -inset-10 bg-primary-container/5 blur-[80px] rounded-full" />
            <div className="relative rounded-[48px] overflow-hidden aspect-[4/3] bg-surface-container">
              <img src="/images/research-lab-v2.webp" alt={t('aboutpage.partnership')} className="w-full h-full object-cover" loading="lazy" decoding="async" width={800} height={600} />
            </div>
          </div>
          <div className="lg:w-1/2">
            <span className="text-primary text-[10px] uppercase tracking-[0.3em] font-headline font-bold mb-6 block">{t('aboutpage.exclusive')}</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-headline mb-8 tracking-tighter">{t('aboutpage.partnership')}</h2>
            <p className="text-secondary text-base sm:text-lg leading-relaxed mb-8">
              {t('aboutpage.partnership_desc')}
            </p>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <svg className="w-6 h-6 text-primary mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h5 className="font-bold text-on-surface">{t('aboutpage.precision')}</h5>
                  <p className="text-secondary text-sm">{t('aboutpage.precision_desc')}</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <svg className="w-6 h-6 text-primary mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h5 className="font-bold text-on-surface">{t('aboutpage.data_driven')}</h5>
                  <p className="text-secondary text-sm">{t('aboutpage.data_driven_desc')}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 sm:px-8 lg:px-12 2xl:px-20 max-w-screen-2xl mx-auto mb-20">
        <div className="bg-gradient-to-br from-primary-container to-primary rounded-[48px] p-10 sm:p-16 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline text-on-primary mb-8 tracking-tighter uppercase">{t('aboutpage.cta')}</h2>
            <a href="/#contact" className="inline-block bg-surface-lowest text-on-surface px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold text-base sm:text-lg hover:bg-surface-high transition-all duration-300 shadow-2xl">
              {t('aboutpage.cta_btn')}
            </a>
          </div>
        </div>
      </section>

      <div className="h-16 sm:h-24" />
    </div>
  );
}
