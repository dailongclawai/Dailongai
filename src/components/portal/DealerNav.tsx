'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/portal/dashboard', label: 'Tổng quan', exact: true },
  { href: '/portal/dealer/commission', label: 'Hoa hồng' },
];

export function DealerNav() {
  const pathname = usePathname();
  return (
    <>
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={active ? 'border-b-2 border-[#ff5625] pb-1 font-semibold' : 'text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]'}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
