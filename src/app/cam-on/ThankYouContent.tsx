'use client';

import { useI18n } from "@/lib/i18n";
import { contactInfo } from "@/data/siteData";

export default function ThankYouContent() {
  const { t } = useI18n();

  const steps = [
    t('thankyou.step1'),
    t('thankyou.step2'),
    t('thankyou.step3'),
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 pt-28 pb-20">
      {/* Glow background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-container/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-2xl w-full text-center space-y-10">
        {/* Success icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary-container/20 blur-[40px] rounded-full" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center glow-primary">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--on-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sm:w-14 sm:h-14"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-5xl font-headline font-bold tracking-tight text-gradient leading-tight">
            {t('thankyou.title')}
          </h1>
          <p className="text-base sm:text-lg text-secondary/80 max-w-lg mx-auto leading-relaxed">
            {t('thankyou.desc')}
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="glass-panel rounded-2xl p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-headline font-semibold">
              {t('thankyou.hotline')}
            </p>
            <p className="text-sm font-headline font-bold text-on-surface">
              {contactInfo.hotline}
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-headline font-semibold">
              {t('thankyou.showroom')}
            </p>
            <p className="text-sm font-headline font-bold text-on-surface">
              {contactInfo.showroom}
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-headline font-semibold">
              {t('thankyou.hours')}
            </p>
            <p className="text-sm font-headline font-bold text-on-surface">
              {contactInfo.showroomHours}
            </p>
          </div>
        </div>

        {/* Next steps */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 text-left space-y-4">
          <h2 className="text-sm font-headline font-bold uppercase tracking-[0.1em] text-primary">
            {t('thankyou.next_steps')}
          </h2>
          <ul className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-primary-container/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 font-headline">
                  {i + 1}
                </span>
                <span className="text-sm text-secondary/80 leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary font-headline font-bold text-xs uppercase tracking-[0.1em] px-8 py-4 hover:brightness-110 transition-all active:scale-[0.98]"
          >
            {t('thankyou.back_home')}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
          <a
            href={contactInfo.zalo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-surface-high text-on-surface font-headline font-bold text-xs uppercase tracking-[0.1em] px-8 py-4 border border-white/10 hover:bg-surface-bright transition-all active:scale-[0.98]"
          >
            {t('thankyou.zalo')}
          </a>
        </div>
      </div>
    </main>
  );
}
