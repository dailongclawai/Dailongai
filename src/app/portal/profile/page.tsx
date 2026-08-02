'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { PasswordInput } from '@/components/portal/PasswordInput';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const { t } = useI18n();
  // Ô nhập lấy giá trị từ hồ sơ cho tới khi người dùng gõ đè. Giữ phần đã gõ trong
  // state riêng để không phải đồng bộ từ hồ sơ bằng setState trong effect.
  const [fullNameEdit, setFullNameEdit] = useState<string | null>(null);
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const [telegramEdit, setTelegramEdit] = useState<string | null>(null);
  const fullName = fullNameEdit ?? profile?.full_name ?? '';
  const phone = phoneEdit ?? profile?.phone ?? '';
  const telegram = telegramEdit ?? profile?.telegram_chat_id ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
  }, [loading, session, router]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ full_name: fullName, phone, telegram_chat_id: telegram.trim() || null })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t('portal.profile.toast.updated'));
      await refresh();
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('portal.profile.toast.password_too_short'));
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t('portal.profile.toast.password_changed'));
      setNewPassword('');
    }
  };

  if (loading || !session || !profile) return null;


  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#8bd6b6]">{t('portal.profile.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-3xl">{t('portal.profile.title')}</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-[#3f4944]/40 bg-[#1a1c1f] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">{t('portal.profile.section.details')}</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60">{t('portal.profile.label.email')}</label>
            <input
              value={profile.email ?? ''}
              disabled
              className="w-full rounded-lg border border-[#3f4944]/40 bg-[#1a1c1f] px-3 py-2 text-sm text-[#e2e2e6]/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60">{t('portal.profile.label.full_name')}</label>
            <input
              value={fullName}
              onChange={(e) => setFullNameEdit(e.target.value)}
              className="w-full rounded-lg border border-[#3f4944]/50 bg-[#1a1c1f] px-3 py-2 text-sm text-[#e2e2e6] placeholder:text-[#e2e2e6]/40 focus:border-[#8bd6b6] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60">{t('portal.profile.label.phone')}</label>
            <input
              value={phone}
              onChange={(e) => setPhoneEdit(e.target.value)}
              className="w-full rounded-lg border border-[#3f4944]/50 bg-[#1a1c1f] px-3 py-2 text-sm text-[#e2e2e6] placeholder:text-[#e2e2e6]/40 focus:border-[#8bd6b6] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60">{t('portal.profile.label.telegram')}</label>
            <input
              value={telegram}
              onChange={(e) => setTelegramEdit(e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="6052313595"
              inputMode="numeric"
              className="w-full rounded-lg border border-[#3f4944]/50 bg-[#1a1c1f] px-3 py-2 font-mono text-sm tabular-nums text-[#e2e2e6] placeholder:text-[#e2e2e6]/40 focus:border-[#8bd6b6] outline-none"
            />
            <p className="mt-1 text-xs text-[#e2e2e6]/50">{t('portal.profile.hint.telegram')}</p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#065f46] px-5 py-2 text-sm font-medium text-white hover:bg-[#065f46]/90 disabled:opacity-50"
          >
            {t('portal.profile.btn.save')}
          </button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-[#3f4944]/40 bg-[#1a1c1f] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">{t('portal.profile.section.password')}</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60">{t('portal.profile.label.new_password')}</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#065f46] px-5 py-2 text-sm font-medium text-white hover:bg-[#065f46]/90 disabled:opacity-50"
          >
            {t('portal.profile.btn.change_password')}
          </button>
        </form>
        {profile.role !== 'admin' && (
          <section className="md:col-span-2 rounded-2xl border border-[#3f4944] bg-[#1a1c1f] p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[28px] text-[#8bd6b6]">account_balance</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">{t('portal.profile.payout.title')}</h2>
                <p className="mt-1 text-xs text-[#a8b3ac]">
                  {t('portal.profile.payout.description')}
                </p>
              </div>
              <Link
                href="/portal/payout-info"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#8bd6b6]/40 bg-[#8bd6b6]/10 px-4 py-2 text-xs font-semibold text-[#8bd6b6] hover:bg-[#065f46] hover:text-white"
              >
                {t('portal.profile.payout.open')}
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </section>
        )}
      </div>
    </PortalShell>
  );
}
