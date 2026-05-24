'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { toast } from 'sonner';
import type { Order } from '@/lib/portal-types';

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else {
      getSupabaseClient().from('orders').select('*').order('sale_date', { ascending: false })
        .then(({ data }) => setOrders((data as Order[]) ?? []));
    }
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'admin') return null;

  const exportExcel = () => {
    if (orders.length === 0) { toast.error(t('portal.admin.reports.toast.empty')); return; }
    const rows = orders.map((o) => ({
      [t('portal.admin.reports.column.serial')]: o.serial_number,
      [t('portal.admin.reports.column.customer')]: o.customer_name,
      [t('portal.admin.reports.column.phone')]: o.customer_phone,
      [t('portal.admin.reports.column.sale_price')]: o.sale_price,
      [t('portal.admin.reports.column.sale_date')]: o.sale_date,
      [t('portal.admin.reports.column.status')]: o.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('portal.admin.reports.sheet_name'));
    XLSX.writeFile(wb, `dailong-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(t('portal.admin.reports.toast.exported'));
  };

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.reports.eyebrow')}</p>
          <h1 className="mt-2 font-headline text-4xl">{t('portal.admin.reports.title')}</h1>
        </div>
        <button onClick={exportExcel} className="rounded-full bg-[#ff5625] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#ff5625]/90">
          {t('portal.admin.reports.action.export')} ({orders.length} {t('portal.admin.reports.unit.orders')})
        </button>
      </div>
      <p className="text-sm text-[#e7eaf0]/60">{t('portal.admin.reports.summary.prefix')} <span className="font-semibold">{orders.length}</span> {t('portal.admin.reports.summary.suffix')}</p>
    </PortalShell>
  );
}
