'use client';

import Link from 'next/link';

export default function PhoneSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="portal-glass w-full max-w-md space-y-6 rounded-3xl border border-[#5b4039]/40 p-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Đang phát triển</p>
        <h1 className="font-headline text-3xl">Đăng ký bằng SĐT</h1>
        <p className="text-sm text-[#fadcd5]/70">
          Tính năng OTP qua <strong>Zalo OA</strong> đang trong Plan 3. Trong thời gian chờ, vui lòng dùng Google / Facebook / Email để đăng ký.
        </p>
        <div className="space-y-2 rounded-xl bg-[#2c1c17] p-4 text-left text-xs text-[#fadcd5]/70">
          <p className="font-semibold text-[#fadcd5]">Lý do:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Cần Supabase Edge Function gọi Zalo OA API gửi OTP</li>
            <li>Cần bảng <code className="rounded bg-[#1e100c] px-1">phone_otp</code> + cleanup cron</li>
            <li>Cần lookup phone → user_id trong Zalo OA</li>
          </ul>
        </div>
        <Link
          href="/portal/register"
          className="inline-block rounded-full bg-[#ff5626] px-6 py-2.5 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff5626]/90"
        >
          ← Quay lại đăng ký
        </Link>
      </div>
    </div>
  );
}
