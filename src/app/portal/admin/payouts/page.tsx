'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { getAdminPayoutQueue, adminProcessPayout } from '@/lib/portal-queries';
import type { AdminPayoutRow } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

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
          <Link href="/portal/admin" className="text-[#0e1525]/60 hover:text-[#0e1525]">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="text-[#0e1525]/60 hover:text-[#0e1525]">Đơn hàng</Link>
          <Link href="/portal/admin/payouts" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Hoa hồng</Link>
          <Link href="/portal/admin/upgrade" className="text-[#0e1525]/60 hover:text-[#0e1525]">Nâng cấp</Link>
          <Link href="/portal/admin/reports" className="text-[#0e1525]/60 hover:text-[#0e1525]">Báo cáo</Link>
        </>
      }
    >
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">
          {pending.length} khoản chờ chi trả · Tổng {fmtVnd(pendingTotal)}
        </p>
        <h1 style={display} className="mt-2 text-3xl font-light italic">Quản lý hoa hồng</h1>
      </div>

      {/* Pending payouts */}
      {pending.length === 0 ? (
        <div className="mb-10 rounded-2xl border-2 border-dashed border-[#0e1525]/15 p-10 text-center text-sm text-[#0e1525]/40">
          Không có khoản hoa hồng nào chờ chi trả
        </div>
      ) : (
        <div className="mb-10 overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
          {pending.map((row, idx) => (
            <div key={row.id}>
              {idx > 0 && <div className="border-t border-[#0e1525]/10" />}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                        row.recipient_role === 'supervisor'
                          ? 'bg-[#5d8d6a]/15 text-[#5d8d6a]'
                          : 'bg-[#bc7e3b]/15 text-[#bc7e3b]'
                      }`}>
                        {row.recipient_role}
                      </span>
                      <p className="text-sm font-semibold text-[#0e1525]">
                        {row.recipient_name ?? row.recipient_email}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#0e1525]/60">
                      <span>SN: <span style={numeric}>{row.serial_number}</span></span>
                      <span>KH: {row.customer_name}</span>
                      <span>Ngày bán: <span style={numeric}>{row.sale_date}</span></span>
                      <span>Doanh số: <span style={numeric}>{fmtVnd(row.sale_price)}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p style={numeric} className="text-2xl font-semibold text-[#0e1525]">
                      {fmtVnd(row.amount)}
                    </p>
                    <p className="text-[10px] text-[#0e1525]/40">hoa hồng</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="text"
                    value={proofRefs[row.id] ?? ''}
                    onChange={(e) => setProofRefs((p) => ({ ...p, [row.id]: e.target.value }))}
                    placeholder="Mã tham chiếu chuyển khoản (tuỳ chọn)"
                    className="min-w-0 flex-1 rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
                  />
                  <button
                    type="button"
                    disabled={processing === row.id}
                    onClick={() => process(row)}
                    className="shrink-0 rounded-full bg-[#5d8d6a] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#4a7357] disabled:opacity-50"
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
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#0e1525]/50">Đã chi trả ({paid.length})</p>
          <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/60">
            {paid.map((row, idx) => (
              <div key={row.id}>
                {idx > 0 && <div className="border-t border-[#0e1525]/10" />}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                      row.recipient_role === 'supervisor'
                        ? 'bg-[#5d8d6a]/15 text-[#5d8d6a]'
                        : 'bg-[#bc7e3b]/15 text-[#bc7e3b]'
                    }`}>
                      {row.recipient_role}
                    </span>
                    <span className="font-medium text-[#0e1525]/80">{row.recipient_name ?? row.recipient_email}</span>
                    <span className="text-xs text-[#0e1525]/40" style={numeric}>{row.serial_number}</span>
                    {row.payment_proof_url && (
                      <span className="text-xs text-[#0e1525]/40">Ref: {row.payment_proof_url}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#5d8d6a]">
                      {row.paid_at ? new Date(row.paid_at).toLocaleDateString('vi-VN') : ''}
                    </span>
                    <span style={numeric} className="font-semibold text-[#0e1525]/70">{fmtVnd(row.amount)}</span>
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
