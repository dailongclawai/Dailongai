'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getRecentOrdersAll } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
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
      <PortalShell variant="admin" nav={<AdminNav />}>
        <PortalSkeleton.Cards count={4} />
      </PortalShell>
    );
  }

  return (
    <PortalShell variant="admin" nav={<AdminNav />}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.orders.eyebrow')}</p>
          <h1 className="mt-2 font-headline text-3xl md:text-4xl">{t('portal.admin.orders.title')}</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            <span className="text-[#f59e0b]">{counts.awaiting} {t('portal.admin.orders.count.awaiting')}</span>
            {' · '}
            <span className="text-[#10b981]">{counts.paid} {t('portal.admin.orders.count.paid')}</span>
            {' · '}
            <span className="text-[#9ca3af]">{counts.closed} {t('portal.admin.orders.count.closed')}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-[#1f2937] bg-[#11151a] px-4 py-2 text-sm hover:bg-[#1a1f26]"
        >
          {t('portal.admin.orders.refresh')}
        </button>
      </div>

      {fetching ? (
        <PortalSkeleton.Cards count={4} />
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1f2937] p-12 text-center text-sm text-[#9ca3af]">
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
