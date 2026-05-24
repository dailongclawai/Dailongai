'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function PhoneSignupPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#1f2937]/40 p-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.auth.phone.badge')}</p>
        <h1 className="font-headline text-3xl">{t('portal.auth.phone.title')}</h1>
        <p className="text-sm text-[#e7eaf0]/70">
          {t('portal.auth.phone.body_prefix')} <strong>Zalo OA</strong> {t('portal.auth.phone.body_suffix')}
        </p>
        <div className="space-y-2 rounded-xl bg-[#11151a] p-4 text-left text-xs text-[#e7eaf0]/70">
          <p className="font-semibold text-[#e7eaf0]">{t('portal.auth.phone.reason_heading')}</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>{t('portal.auth.phone.reason_1')}</li>
            <li>{t('portal.auth.phone.reason_2_prefix')} <code className="rounded bg-[#0a0c0f] px-1">phone_otp</code> {t('portal.auth.phone.reason_2_suffix')}</li>
            <li>{t('portal.auth.phone.reason_3')}</li>
          </ul>
        </div>
        <Link
          href="/portal/register"
          className="inline-block rounded-full bg-[#ff5625] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#ff5625]/90"
        >
          {t('portal.auth.phone.back_to_register')}
        </Link>
      </div>
    </div>
  );
}
