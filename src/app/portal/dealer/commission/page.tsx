'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { DealerNav } from '@/components/portal/DealerNav';
import { getDealerLedger } from '@/lib/portal-queries';
import type { LedgerRow } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

function statusOf(r: LedgerRow): { label: string; cls: string } {
  if (r.status === 'rejected') return { label: 'Từ chối', cls: 'bg-[#f87171]/15 text-[#f87171]' };
  if (r.status === 'voided' || r.commission?.voided_at) return { label: 'Đã hủy', cls: 'bg-[#372621] text-[#fadcd5]/50' };
  if (r.commission?.paid_at) return { label: 'Đã thanh toán', cls: 'bg-[#34d399]/15 text-[#34d399]' };
  if (r.commission) return { label: 'Đã duyệt · chờ chi', cls: 'bg-[#ff5626]/15 text-[#ffb5a1]' };
  if (r.status === 'pending') return { label: 'Chờ duyệt', cls: 'bg-[#ffc033]/15 text-[#ffc033]' };
  return { label: r.status, cls: 'bg-[#372621] text-[#fadcd5]/60' };
}

export default function DealerCommissionPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role && profile.role !== 'dealer') { router.replace('/portal'); return; }
    if (profile) getDealerLedger(profile.id).then(setRows);
  }, [loading, session, profile, router]);

  if (loading || !session || !profile) return null;

  const amt = (r: LedgerRow) => (r.commission && !r.commission.voided_at ? Number(r.commission.amount) : 0);
  const totalAccrued = rows.reduce((s, r) => s + amt(r), 0);
  const pendingPay = rows.reduce((s, r) => s + (r.commission && !r.commission.paid_at && !r.commission.voided_at ? Number(r.commission.amount) : 0), 0);
  const paid = rows.reduce((s, r) => s + (r.commission?.paid_at ? Number(r.commission.amount) : 0), 0);

  return (
    <PortalShell variant="dealer" nav={<DealerNav />}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Minh bạch hoa hồng</p>
        <h1 className="mt-2 font-headline text-4xl">Hoa hồng &amp; chi trả</h1>
        <p className="mt-2 text-sm text-[#fadcd5]/60">Chi tiết từng đơn: hoa hồng phát sinh, trạng thái duyệt và lịch thanh toán.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Tổng hoa hồng phát sinh', value: totalAccrued, tone: 'text-[#fadcd5]' },
          { label: 'Đã duyệt · chờ chi', value: pendingPay, tone: 'text-[#ffb5a1]' },
          { label: 'Đã thanh toán', value: paid, tone: 'text-[#34d399]' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#5b4039]/40 bg-[#2c1c17] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#fadcd5]/50">{k.label}</p>
            <p className={`mt-2 font-mono text-2xl font-medium tabular-nums ${k.tone}`}>{fmtVnd(k.value)} đ</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-[#5b4039]/40 bg-[#2c1c17]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#5b4039]/40 bg-[#372621]/40 text-[10px] uppercase tracking-wider text-[#fadcd5]/60">
            <tr>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3 text-right">Giá bán</th>
              <th className="px-4 py-3 text-right">Hoa hồng</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3">Thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[#fadcd5]/50">Chưa có đơn nào. Ghi nhận đơn để bắt đầu tích hoa hồng.</td></tr>
            ) : rows.map((r) => {
              const st = statusOf(r);
              return (
                <tr key={r.id} className="border-t border-[#5b4039]/40 hover:bg-[#372621]/40">
                  <td className="px-4 py-3 font-mono tabular-nums text-xs text-[#fadcd5]/60">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#fadcd5]/80">{r.serial_number}</td>
                  <td className="px-4 py-3">{r.customer_name}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(Number(r.sale_price))}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                    {r.commission && !r.commission.voided_at ? `${fmtVnd(Number(r.commission.amount))} đ` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#fadcd5]/60">
                    {r.commission?.paid_at ? (
                      <span>{new Date(r.commission.paid_at).toLocaleDateString('vi-VN')}{r.commission.payment_proof_url ? ` · ${r.commission.payment_proof_url}` : ''}</span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
