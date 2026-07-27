'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

const ITEMS = [
  { href: '/portal/crm/accounts', key: 'portal.crm.nav.accounts', icon: 'contacts' },
  { href: '/portal/crm/pipeline', key: 'portal.crm.nav.pipeline', icon: 'view_kanban' },
  { href: '/portal/crm/activities', key: 'portal.crm.nav.activities', icon: 'task_alt' },
];

export function CrmNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {ITEMS.map(it => {
        const active = pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
              active
                ? 'border-[#ff5625] bg-[#ff5625]/10 text-[#ff5625]'
                : 'border-[#3d3f41] text-[#a0a0a8] hover:text-[#e2e2e5]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{it.icon}</span>
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
