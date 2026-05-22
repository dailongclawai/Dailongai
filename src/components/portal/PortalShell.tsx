'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/portal-queries';

export function PortalShell({
  children,
  nav,
  variant = 'dealer',
}: {
  children: ReactNode;
  nav?: ReactNode;
  variant?: 'dealer' | 'supervisor' | 'admin';
}) {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!session) return;
    getUnreadCount().then(setUnread);
  }, [session]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/portal/login');
  };

  const variantTag = {
    dealer: { label: 'Phiên bản đại lý', dot: 'bg-[#ff5625]' },
    supervisor: { label: 'Phiên bản supervisor', dot: 'bg-[#34d399]' },
    admin: { label: 'Admin Console', dot: 'bg-[#00daf3]' },
  }[variant];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-8 md:py-10">
      <header className="glass-panel rounded-2xl border border-white/10 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/portal" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-orange.webp" alt="Đại Long" className="h-9 w-auto" width={120} height={120} />
            <span className={`h-1 w-1 rounded-full ${variantTag.dot}`} />
            <span className="hidden text-[10px] uppercase tracking-[0.3em] text-[#e2e2e5]/60 sm:block">{variantTag.label}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-[13px] md:gap-6">
            {nav}
            <Link href="/portal/inbox" className="relative text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]">
              Hộp thư
              {unread > 0 && (
                <span className="absolute -right-3 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5625] text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            {profile && (
              <span className="flex items-center gap-1 text-[#e2e2e5]/60">
                <Link href="/portal/profile" className="transition-colors hover:text-[#ff5625]">
                  {profile.full_name?.split(' ').slice(-1)[0] ?? profile.email?.split('@')[0] ?? 'Tài khoản'}
                </Link>
                <span>·</span>
                <button type="button" onClick={handleSignOut} className="transition-colors hover:text-[#ff5625]">
                  Đăng xuất
                </button>
              </span>
            )}
          </nav>
        </div>
      </header>
      <main className="mt-6 md:mt-8">{children}</main>
    </div>
  );
}
