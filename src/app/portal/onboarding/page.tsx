'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';

const phoneSchema = z.string().regex(/^0\d{9,10}$/, 'SĐT không hợp lệ (ví dụ: 0901234567)');

export default function OnboardingPage() {
  const router = useRouter();
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
      setPhoneError(parsed.error.issues[0]?.message ?? 'SĐT không hợp lệ');
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
    toast.success('Đã ghi nhận, đang chờ admin duyệt');
    await refresh();
    router.replace('/portal/pending');
  };

  if (loading || !session) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#1f2937]/40 p-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Bước cuối</p>
          <h1 className="mt-3 font-headline text-3xl">Hoàn tất hồ sơ</h1>
          <p className="mt-2 text-sm text-[#e7eaf0]/60">Chỉ cần số điện thoại để admin liên hệ xác minh</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">
              Số điện thoại
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
            Loại tài khoản (đại lý / supervisor) sẽ do admin Đại Long gán khi duyệt hồ sơ.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#ff5625] py-3 text-sm font-medium text-white hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            {submitting ? 'Đang gửi…' : 'Hoàn tất'}
          </button>
        </form>
      </div>
    </div>
  );
}
