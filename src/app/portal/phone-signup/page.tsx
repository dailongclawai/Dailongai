'use client';

import Link from 'next/link';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function PhoneSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-[#0e1525]/15 bg-white/90 p-10 text-center shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Đang phát triển</p>
        <h1 style={display} className="text-3xl font-light italic">Đăng ký bằng SĐT</h1>
        <p className="text-sm text-[#0e1525]/70">
          Tính năng OTP qua <strong>Zalo OA</strong> đang trong Plan 3. Trong thời gian chờ, vui lòng dùng Google / Facebook / Email để đăng ký.
        </p>
        <div className="space-y-2 rounded-xl bg-[#f5f1e8] p-4 text-left text-xs text-[#0e1525]/70">
          <p className="font-semibold text-[#0e1525]">Lý do:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Cần Supabase Edge Function gọi Zalo OA API gửi OTP</li>
            <li>Cần bảng <code className="rounded bg-white px-1">phone_otp</code> + cleanup cron</li>
            <li>Cần lookup phone → user_id trong Zalo OA</li>
          </ul>
        </div>
        <Link
          href="/portal/register"
          className="inline-block rounded-full bg-[#0e1525] px-6 py-2.5 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b]"
        >
          ← Quay lại đăng ký
        </Link>
      </div>
    </div>
  );
}
