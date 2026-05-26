'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export function AdminNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: '/portal/admin', label: t('portal.shell.nav.dashboard'), exact: true },
    { href: '/portal/admin/orders', label: t('portal.shell.nav.orders') },
    { href: '/portal/admin/payouts', label: t('portal.shell.nav.payout_requests') },
    { href: '/portal/admin/products', label: t('portal.shell.nav.products') },
    { href: '/portal/admin/supervisors', label: t('portal.shell.nav.supervisors') },
    { href: '/portal/admin/upgrade', label: t('portal.shell.nav.upgrade') },
    { href: '/portal/admin/reports', label: t('portal.shell.nav.reports') },
    { href: '/portal/admin/audit', label: t('portal.shell.nav.audit') },
  ];
  return (
    <>
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              active
                ? 'border-b-2 border-[#ff5625] pb-1 font-semibold'
                : 'text-[#e7eaf0]/60 transition-colors hover:text-[#ff5625]'
            }
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
