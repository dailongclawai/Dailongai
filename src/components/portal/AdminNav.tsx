'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/portal/admin', label: 'Tổng quan', exact: true },
  { href: '/portal/admin/orders', label: 'Đơn hàng' },
  { href: '/portal/admin/payouts', label: 'Hoa hồng' },
  { href: '/portal/admin/products', label: 'Sản phẩm' },
  { href: '/portal/admin/supervisors', label: 'Supervisor' },
  { href: '/portal/admin/upgrade', label: 'Nâng cấp' },
  { href: '/portal/admin/reports', label: 'Báo cáo' },
  { href: '/portal/admin/audit', label: 'Nhật ký' },
];

export function AdminNav() {
  const pathname = usePathname();
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
