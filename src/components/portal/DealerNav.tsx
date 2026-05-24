'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export function DealerNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: '/portal/dashboard', label: t('portal.shell.nav.dashboard'), exact: true },
    { href: '/portal/dealer/commission', label: t('portal.shell.nav.commission') },
  ];
  return (
    <>
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={active ? 'border-b-2 border-[#ff5625] pb-1 font-semibold' : 'text-[#e7eaf0]/60 transition-colors hover:text-[#ff5625]'}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
