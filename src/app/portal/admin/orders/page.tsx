'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getRecentOrdersAll } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderKanban } from '@/components/portal/OrderKanban';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';
import type { Order, Profile } from '@/lib/portal-types';

export default function AdminOrdersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealerNames, setDealerNames] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
      const rows = await getRecentOrdersAll(200);
      setOrders(rows);
      const ids = Array.from(new Set(rows.map((o) => o.dealer_id))).filter(Boolean);
      if (ids.length > 0) {
        const { data } = await getSupabaseClient()
          .from('profiles')
          .select('id, full_name')
          .in('id', ids);
        const map: Record<string, string> = {};
        for (const p of (data as Pick<Profile, 'id' | 'full_name'>[] ?? [])) {
          if (p.full_name) map[p.id] = p.full_name;
        }
        setDealerNames(map);
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  const counts = useMemo(() => {
    // Payment-first: 'approved' is transient (Casso webhook bumps pending→approved→paid in ~1s),
    // so we bucket it with awaiting just in case the second update stalls.
    let awaiting = 0, paid = 0, closed = 0;
    for (const o of orders) {
      if (o.status === 'pending' || o.status === 'approved') awaiting++;
      else if (o.status === 'paid') paid++;
      else closed++;
    }
    return { awaiting, paid, closed };
  }, [orders]);

  if (loading || profile?.role !== 'admin') {
    return (
      <PortalShell variant="admin">
        <PortalSkeleton.Cards count={4} />
      </PortalShell>
    );
  }


  // Port từ trang Báo cáo admin cũ (đã gỡ 02/08/2026) — xuất lịch sử đơn hàng.
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
    <PortalShell variant="admin">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff8a50]">{t('portal.admin.orders.eyebrow')}</p>
          <h1 className="mt-2 font-headline text-3xl md:text-4xl">{t('portal.admin.orders.title')}</h1>
          <p className="mt-1 text-sm text-[#b3aca8]">
            <span className="text-[#f59e0b]">{counts.awaiting} {t('portal.admin.orders.count.awaiting')}</span>
            {' · '}
            <span className="text-[#ff5625]">{counts.paid} {t('portal.admin.orders.count.paid')}</span>
            {' · '}
            <span className="text-[#b3aca8]">{counts.closed} {t('portal.admin.orders.count.closed')}</span>
          </p>
        </div>
        <button
            onClick={exportExcel}
            className="mr-2 inline-flex items-center gap-2 rounded-xl border border-[#49443f]/60 px-4 py-2 text-sm text-[#e2e2e6] hover:border-[#ffb77d]"
          >
            <span className="material-symbols-outlined text-[18px] text-[#ffb77d]">download</span>
            {t('portal.admin.reports.export')}
          </button>
          <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-[#49443f] bg-[#1a1c1f] px-4 py-2 text-sm hover:bg-[#1e2023]"
        >
          {t('portal.admin.orders.refresh')}
        </button>
      </div>

      {fetching ? (
        <PortalSkeleton.Cards count={4} />
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#49443f] p-12 text-center text-sm text-[#b3aca8]">
          {t('portal.admin.orders.empty')}
        </div>
      ) : (
        <OrderKanban
          orders={orders}
          adminId={session!.user.id}
          dealerNames={dealerNames}
          onResolved={() => void refresh()}
        />
      )}
    </PortalShell>
  );
}
