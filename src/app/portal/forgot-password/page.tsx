'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase';
import { Spinner } from '@/components/portal/Spinner';
import { useI18n } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error(t('portal.auth.login.error_email_invalid')); return; }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal/auth/callback?type=recovery`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success(t('portal.auth.forgot.toast_sent'));
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#49443f]/40 p-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff8a50]">{t('portal.auth.common.portal_badge')}</p>
          <h1 className="mt-3 font-headline text-3xl">{t('portal.auth.forgot.title')}</h1>
          <p className="mt-2 text-sm text-[#b3aca8]">
            {t('portal.auth.forgot.subtitle')}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-2xl border border-[#ff5625]/30 bg-[#ff5625]/[0.06] p-5 text-center">
            <span className="material-symbols-outlined text-[40px] text-[#ff5625]">mark_email_read</span>
            <div>
              <p className="text-sm font-semibold text-[#ff5625]">{t('portal.auth.forgot.sent_heading')}</p>
              <p className="mt-1 text-xs text-[#b3aca8]">
                {t('portal.auth.forgot.sent_prefix')} <span className="font-medium text-[#e2e2e6]">{email}</span> {t('portal.auth.forgot.sent_suffix')}
              </p>
            </div>
            <p className="text-[11px] text-[#b3aca8]">
              {t('portal.auth.forgot.not_received')}{' '}
              <button onClick={() => { setSent(false); setEmail(''); }} className="text-[#ff8a50] hover:underline">
                {t('portal.auth.forgot.resend')}
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#b3aca8]">{t('portal.auth.common.email_label')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('portal.auth.common.email_placeholder')}
                className="w-full rounded-lg border border-[#49443f]/50 bg-[#1a1c1f] px-3 py-2.5 text-sm text-[#e2e2e6] placeholder:text-[#b3aca8]/60 outline-none focus:border-[#ff8a50]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e8692a] py-3 text-sm font-bold text-white transition-colors hover:bg-[#e8692a]/90 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? t('portal.auth.forgot.submitting') : t('portal.auth.forgot.submit')}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#b3aca8]">
          {t('portal.auth.forgot.remembered')}{' '}
          <Link href="/portal/login" className="font-medium text-[#ff8a50] hover:underline">
            {t('portal.auth.forgot.back_to_signin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
