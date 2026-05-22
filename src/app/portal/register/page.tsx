import Link from 'next/link';
import { OAuthButton } from '@/components/portal/OAuthButton';
import { EmailAuthForm } from '@/components/portal/EmailAuthForm';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-panel w-full max-w-md space-y-7 rounded-3xl border border-white/10 p-10">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Đại Long Portal</p>
          <h1 className="mt-3 font-headline text-4xl">Đăng ký Đại lý</h1>
          <p className="mt-2 text-sm text-[#e2e2e5]/60">Chọn cách đăng ký nhanh nhất</p>
        </div>
        <div className="space-y-3">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
          <Link
            href="/portal/phone-signup"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-[#1e2022] px-6 py-3 text-sm font-medium text-[#e2e2e5] hover:border-[#ff5625] hover:text-[#ff5625]"
          >
            <span>📱</span> Đăng ký bằng SĐT (Zalo OTP)
          </Link>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/40">
          <span className="h-px flex-1 bg-white/12" />
          hoặc email
          <span className="h-px flex-1 bg-white/12" />
        </div>
        <EmailAuthForm mode="register" />
        <p className="text-center text-sm text-[#e2e2e5]/60">
          Đã có tài khoản?{' '}
          <Link href="/portal/login" className="font-medium text-[#ff5625] hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
