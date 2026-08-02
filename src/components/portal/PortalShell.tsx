'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/portal-queries';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '../LanguageSwitcher';
import { AccountIdBadge } from './AccountIdBadge';

type Variant = 'dealer' | 'supervisor' | 'admin' | 'staff';
interface NavItem { href: string; label: string; icon: string; exact?: boolean }

export function PortalShell({
  children,
  variant = 'dealer',
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (session) getUnreadCount().then(setUnread);
  }, [session]);

  // Sidebar đóng ngay tại chỗ bấm link (xem NavLink bên dưới) thay vì theo dõi
  // pathname trong effect.

  const NAV: Record<Variant, NavItem[]> = {
    admin: [
      { href: '/portal/admin', label: t('portal.shell.nav.dashboard'), icon: 'dashboard', exact: true },
      { href: '/portal/admin/orders', label: t('portal.shell.nav.orders'), icon: 'shopping_cart' },
      { href: '/portal/crm', label: t('portal.shell.nav.crm'), icon: 'contacts' },
      { href: '/portal/admin/products', label: t('portal.shell.nav.products'), icon: 'medical_services' },
      { href: '/portal/admin/upgrade', label: t('portal.shell.nav.upgrade'), icon: 'upgrade' },
      { href: '/portal/admin/audit', label: t('portal.shell.nav.audit'), icon: 'history' },
    ],
    dealer: [
      { href: '/portal/dashboard', label: t('portal.shell.nav.dashboard'), icon: 'dashboard', exact: true },
      { href: '/portal/dealer/commission', label: t('portal.shell.nav.commission'), icon: 'payments' },
      { href: '/portal/dealer/qr', label: t('portal.shell.nav.qr_orders'), icon: 'qr_code_2' },
      { href: '/portal/payout-info', label: t('portal.shell.nav.payout_info'), icon: 'account_balance' },
    ],
    supervisor: [
      { href: '/portal/supervisor', label: t('portal.shell.nav.team'), icon: 'groups', exact: true },
      { href: '/portal/supervisor/commission', label: t('portal.shell.nav.commission_stats'), icon: 'payments' },
      { href: '/portal/payout-info', label: t('portal.shell.nav.payout_info'), icon: 'account_balance' },
    ],
    staff: [
      { href: '/portal/crm', label: t('portal.crm.nav.dashboard'), icon: 'dashboard', exact: true },
      { href: '/portal/crm/accounts', label: t('portal.crm.nav.accounts'), icon: 'contacts' },
      { href: '/portal/crm/pipeline', label: t('portal.crm.nav.pipeline'), icon: 'view_kanban' },
      { href: '/portal/crm/activities', label: t('portal.crm.nav.activities'), icon: 'task_alt' },
      { href: '/portal/crm/commission', label: t('portal.crm.nav.commission'), icon: 'payments' },
    ],
  };
  const items = NAV[variant];
  const initials = (() => {
    const tokens = (profile?.full_name ?? profile?.email ?? 'DL')
      .split(/\s+/)
      .filter((s) => s && !/^\d+$/.test(s));
    if (!tokens.length) return 'DL';
    if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
    return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
  })();
  const roleLabel = variant === 'admin' ? t('portal.shell.role.admin')
    : variant === 'supervisor' ? t('portal.shell.role.supervisor')
    : variant === 'staff' ? t('portal.shell.role.staff')
    : t('portal.shell.role.dealer');

  const handleSignOut = async () => { await signOut(); router.replace('/portal/login'); };

  const isActive = (it: NavItem) => (it.exact ? pathname === it.href : pathname.startsWith(it.href));
  const navLink = (it: NavItem) => {
    const active = isActive(it);
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={() => setOpen(false)}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 group ${
          active
            ? 'bg-[#065f46]/20 font-semibold text-[#8bd6b6]'
            : 'text-[#a8b3ac] hover:bg-white/5 hover:text-[#e2e2e6]'
        }`}
      >
        {active && (
          <span aria-hidden className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r bg-[#8bd6b6] shadow-[0_0_8px_#8bd6b6]" />
        )}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-[#065f46]/30' : ''}`}>
          <span className={`material-symbols-outlined text-[20px] ${active ? 'fill' : 'group-hover:text-[#8bd6b6]'}`}>{it.icon}</span>
        </span>
        <span className="flex-1 text-[14px]">{it.label}</span>
        {it.href === '/portal/inbox' && unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d97706] px-1.5 font-mono text-[10px] font-bold text-[#2f1500]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    );
  };

  const Sidebar = (
    <div className="relative flex h-full flex-col bg-[#1a1c1f] shadow-[20px_0_50px_rgba(0,0,0,0.5)]">
      {/* Lưới chấm mờ toàn sidebar — cùng chất liệu phòng điều hành với AdminConsole */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <Link href="/portal" className="relative block px-6 pb-5 pt-7">
        <span className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-orange.webp"
            alt={t('portal.shell.brand')}
            className="h-10 w-10 shrink-0 rounded-xl border border-[#8bd6b6]/20 bg-[#065f46]/20 object-contain p-0.5 shadow-[0_0_12px_rgba(139,214,182,0.3)]"
          />
          <span className="flex flex-col">
            <span className="font-headline text-[20px] font-bold leading-tight text-[#8bd6b6]">{t('portal.shell.brand_name')}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#a8b3ac]/70">{t('portal.shell.brand_tag')}</span>
          </span>
        </span>
        <span aria-hidden className="mt-4 block h-px w-full bg-gradient-to-r from-[#8bd6b6]/40 via-[#8bd6b6]/10 to-transparent" />
      </Link>
      <nav className="portal-scroll relative flex-1 space-y-6 overflow-y-auto px-3 py-1">
        <div>
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.25em] text-[#a8b3ac]/50">{t('portal.shell.section.main')}</p>
          <div className="space-y-1">{items.map(navLink)}</div>
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.25em] text-[#a8b3ac]/50">{t('portal.shell.section.system')}</p>
          <div className="space-y-1">
            {navLink({ href: '/portal/inbox', label: t('portal.shell.nav.inbox'), icon: 'notifications' })}
            {navLink({ href: '/portal/profile', label: t('portal.shell.nav.profile'), icon: 'settings' })}
          </div>
        </div>
      </nav>
      <div
        className="relative mt-auto space-y-2 border-t border-white/5 p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        {variant === 'dealer' && (
          <Link href="/portal/dealer/orders/new" className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#065f46] py-3 font-bold text-white transition-transform active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">add_circle</span> {t('portal.shell.cta.new_order')}
          </Link>
        )}
        <Link
          href="/portal/profile"
          onClick={() => setOpen(false)}
          className="group flex items-center gap-3 rounded-xl border border-white/5 bg-[#282a2d]/40 p-3 transition-colors hover:bg-[#282a2d]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#8bd6b6]/20 bg-[#1e2023] text-xs font-bold text-[#8bd6b6]">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold text-[#e2e2e6]">{profile?.full_name ?? t('portal.shell.nav.profile')}</span>
            <span className="truncate text-[9px] uppercase tracking-[0.15em] text-[#a8b3ac]/70">{roleLabel}</span>
          </span>
          <span className="material-symbols-outlined ml-auto text-[18px] text-[#a8b3ac] transition-colors group-hover:text-[#8bd6b6]">unfold_more</span>
        </Link>
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[#f87171]/80 transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171]">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="text-[14px]">{t('portal.shell.signout')}</span>
        </button>
      </div>
    </div>
  );

  // Chỉ khu CRM đổi sang tông nâu-đồng, các trang portal khác giữ tông xám.
  return (
    <div className={`min-h-screen ${pathname.startsWith('/portal/crm') ? 'crm-scope' : ''}`}>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[280px] border-r border-white/5 lg:block">{Sidebar}</aside>

      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-[100dvh] w-[280px] border-r border-white/5 transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>{Sidebar}</aside>

      {/* Topbar */}
      <header className="fixed top-0 right-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#3f4944]/40 bg-[#0c0e11] px-4 lg:left-[280px] lg:w-[calc(100%-280px)] lg:px-8">
        <button
          onClick={() => setOpen(true)}
          aria-label={t('portal.shell.menu.aria')}
          className="inline-flex items-center gap-2 rounded-xl border border-[#8bd6b6]/40 bg-[#8bd6b6]/10 px-3 py-2 text-sm font-semibold text-[#8bd6b6] transition-colors hover:border-[#8bd6b6] hover:bg-[#065f46] hover:text-white active:scale-[0.98] lg:hidden"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
          <span className="text-xs">{t('portal.shell.menu.label')}</span>
        </button>
        <div className="hidden flex-1 lg:block" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <span aria-hidden className="hidden h-6 w-px bg-[#3f4944] sm:block" />
          <Link href="/portal/profile" className="group flex items-center gap-2.5">
            {/* Profile chip: name + role · ID — hidden on mobile to save header space */}
            <div className="hidden flex-col items-end gap-1 rounded-xl border border-[#3f4944]/60 bg-[#16181b]/60 px-3 py-1.5 transition-colors group-hover:border-[#8bd6b6]/40 sm:flex">
              <p className="text-[13px] font-semibold leading-none text-[#e2e2e6]">{profile?.full_name ?? t('portal.shell.nav.profile')}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#a8b3ac]/70">{roleLabel}</span>
                {profile?.id && (
                  <>
                    <span aria-hidden className="text-[10px] leading-none text-[#a8b3ac]/40">·</span>
                    <AccountIdBadge accountNo={profile.account_no} id={profile.id} />
                  </>
                )}
              </div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#8bd6b6]/30 bg-[#1e2023] text-xs font-bold text-[#8bd6b6] transition-colors group-hover:border-[#8bd6b6]">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
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
