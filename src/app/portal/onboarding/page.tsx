'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const phoneSchema = z.string().regex(/^0\d{9,10}$/, t('portal.auth.onboarding.error_phone_invalid'));
  const { session, profile, loading, refresh } = useAuth();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.phone) router.replace('/portal');
  }, [loading, session, profile, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? t('portal.auth.onboarding.error_phone_invalid_short'));
      return;
    }
    setPhoneError('');
    setSubmitting(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ phone })
      .eq('id', session!.user.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('portal.auth.onboarding.toast_success'));
    await refresh();
    router.replace('/portal/pending');
  };

  if (loading || !session) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#1f2937]/40 p-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.auth.onboarding.badge')}</p>
          <h1 className="mt-3 font-headline text-3xl">{t('portal.auth.onboarding.title')}</h1>
          <p className="mt-2 text-sm text-[#e7eaf0]/60">{t('portal.auth.onboarding.subtitle')}</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">
              {t('portal.auth.onboarding.phone_label')}
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
              className="w-full rounded-lg border border-[#1f2937]/50 bg-[#11151a] px-3 py-2 text-sm text-[#e7eaf0] placeholder:text-[#e7eaf0]/40 outline-none focus:border-[#ff5625]"
            />
            {phoneError && <p className="mt-1 text-xs text-[#f87171]">{phoneError}</p>}
          </div>
          <p className="rounded-lg bg-[#11151a] px-4 py-3 text-xs text-[#e7eaf0]/60">
            {t('portal.auth.onboarding.role_note')}
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#ff5625] py-3 text-sm font-medium text-white hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            {submitting ? t('portal.auth.onboarding.submitting') : t('portal.auth.onboarding.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
