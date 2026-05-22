'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { toast } from 'sonner';
import type { Order } from '@/lib/portal-types';

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
      nav={<AdminNav />}
    >
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Báo cáo</p>
          <h1 className="mt-2 font-headline text-4xl">Toàn bộ đơn hàng</h1>
        </div>
        <button onClick={exportExcel} className="rounded-full bg-[#ff5625] px-5 py-2.5 text-sm font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff8a5c]">
          ↓ Xuất Excel ({orders.length} đơn)
        </button>
      </div>
      <p className="text-sm text-[#e2e2e5]/60">Tổng <span className="font-semibold">{orders.length}</span> đơn trong hệ thống. Bấm &quot;Xuất Excel&quot; để tải file .xlsx.</p>
    </PortalShell>
  );
}
