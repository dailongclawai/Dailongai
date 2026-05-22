'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { getAdminPayoutQueue, adminProcessPayout } from '@/lib/portal-queries';
import type { AdminPayoutRow } from '@/lib/portal-types';

const fmtVnd = (n: number | string) =>
  new Intl.NumberFormat('vi-VN').format(Number(n)) + ' đ';

export default function PayoutsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const [proofRefs, setProofRefs] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role !== 'admin') { router.replace('/portal/dashboard'); return; }
    getAdminPayoutQueue().then(setRows);
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'admin') return null;

  const pending = rows.filter((r) => !r.paid_at);
  const paid = rows.filter((r) => r.paid_at);
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);

  const process = async (row: AdminPayoutRow) => {
    setProcessing(row.id);
    try {
      await adminProcessPayout(row.id, proofRefs[row.id] ?? '');
      toast.success(`Đã xác nhận chi trả cho ${row.recipient_name ?? row.recipient_email}`);
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id
            ? { ...r, paid_at: new Date().toISOString(), payment_proof_url: proofRefs[row.id] ?? '' }
            : r
        )
      );
      setProofRefs((p) => ({ ...p, [row.id]: '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xử lý chi trả');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <PortalShell
      variant="admin"
      nav={
        <>
          <Link href="/portal/admin" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Đơn hàng</Link>
          <Link href="/portal/admin/payouts" className="border-b-2 border-[#ff5625] pb-1 font-semibold">Hoa hồng</Link>
          <Link href="/portal/admin/upgrade" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Nâng cấp</Link>
          <Link href="/portal/admin/reports" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Báo cáo</Link>
        </>
      }
    >
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
          {pending.length} khoản chờ chi trả · Tổng {fmtVnd(pendingTotal)}
        </p>
        <h1 className="mt-2 font-headline text-3xl">Quản lý hoa hồng</h1>
      </div>

      {/* Pending payouts */}
      {pending.length === 0 ? (
        <div className="mb-10 rounded-2xl border-2 border-dashed border-white/15 p-10 text-center text-sm text-[#e2e2e5]/40">
          Không có khoản hoa hồng nào chờ chi trả
        </div>
      ) : (
        <div className="mb-10 overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
          {pending.map((row, idx) => (
            <div key={row.id}>
              {idx > 0 && <div className="border-t border-white/12" />}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                        row.recipient_role === 'supervisor'
                          ? 'bg-[#34d399]/15 text-[#34d399]'
                          : 'bg-[#ff5625]/15 text-[#ff5625]'
                      }`}>
                        {row.recipient_role}
                      </span>
                      <p className="text-sm font-semibold text-[#e2e2e5]">
                        {row.recipient_name ?? row.recipient_email}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#e2e2e5]/60">
                      <span>SN: <span className="font-mono tabular-nums">{row.serial_number}</span></span>
                      <span>KH: {row.customer_name}</span>
                      <span>Ngày bán: <span className="font-mono tabular-nums">{row.sale_date}</span></span>
                      <span>Doanh số: <span className="font-mono tabular-nums">{fmtVnd(row.sale_price)}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tabular-nums text-2xl font-semibold text-[#e2e2e5]">
                      {fmtVnd(row.amount)}
                    </p>
                    <p className="text-[10px] text-[#e2e2e5]/40">hoa hồng</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="text"
                    value={proofRefs[row.id] ?? ''}
                    onChange={(e) => setProofRefs((p) => ({ ...p, [row.id]: e.target.value }))}
                    placeholder="Mã tham chiếu chuyển khoản (tuỳ chọn)"
                    className="min-w-0 flex-1 rounded-lg border border-white/12 bg-[#1e2022] px-3 py-2 text-sm outline-none focus:border-[#ff5625]"
                  />
                  <button
                    type="button"
                    disabled={processing === row.id}
                    onClick={() => process(row)}
                    className="shrink-0 rounded-full bg-[#34d399] px-5 py-2 text-xs font-medium text-[#121416] transition-colors hover:bg-[#34d399]/80 disabled:opacity-50"
                  >
                    {processing === row.id ? 'Đang xử lý…' : 'Xác nhận đã chi trả'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paid history */}
      {paid.length > 0 && (
        <section>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#e2e2e5]/50">Đã chi trả ({paid.length})</p>
          <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
            {paid.map((row, idx) => (
              <div key={row.id}>
                {idx > 0 && <div className="border-t border-white/12" />}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                      row.recipient_role === 'supervisor'
                        ? 'bg-[#34d399]/15 text-[#34d399]'
                        : 'bg-[#ff5625]/15 text-[#ff5625]'
                    }`}>
                      {row.recipient_role}
                    </span>
                    <span className="font-medium text-[#e2e2e5]/80">{row.recipient_name ?? row.recipient_email}</span>
                    <span className="text-xs text-[#e2e2e5]/40 font-mono tabular-nums">{row.serial_number}</span>
                    {row.payment_proof_url && (
                      <span className="text-xs text-[#e2e2e5]/40">Ref: {row.payment_proof_url}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#34d399]">
                      {row.paid_at ? new Date(row.paid_at).toLocaleDateString('vi-VN') : ''}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#e2e2e5]/70">{fmtVnd(row.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PortalShell>
  );
}
