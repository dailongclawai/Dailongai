'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';

function homePathFor(role?: string | null): string {
  if (role === 'admin') return '/portal/admin';
  if (role === 'supervisor') return '/portal/supervisor';
  if (role === 'dealer') return '/portal/dashboard';
  return '/portal/login';
}

export default function Forbidden403Page() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const role = profile?.role ?? null;
  const home = homePathFor(role);
  const roleLabelMap: Record<string, string> = {
    dealer: t('portal.shell.role.dealer'),
    supervisor: t('portal.shell.role.supervisor'),
    admin: t('portal.shell.role.admin'),
  };
  const roleLabel = role ? (roleLabelMap[role] ?? role) : t('portal.auth.403.role_unknown');

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-[#1f2937] bg-[#11151a] p-8 text-center shadow-[0_24px_80px_-32px_rgba(0,0,0,0.6)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f87171]/10 text-[#f87171]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.4em] text-[#f87171]">403</p>
        <h1 className="mt-2 font-headline text-3xl text-[#e7eaf0]">{t('portal.auth.403.title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#9ca3af]">
          {t('portal.auth.403.body')}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#1f2937] bg-[#0a0c0f] px-4 py-1.5 text-xs">
          <span className="text-[#9ca3af]">{t('portal.auth.403.role_label')}</span>
          <span className="font-medium text-[#e7eaf0]">{roleLabel}</span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href={home}
            className="flex h-11 items-center justify-center rounded-xl bg-[#ff5625] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a3d] active:scale-[0.98]"
          >
            {t('portal.auth.403.home')}
          </Link>
          <a
            href="https://zalo.me/0357008100"
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center rounded-xl border border-[#1f2937] bg-[#0a0c0f] px-5 text-sm font-medium text-[#e7eaf0] transition-colors hover:bg-[#1a1f26]"
          >
            {t('portal.auth.403.contact_admin')}
          </a>
        </div>
      </div>
    </div>
  );
}
