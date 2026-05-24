'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/portal-queries';
import { AccountIdBadge } from './AccountIdBadge';

type Variant = 'dealer' | 'supervisor' | 'admin';
interface NavItem { href: string; label: string; icon: string; exact?: boolean }

const NAV: Record<Variant, NavItem[]> = {
  admin: [
    { href: '/portal/admin', label: 'Tổng quan', icon: 'dashboard', exact: true },
    { href: '/portal/admin/orders', label: 'Đơn hàng', icon: 'shopping_cart' },
    { href: '/portal/admin/payouts', label: 'Hoa hồng', icon: 'payments' },
    { href: '/portal/admin/products', label: 'Sản phẩm', icon: 'medical_services' },
    { href: '/portal/admin/supervisors', label: 'Supervisor', icon: 'groups' },
    { href: '/portal/admin/upgrade', label: 'Nâng cấp', icon: 'upgrade' },
    { href: '/portal/admin/reports', label: 'Báo cáo', icon: 'bar_chart' },
    { href: '/portal/admin/audit', label: 'Nhật ký', icon: 'history' },
  ],
  dealer: [
    { href: '/portal/dashboard', label: 'Tổng quan', icon: 'dashboard', exact: true },
    { href: '/portal/dealer/commission', label: 'Hoa hồng', icon: 'payments' },
    { href: '/portal/dealer/qr', label: 'Mã QR đặt đơn', icon: 'qr_code_2' },
    { href: '/portal/payout-info', label: 'Tài khoản nhận tiền', icon: 'account_balance' },
  ],
  supervisor: [
    { href: '/portal/supervisor', label: 'Đội của tôi', icon: 'groups', exact: true },
    { href: '/portal/supervisor/qr', label: 'QR mời đại lý', icon: 'qr_code_2' },
    { href: '/portal/payout-info', label: 'Tài khoản nhận tiền', icon: 'account_balance' },
  ],
};

export function PortalShell({
  children,
  variant = 'dealer',
}: {
  children: ReactNode;
  nav?: ReactNode;
  variant?: Variant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (session) getUnreadCount().then(setUnread);
  }, [session]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const items = NAV[variant];
  const initials = (profile?.full_name ?? profile?.email ?? 'DL')
    .split(' ').slice(-2).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel = variant === 'admin' ? 'Quản trị viên' : variant === 'supervisor' ? 'Supervisor' : 'Đại lý';

  const handleSignOut = async () => { await signOut(); router.replace('/portal/login'); };

  const isActive = (it: NavItem) => (it.exact ? pathname === it.href : pathname.startsWith(it.href));
  const navLink = (it: NavItem) => {
    const active = isActive(it);
    return (
      <Link
        key={it.href}
        href={it.href}
        className={`flex items-center gap-3 px-6 py-3 transition-colors duration-200 group ${
          active
            ? 'text-[#ff5625] border-l-4 border-[#ff5625] bg-[#ff5625]/[0.06] font-semibold'
            : 'text-[#9ca3af] border-l-4 border-transparent hover:bg-[#1a1f26]'
        }`}
      >
        <span className={`material-symbols-outlined text-[22px] ${active ? 'fill text-[#ff5625]' : 'group-hover:text-[#ff5625]'}`}>{it.icon}</span>
        <span className="flex-1 text-[15px]">{it.label}</span>
        {it.href === '/portal/inbox' && unread > 0 && (
          <span className="mr-4 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff5625] px-1.5 font-mono text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    );
  };

  const Sidebar = (
    <div className="flex h-full flex-col bg-[#06080a] py-6">
      <Link href="/portal" className="mb-8 block px-6">
        <h1 className="font-headline text-[22px] font-bold leading-tight text-[#ff5625]">Đại Long Medical</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#9ca3af]/70">Affiliate Portal</p>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto portal-scroll">
        {items.map(navLink)}
        {navLink({ href: '/portal/inbox', label: 'Thông báo', icon: 'notifications' })}
        {navLink({ href: '/portal/profile', label: 'Tài khoản', icon: 'settings' })}
      </nav>
      <div
        className="mt-auto space-y-1 px-4 pt-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        {variant === 'dealer' && (
          <Link href="/portal/dealer/orders/new" className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5625] py-3 font-bold text-white transition-transform active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">add_circle</span> Đơn mới
          </Link>
        )}
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-6 py-3 text-[#f87171]/80 transition-colors hover:bg-[#f87171]/10">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="text-[14px]">Thoát tài khoản</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[280px] border-r border-[#1f2937]/40 lg:block">{Sidebar}</aside>

      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-[100dvh] w-[280px] border-r border-[#1f2937]/40 transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>{Sidebar}</aside>

      {/* Topbar */}
      <header className="fixed top-0 right-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#1f2937]/40 bg-[#0a0c0f] px-4 lg:left-[280px] lg:w-[calc(100%-280px)] lg:px-8">
        <button
          onClick={() => setOpen(true)}
          aria-label="Mở menu điều hướng"
          className="inline-flex items-center gap-2 rounded-xl border border-[#ff5625]/40 bg-[#ff5625]/10 px-3 py-2 text-sm font-semibold text-[#ff5625] transition-colors hover:border-[#ff5625] hover:bg-[#ff5625] hover:text-white active:scale-[0.98] lg:hidden"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
          <span className="text-xs">Menu</span>
        </button>
        <div className="hidden flex-1 lg:block" />
        <div className="flex items-center gap-4">
          <Link href="/portal/profile" className="group flex items-center gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <p className="text-[13px] font-bold leading-tight text-[#e7eaf0]">{profile?.full_name ?? 'Tài khoản'}</p>
              <p className="text-[11px] text-[#9ca3af]/70">{roleLabel}</p>
              {profile?.id && <AccountIdBadge accountNo={profile.account_no} id={profile.id} />}
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#ff5625]/20 bg-[#1a1f26] text-xs font-bold text-[#ff5625] group-hover:border-[#ff5625]">{initials}</span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="portal-scroll min-h-screen px-4 pb-12 pt-24 lg:ml-[280px] lg:px-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
