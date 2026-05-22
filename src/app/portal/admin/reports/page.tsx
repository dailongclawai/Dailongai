'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { toast } from 'sonner';
import type { Order } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function ReportsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else {
      getSupabaseClient().from('orders').select('*').order('sale_date', { ascending: false })
        .then(({ data }) => setOrders((data as Order[]) ?? []));
    }
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'admin') return null;

  const exportExcel = () => {
    if (orders.length === 0) { toast.error('Không có đơn để xuất'); return; }
    const rows = orders.map((o) => ({
      Serial: o.serial_number,
      'Khách hàng': o.customer_name,
      SĐT: o.customer_phone,
      'Giá bán': o.sale_price,
      'Ngày bán': o.sale_date,
      'Trạng thái': o.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn hàng');
    XLSX.writeFile(wb, `dailong-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Đã xuất Excel');
  };

  return (
    <PortalShell
      variant="admin"
      nav={
        <>
          <Link href="/portal/admin" className="text-[#0e1525]/60 hover:text-[#0e1525]">Tổng quan</Link>
          <Link href="/portal/admin/reports" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Báo cáo</Link>
        </>
      }
    >
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Báo cáo</p>
          <h1 style={display} className="mt-2 text-4xl font-light italic">Toàn bộ đơn hàng</h1>
        </div>
        <button onClick={exportExcel} className="rounded-full bg-[#0e1525] px-5 py-2.5 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b]">
          ↓ Xuất Excel ({orders.length} đơn)
        </button>
      </div>
      <p className="text-sm text-[#0e1525]/60">Tổng <span className="font-semibold">{orders.length}</span> đơn trong hệ thống. Bấm &quot;Xuất Excel&quot; để tải file .xlsx.</p>
    </PortalShell>
  );
}
