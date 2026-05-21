'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';

const phoneSchema = z.string().regex(/^0\d{9,10}$/, 'SĐT không hợp lệ (ví dụ: 0901234567)');

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function OnboardingPage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const [phone, setPhone] = useState('');
  const [requestedRole, setRequestedRole] = useState<'dealer' | 'supervisor'>('dealer');
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
      .update({
        phone,
        business_name: requestedRole === 'supervisor' ? '[Mong muốn: Supervisor]' : '[Mong muốn: Dealer]',
      })
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
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-[#0e1525]/15 bg-white/90 p-10 shadow-sm">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Bước cuối</p>
          <h1 style={display} className="mt-3 text-3xl font-light italic">Hoàn tất hồ sơ</h1>
          <p className="mt-2 text-sm text-[#0e1525]/60">Còn 2 thông tin tối thiểu</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">
              Số điện thoại
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
              className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
            />
            {phoneError && <p className="mt-1 text-xs text-[#c46a5e]">{phoneError}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[#0e1525]/60">Loại tài khoản mong muốn</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 hover:border-[#0e1525]">
                <input
                  type="radio"
                  name="role"
                  checked={requestedRole === 'dealer'}
                  onChange={() => setRequestedRole('dealer')}
                  className="accent-[#bc7e3b]"
                />
                <div>
                  <p className="text-sm font-medium">Đại lý phân phối</p>
                  <p className="text-xs text-[#0e1525]/60">Bán máy laser, nhận hoa hồng theo tier</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 hover:border-[#0e1525]">
                <input
                  type="radio"
                  name="role"
                  checked={requestedRole === 'supervisor'}
                  onChange={() => setRequestedRole('supervisor')}
                  className="accent-[#bc7e3b]"
                />
                <div>
                  <p className="text-sm font-medium">Supervisor</p>
                  <p className="text-xs text-[#0e1525]/60">Quản lý nhiều đại lý, hưởng override</p>
                </div>
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#0e1525] py-3 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50"
          >
            {submitting ? 'Đang gửi…' : 'Hoàn tất'}
          </button>
        </form>
      </div>
    </div>
  );
}
