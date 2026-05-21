import Link from 'next/link';
import { OAuthButton } from '@/components/portal/OAuthButton';
import { EmailAuthForm } from '@/components/portal/EmailAuthForm';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-7 rounded-3xl border border-[#0e1525]/15 bg-white/90 p-10 shadow-sm backdrop-blur">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Đại Long Portal</p>
          <h1 style={display} className="mt-3 text-4xl font-light italic">Đăng ký Đại lý</h1>
          <p className="mt-2 text-sm text-[#0e1525]/60">Chọn cách đăng ký nhanh nhất</p>
        </div>
        <div className="space-y-3">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
          <Link
            href="/portal/phone-signup"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-[#0e1525]/15 bg-white px-6 py-3 text-sm font-medium text-[#0e1525] hover:border-[#0e1525]"
          >
            <span>📱</span> Đăng ký bằng SĐT (Zalo OTP)
          </Link>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/40">
          <span className="h-px flex-1 bg-[#0e1525]/10" />
          hoặc email
          <span className="h-px flex-1 bg-[#0e1525]/10" />
        </div>
        <EmailAuthForm mode="register" />
        <p className="text-center text-sm text-[#0e1525]/60">
          Đã có tài khoản?{' '}
          <Link href="/portal/login" className="font-medium text-[#bc7e3b] hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
