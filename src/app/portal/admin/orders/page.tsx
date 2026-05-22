'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPendingOrders } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderApprovalRow } from '@/components/portal/OrderApprovalRow';
import type { Order } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

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
          <Link href="/portal/admin" className="text-[#0e1525]/60 hover:text-[#0e1525]">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Đơn hàng</Link>
          <Link href="/portal/admin/registrations" className="text-[#0e1525]/60 hover:text-[#0e1525]">Đăng ký</Link>
        </>
      }
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Queue cần duyệt</p>
        <h1 style={display} className="mt-2 text-4xl font-light italic">Đơn chờ duyệt</h1>
      </div>
      {fetching ? (
        <p className="text-[#0e1525]/60">Đang tải…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#0e1525]/15 p-12 text-center text-sm text-[#0e1525]/60">Không có đơn chờ duyệt.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
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
