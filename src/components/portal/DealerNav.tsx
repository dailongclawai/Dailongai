'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/portal/dashboard', label: 'Tổng quan', exact: true },
  { href: '/portal/dealer/commission', label: 'Hoa hồng' },
  { href: '/portal/documents', label: 'Tài liệu' },
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
            className={active ? 'border-b-2 border-[#ffb5a1] pb-1 font-semibold' : 'text-[#fadcd5]/60 transition-colors hover:text-[#ffb5a1]'}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
