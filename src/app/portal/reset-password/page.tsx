'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase';
import { Spinner } from '@/components/portal/Spinner';
import { PasswordInput } from '@/components/portal/PasswordInput';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Only allow access when the user landed here from a recovery email link
  // (auth/callback exchanges the code → creates session → routes here).
  useEffect(() => {
    let cancelled = false;
    getSupabaseClient().auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(!!data.session);
    });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Mật khẩu phải có ít nhất 8 ký tự'); return; }
    if (password !== confirm) { toast.error('Mật khẩu nhập lại không khớp'); return; }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã đặt lại mật khẩu');
    router.replace('/portal');
  };

  if (hasSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#9ca3af]">
        Đang kiểm tra link khôi phục…
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="portal-glass w-full max-w-md space-y-4 rounded-3xl border border-[#f87171]/30 p-10 text-center">
          <span className="material-symbols-outlined text-[40px] text-[#f87171]">link_off</span>
          <div>
            <h1 className="font-headline text-2xl">Link hết hạn hoặc không hợp lệ</h1>
            <p className="mt-2 text-sm text-[#9ca3af]">
              Link reset mật khẩu chỉ dùng được 1 lần và hết hạn sau 1 giờ. Gửi yêu cầu mới bên dưới.
            </p>
          </div>
          <Link
            href="/portal/forgot-password"
            className="inline-flex items-center gap-2 rounded-full bg-[#ff5625] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#ff5625]/90"
          >
            Gửi lại link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#1f2937]/40 p-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Đại Long Portal</p>
          <h1 className="mt-3 font-headline text-3xl">Đặt lại mật khẩu</h1>
          <p className="mt-2 text-sm text-[#9ca3af]">Nhập mật khẩu mới cho tài khoản</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#9ca3af]">Mật khẩu mới</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              minLength={8}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#9ca3af]">Nhập lại mật khẩu</label>
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff5625] py-3 text-sm font-bold text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
          </button>
        </form>
      </div>
    </div>
  );
}
