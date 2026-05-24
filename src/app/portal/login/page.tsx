'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase';
import { OAuthButton } from '@/components/portal/OAuthButton';
import { Spinner } from '@/components/portal/Spinner';
import { PasswordInput } from '@/components/portal/PasswordInput';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const { t } = useI18n();
  const schema = z.object({
    email: z.string().email(t('portal.auth.login.error_email_invalid')),
    password: z.string().min(8, t('portal.auth.login.error_password_min')),
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    window.location.assign('/portal');
  };

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md space-y-7 rounded-2xl border border-[#1f2937] bg-[#11151a] p-7 sm:p-9">
        <div className="flex flex-col items-center text-center">
          <Link href="/" aria-label={t('portal.auth.common.logo_home_aria')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-orange.webp" alt={t('portal.auth.common.logo_alt')} className="h-16 w-auto sm:h-20" />
          </Link>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#1f2937] bg-[#0a0c0f] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#9ca3af]">
            <span aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            {t('portal.auth.common.portal_badge')}
          </div>
          <h1 className="mt-3 font-headline text-3xl font-bold leading-tight tracking-tight text-[#e7eaf0] sm:text-4xl">
            {t('portal.auth.login.title')}
          </h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs text-[#9ca3af]">{t('portal.auth.common.email_label')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder={t('portal.auth.common.email_placeholder')}
              className="w-full rounded-xl border border-[#1f2937] bg-[#0a0c0f] px-4 py-3.5 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af]/60 outline-none focus:border-[#ff5625]"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-xs text-[#9ca3af]">{t('portal.auth.common.password_label')}</label>
              <Link href="/portal/forgot-password" className="text-xs text-[#9ca3af] hover:text-[#ff5625]">
                {t('portal.auth.login.forgot_link')}
              </Link>
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5625] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? t('portal.auth.login.submitting') : t('portal.auth.login.submit')}
          </button>
        </form>

        <div className="flex items-center gap-3 text-[11px] text-[#9ca3af]">
          <span className="h-px flex-1 bg-[#1f2937]" />
          {t('portal.auth.common.or')}
          <span className="h-px flex-1 bg-[#1f2937]" />
        </div>

        <div className="space-y-2.5">
          <OAuthButton provider="google" />
          <OAuthButton provider="apple" />
        </div>

        <p className="border-t border-[#1f2937] pt-5 text-center text-sm text-[#9ca3af]">
          {t('portal.auth.login.no_account')}{' '}
          <Link href="/portal/register" className="font-medium text-[#ff5625] hover:underline">
            {t('portal.auth.login.signup_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
