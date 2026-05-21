'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';

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
  const { profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/portal/login');
  };

  const variantTag = {
    dealer: { label: 'Phiên bản đại lý', dot: 'bg-[#bc7e3b]' },
    supervisor: { label: 'Phiên bản supervisor', dot: 'bg-[#5d8d6a]' },
    admin: { label: 'Admin Console', dot: 'bg-[#c46a5e]' },
  }[variant];

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-10">
      <header className="flex items-baseline justify-between border-b border-[#0e1525]/15 pb-4">
        <div className="flex items-baseline gap-3">
          <Link href="/portal" className="text-[10px] uppercase tracking-[0.3em] text-[#0e1525]/60 hover:text-[#0e1525]">
            Đại Long Portal
          </Link>
          <span className={`h-1 w-1 rounded-full ${variantTag.dot}`} />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#0e1525]/60">{variantTag.label}</p>
        </div>
        <nav className="flex items-center gap-8 text-[13px]">
          {nav}
          {profile && (
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[#0e1525]/60 hover:text-[#bc7e3b]"
              title="Đăng xuất"
            >
              {profile.full_name?.split(' ').slice(-1)[0] ?? profile.email?.split('@')[0] ?? 'Tài khoản'} · Đăng xuất
            </button>
          )}
        </nav>
      </header>
      <main className="mt-8">{children}</main>
    </div>
  );
}
