'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
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
    : <Link href={dashHref} className="text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]">← Bảng điều khiển</Link>;

  return (
    <PortalShell variant={profile.role ?? 'dealer'} nav={nav}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Hồ sơ</p>
        <h1 className="mt-2 font-headline text-3xl">Thông tin tài khoản</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-white/12 bg-[#1e2022] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Thông tin</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Email</label>
            <input
              value={profile.email ?? ''}
              disabled
              className="w-full rounded-lg border border-white/12 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5]/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Họ tên</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Số điện thoại</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff8a5c] disabled:opacity-50"
          >
            Lưu
          </button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-white/12 bg-[#1e2022] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff8a5c] disabled:opacity-50"
          >
            Đổi mật khẩu
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
