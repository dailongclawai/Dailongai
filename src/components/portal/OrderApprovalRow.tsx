'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { approveOrder, rejectOrder } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import type { Order } from '@/lib/portal-types';

const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

export function OrderApprovalRow({ order, adminId, onResolved }: { order: Order; adminId: string; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);

  const viewReceipt = async () => {
    if (!order.receipt_image_url) return;
    const { data } = await getSupabaseClient().storage.from('receipts').createSignedUrl(order.receipt_image_url, 60);
    if (data?.signedUrl) { window.open(data.signedUrl, '_blank'); }
  };

  const approve = async () => {
    setBusy(true);
    try { await approveOrder(order.id, adminId); toast.success('Đã duyệt'); onResolved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Lỗi'); setBusy(false); }
  };
  const reject = async () => {
    const reason = window.prompt('Lý do từ chối?');
    if (!reason) return;
    setBusy(true);
    try { await rejectOrder(order.id, reason); toast.success('Đã từ chối'); onResolved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Lỗi'); setBusy(false); }
  };

  return (
    <tr className="border-t border-[#0e1525]/10 hover:bg-[#f5f1e8]/50">
      <td className="px-4 py-3" style={numeric}>{order.serial_number}</td>
      <td className="px-4 py-3">{order.customer_name}<div className="text-[11px] text-[#0e1525]/60" style={numeric}>{order.customer_phone}</div></td>
      <td className="px-4 py-3 text-right" style={numeric}>{new Intl.NumberFormat('vi-VN').format(order.sale_price)}</td>
      <td className="px-4 py-3" style={numeric}>{order.sale_date}</td>
      <td className="px-4 py-3">
        {order.receipt_image_url
          ? <button onClick={viewReceipt} className="text-xs text-[#bc7e3b] hover:underline">Xem ảnh</button>
          : <span className="text-xs text-[#0e1525]/40">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={approve} disabled={busy} className="rounded-full bg-[#0e1525] px-3 py-1.5 text-xs font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50">Duyệt</button>
          <button onClick={reject} disabled={busy} className="rounded-full border border-[#0e1525]/30 px-3 py-1.5 text-xs font-medium hover:bg-[#0e1525]/5 disabled:opacity-50">Từ chối</button>
        </div>
      </td>
    </tr>
  );
}
