'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { toast } from 'sonner';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

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

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Hồ sơ</p>
        <h1 style={display} className="mt-2 text-3xl font-light italic">Tài khoản</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-[#0e1525]/15 bg-white/80 p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Thông tin</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Email</label>
            <input
              value={profile.email ?? ''}
              disabled
              className="w-full rounded-lg border border-[#0e1525]/10 bg-[#f5f1e8] px-3 py-2 text-sm text-[#0e1525]/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Họ tên</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm focus:border-[#0e1525] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Số điện thoại</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm focus:border-[#0e1525] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#0e1525] px-5 py-2 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50"
          >
            Lưu
          </button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-[#0e1525]/15 bg-white/80 p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm focus:border-[#0e1525] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#0e1525] px-5 py-2 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50"
          >
            Đổi mật khẩu
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
