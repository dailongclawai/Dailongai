'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase';
import { Spinner } from '@/components/portal/Spinner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Email không hợp lệ'); return; }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal/auth/callback?type=recovery`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success('Đã gửi email khôi phục mật khẩu');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#1f2937]/40 p-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Đại Long Portal</p>
          <h1 className="mt-3 font-headline text-3xl">Quên mật khẩu</h1>
          <p className="mt-2 text-sm text-[#9ca3af]">
            Nhập email tài khoản — tôi gửi link đặt lại mật khẩu cho Boss
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-2xl border border-[#10b981]/30 bg-[#10b981]/[0.06] p-5 text-center">
            <span className="material-symbols-outlined text-[40px] text-[#10b981]">mark_email_read</span>
            <div>
              <p className="text-sm font-semibold text-[#10b981]">Đã gửi email</p>
              <p className="mt-1 text-xs text-[#9ca3af]">
                Mở email <span className="font-medium text-[#e7eaf0]">{email}</span> → click link "Reset password" → tạo mật khẩu mới.
              </p>
            </div>
            <p className="text-[11px] text-[#9ca3af]">
              Không thấy email? Check Spam, hoặc{' '}
              <button onClick={() => { setSent(false); setEmail(''); }} className="text-[#ff5625] hover:underline">
                gửi lại
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#9ca3af]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ban@example.com"
                className="w-full rounded-lg border border-[#1f2937]/50 bg-[#11151a] px-3 py-2.5 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af]/60 outline-none focus:border-[#ff5625]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff5625] py-3 text-sm font-bold text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang gửi…' : 'Gửi link khôi phục'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#9ca3af]">
          Nhớ rồi?{' '}
          <Link href="/portal/login" className="font-medium text-[#ff5625] hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
