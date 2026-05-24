'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase';
import { trackReferral } from '@/lib/referral-tracker';
import { OAuthButton } from '@/components/portal/OAuthButton';
import { Spinner } from '@/components/portal/Spinner';
import { PasswordInput } from '@/components/portal/PasswordInput';
import { useI18n } from '@/lib/i18n';

export default function RegisterPage() {
  const { t } = useI18n();
  const schema = z.object({
    email: z.string().email(t('portal.auth.login.error_email_invalid')),
    password: z.string().min(8, t('portal.auth.login.error_password_min')),
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r) {
      setRef(r);
      localStorage.setItem('portal_ref', r);
      void trackReferral({ eventType: 'supervisor_view', supervisorId: r });
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal/auth/callback`,
        data: ref ? { ref } : undefined,
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) {
      window.location.assign('/portal');
    } else {
      toast.success(t('portal.auth.register.confirm_sent'));
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#ff5625]/20 bg-gradient-to-br from-[#ff5625]/[0.04] via-[#11151a] to-[#11151a] p-7 sm:p-9">
        <div className="flex flex-col items-center text-center">
          <Link href="/" aria-label={t('portal.auth.common.logo_home_aria')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-orange.webp" alt={t('portal.auth.common.logo_alt')} className="h-16 w-auto sm:h-20" />
          </Link>
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#ff5625]/40 bg-[#ff5625]/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#ff5625] font-bold">
            <span aria-hidden="true">✦</span>
            {t('portal.auth.register.badge')}
          </div>
          <h1 className="mt-3 font-headline text-3xl font-bold leading-[1.1] tracking-tight text-[#e7eaf0] sm:text-4xl">
            {t('portal.auth.register.welcome_prefix')}{' '}
            <span className="bg-gradient-to-r from-[#ff5625] via-[#ff8a5b] to-[#f59e0b] bg-clip-text text-transparent">
              {t('portal.auth.register.welcome_brand')}
            </span>
          </h1>
        </div>

        {ref && (
          <p className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/[0.08] px-3 py-2 text-xs text-[#10b981]">
            {t('portal.auth.register.invite_notice')}
          </p>
        )}

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
            <label htmlFor="password" className="mb-1.5 block text-xs text-[#9ca3af]">{t('portal.auth.common.password_label')}</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder={t('portal.auth.common.password_min_placeholder')}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5625] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? t('portal.auth.register.submitting') : t('portal.auth.register.submit')}
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
          {t('portal.auth.register.have_account')}{' '}
          <Link href="/portal/login" className="font-medium text-[#ff5625] hover:underline">
            {t('portal.auth.register.signin_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
