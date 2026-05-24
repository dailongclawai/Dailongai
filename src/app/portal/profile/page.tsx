'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { PasswordInput } from '@/components/portal/PasswordInput';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [loading, session, profile, router]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã cập nhật');
      await refresh();
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã đổi mật khẩu');
      setNewPassword('');
    }
  };

  if (loading || !session || !profile) return null;

  const dashHref = profile.role === 'supervisor' ? '/portal/supervisor' : '/portal/dashboard';
  const nav = profile.role === 'admin'
    ? <AdminNav />
    : <Link href={dashHref} className="text-[#e7eaf0]/60 transition-colors hover:text-[#ff5625]">← Bảng điều khiển</Link>;

  return (
    <PortalShell variant={profile.role ?? 'dealer'} nav={nav}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Hồ sơ</p>
        <h1 className="mt-2 font-headline text-3xl">Thông tin tài khoản</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Thông tin</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">Email</label>
            <input
              value={profile.email ?? ''}
              disabled
              className="w-full rounded-lg border border-[#1f2937]/40 bg-[#11151a] px-3 py-2 text-sm text-[#e7eaf0]/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">Họ tên</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-[#1f2937]/50 bg-[#11151a] px-3 py-2 text-sm text-[#e7eaf0] placeholder:text-[#e7eaf0]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">Số điện thoại</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#1f2937]/50 bg-[#11151a] px-3 py-2 text-sm text-[#e7eaf0] placeholder:text-[#e7eaf0]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            Lưu
          </button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">Mật khẩu mới</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            Đổi mật khẩu
          </button>
        </form>
        {profile.role !== 'admin' && (
          <section className="md:col-span-2 rounded-2xl border border-[#1f2937] bg-[#11151a] p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[28px] text-[#ff5625]">account_balance</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">Tài khoản nhận hoa hồng</h2>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  Đã chuyển sang trang riêng để chọn ngân hàng + verify chính chủ. Nhấn vào nút bên dưới hoặc dùng menu trái.
                </p>
              </div>
              <Link
                href="/portal/payout-info"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ff5625]/40 bg-[#ff5625]/10 px-4 py-2 text-xs font-semibold text-[#ff5625] hover:bg-[#ff5625] hover:text-white"
              >
                Mở
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </section>
        )}
      </div>
    </PortalShell>
  );
}
