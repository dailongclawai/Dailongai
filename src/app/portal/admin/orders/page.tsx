'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPendingOrders } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderApprovalRow } from '@/components/portal/OrderApprovalRow';
import type { Order } from '@/lib/portal-types';

export default function AdminOrdersPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    setFetching(true);
    setOrders(await getPendingOrders());
    setFetching(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell
      variant="admin"
      nav={
        <>
          <Link href="/portal/admin" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="border-b-2 border-[#ff5625] pb-1 font-semibold">Đơn hàng</Link>
          <Link href="/portal/admin/payouts" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Hoa hồng</Link>
          <Link href="/portal/admin/upgrade" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Nâng cấp</Link>
          <Link href="/portal/admin/reports" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Báo cáo</Link>
        </>
      }
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Queue cần duyệt</p>
        <h1 className="mt-2 font-headline text-4xl">Đơn chờ duyệt</h1>
      </div>
      {fetching ? (
        <p className="text-[#e2e2e5]/60">Đang tải…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/15 p-12 text-center text-sm text-[#e2e2e5]/60">Không có đơn chờ duyệt.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/12 bg-white/5 text-[10px] uppercase tracking-wider text-[#e2e2e5]/60">
              <tr>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Khách</th>
                <th className="px-4 py-3 text-right">Giá</th>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Biên nhận</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderApprovalRow key={o.id} order={o} adminId={session!.user.id} onResolved={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}
