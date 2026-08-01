'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';

const ITEMS = [
  { href: '/portal/crm', key: 'portal.crm.nav.dashboard', icon: 'dashboard', adminOnly: false, exact: true },
  { href: '/portal/crm/accounts', key: 'portal.crm.nav.accounts', icon: 'contacts', adminOnly: false },
  { href: '/portal/crm/pipeline', key: 'portal.crm.nav.pipeline', icon: 'view_kanban', adminOnly: false },
  { href: '/portal/crm/activities', key: 'portal.crm.nav.activities', icon: 'task_alt', adminOnly: false },
  { href: '/portal/crm/commission', key: 'portal.crm.nav.commission', icon: 'payments', adminOnly: false },
  { href: '/portal/crm/kpi', key: 'portal.crm.nav.kpi', icon: 'military_tech', adminOnly: false },
  { href: '/portal/crm/feedback', key: 'portal.crm.nav.feedback', icon: 'rate_review', adminOnly: false },
  // Boss chốt 28/07/2026: báo cáo tổng hợp chỉ admin xem được
  { href: '/portal/crm/reports', key: 'portal.crm.nav.reports', icon: 'bar_chart', adminOnly: true },
];

export function CrmNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { profile } = useAuth();
  const items = ITEMS.filter(it => !it.adminOnly || profile?.role === 'admin');
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {items.map(it => {
        const active = 'exact' in it && it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
              active
                ? 'border-[#ff5625] bg-[#ff5625]/10 text-[#ff5625]'
                : 'border-[var(--crm-line)] text-[var(--crm-muted)] hover:text-[var(--crm-text)]'
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
