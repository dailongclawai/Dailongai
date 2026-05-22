'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/portal-queries';

type Variant = 'dealer' | 'supervisor' | 'admin';
interface NavItem { href: string; label: string; icon: string; exact?: boolean }

const NAV: Record<Variant, NavItem[]> = {
  admin: [
    { href: '/portal/admin', label: 'Tổng quan', icon: 'dashboard', exact: true },
    { href: '/portal/admin/orders', label: 'Đơn hàng', icon: 'shopping_cart' },
    { href: '/portal/admin/payouts', label: 'Hoa hồng', icon: 'payments' },
    { href: '/portal/admin/products', label: 'Sản phẩm', icon: 'medical_services' },
    { href: '/portal/admin/documents', label: 'Tài liệu', icon: 'description' },
    { href: '/portal/admin/supervisors', label: 'Supervisor', icon: 'groups' },
    { href: '/portal/admin/upgrade', label: 'Nâng cấp', icon: 'upgrade' },
    { href: '/portal/admin/reports', label: 'Báo cáo', icon: 'bar_chart' },
    { href: '/portal/admin/audit', label: 'Nhật ký', icon: 'history' },
  ],
  dealer: [
    { href: '/portal/dashboard', label: 'Tổng quan', icon: 'dashboard', exact: true },
    { href: '/portal/dealer/commission', label: 'Hoa hồng', icon: 'payments' },
    { href: '/portal/documents', label: 'Tài liệu', icon: 'description' },
  ],
  supervisor: [
    { href: '/portal/supervisor', label: 'Đội của tôi', icon: 'groups', exact: true },
    { href: '/portal/documents', label: 'Tài liệu', icon: 'description' },
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
            ? 'text-[#ffb5a1] border-l-4 border-[#ffb5a1] bg-[#ffb5a1]/[0.06] font-semibold'
            : 'text-[#e4beb4] border-l-4 border-transparent hover:bg-[#372621]'
        }`}
      >
        <span className={`material-symbols-outlined text-[22px] ${active ? 'fill text-[#ffb5a1]' : 'group-hover:text-[#ffb5a1]'}`}>{it.icon}</span>
        <span className="text-[15px]">{it.label}</span>
      </Link>
    );
  };

  const Sidebar = (
    <div className="flex h-full flex-col bg-[#180b07] py-6">
      <Link href="/portal" className="mb-8 block px-6">
        <h1 className="font-headline text-[22px] font-bold leading-tight text-[#ffb5a1]">Đại Long Medical</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#e4beb4]/70">Affiliate Portal</p>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto portal-scroll">
        {items.map(navLink)}
        {navLink({ href: '/portal/inbox', label: 'Hộp thư', icon: 'mail' })}
      </nav>
      <div className="mt-auto space-y-1 px-4 pt-4">
        {variant === 'dealer' && (
          <Link href="/portal/dealer/orders/new" className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5626] py-3 font-bold text-white transition-transform active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">add_circle</span> Đơn mới
          </Link>
        )}
        <Link href="/portal/profile" className="flex items-center gap-3 rounded-lg px-6 py-3 text-[#e4beb4] transition-colors hover:bg-[#372621]">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-[14px]">Tài khoản</span>
        </Link>
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-6 py-3 text-[#ffb4ab]/80 transition-colors hover:bg-[#ffb4ab]/10">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="text-[14px]">Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[280px] border-r border-[#5b4039]/40 lg:block">{Sidebar}</aside>

      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-screen w-[280px] border-r border-[#5b4039]/40 transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>{Sidebar}</aside>

      {/* Topbar */}
      <header className="fixed top-0 right-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#5b4039]/40 bg-[#1e100c] px-4 lg:left-[280px] lg:w-[calc(100%-280px)] lg:px-8">
        <button onClick={() => setOpen(true)} className="rounded-full p-2 text-[#e4beb4] hover:bg-[#372621] lg:hidden">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="hidden flex-1 lg:block" />
        <div className="flex items-center gap-4">
          <Link href="/portal/inbox" className="relative rounded-full p-2 text-[#e4beb4] transition-colors hover:bg-[#372621] hover:text-[#ffb5a1]">
            <span className="material-symbols-outlined">notifications</span>
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ff5626] ring-2 ring-[#1e100c]" />}
          </Link>
          <div className="h-6 w-px bg-[#5b4039]/40" />
          <Link href="/portal/profile" className="group flex items-center gap-3">
            <div className="text-right">
              <p className="text-[13px] font-bold leading-tight text-[#fadcd5]">{profile?.full_name ?? 'Tài khoản'}</p>
              <p className="text-[11px] text-[#e4beb4]/70">{roleLabel}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#ffb5a1]/20 bg-[#372621] text-xs font-bold text-[#ffb5a1] group-hover:border-[#ffb5a1]">{initials}</span>
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
