'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { approveOrder, rejectOrder } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import type { Order } from '@/lib/portal-types';

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
    <tr className="border-t border-[#5b4039]/40 hover:bg-[#372621]/40">
      <td className="px-4 py-3 font-mono tabular-nums">{order.serial_number}</td>
      <td className="px-4 py-3">{order.customer_name}<div className="font-mono text-[11px] tabular-nums text-[#fadcd5]/60">{order.customer_phone}</div></td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{new Intl.NumberFormat('vi-VN').format(order.sale_price)}</td>
      <td className="px-4 py-3 font-mono tabular-nums">{order.sale_date}</td>
      <td className="px-4 py-3">
        {order.receipt_image_url
          ? <button onClick={viewReceipt} className="text-xs text-[#ffb5a1] hover:underline">Xem ảnh</button>
          : <span className="text-xs text-[#fadcd5]/40">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={approve} disabled={busy} className="rounded-full bg-[#ff5626] px-3 py-1.5 text-xs font-medium text-white glow-primary-hover hover:bg-[#ff5626]/90 disabled:opacity-50">Duyệt</button>
          <button onClick={reject} disabled={busy} className="rounded-full border border-[#f87171]/40 px-3 py-1.5 text-xs font-medium text-[#f87171] hover:border-[#f87171] hover:bg-[#f87171]/10 disabled:opacity-50">Từ chối</button>
        </div>
      </td>
    </tr>
  );
}
