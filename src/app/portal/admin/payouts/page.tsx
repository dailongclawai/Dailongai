'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { getAdminPayoutQueue, adminProcessPayout, getAdminPayoutRequests, adminProcessPayoutRequest } from '@/lib/portal-queries';
import type { AdminPayoutRow } from '@/lib/portal-types';
import type { PayoutRequestWithRequester, PayoutRequest } from '@/lib/portal-queries';

const fmtVnd = (n: number | string) =>
  new Intl.NumberFormat('vi-VN').format(Number(n)) + ' đ';

export default function PayoutsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const [proofRefs, setProofRefs] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [requests, setRequests] = useState<PayoutRequestWithRequester[]>([]);
  const [reqProcessing, setReqProcessing] = useState<string | null>(null);
  const [reqNotes, setReqNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role !== 'admin') { router.replace('/portal/403'); return; }
    getAdminPayoutQueue().then(setRows);
    getAdminPayoutRequests().then(setRequests);
  }, [loading, session, profile, router]);

  const processRequest = async (id: string, decision: 'approved' | 'rejected' | 'paid') => {
    setReqProcessing(id);
    try {
      const updated = await adminProcessPayoutRequest(id, decision, reqNotes[id]?.trim() || undefined);
      setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...updated } as PayoutRequestWithRequester : r)));
      setReqNotes((n) => ({ ...n, [id]: '' }));
      const verb =
        decision === 'approved'
          ? t('portal.admin.payouts.toast.request.approved')
          : decision === 'rejected'
            ? t('portal.admin.payouts.toast.request.rejected')
            : t('portal.admin.payouts.toast.request.paid');
      toast.success(verb);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('portal.admin.payouts.toast.request.error'));
    } finally {
      setReqProcessing(null);
    }
  };

  const reqStatusCls: Record<PayoutRequest['status'], string> = {
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    approved: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20',
    rejected: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20',
    paid: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  const reqStatusLabel: Record<PayoutRequest['status'], string> = {
    pending: t('portal.admin.payouts.status.pending'),
    approved: t('portal.admin.payouts.status.approved'),
    rejected: t('portal.admin.payouts.status.rejected'),
    paid: t('portal.admin.payouts.status.paid'),
  };

  if (loading || profile?.role !== 'admin') return null;

  const pending = rows.filter((r) => !r.paid_at);
  const paid = rows.filter((r) => r.paid_at);
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);

  const process = async (row: AdminPayoutRow) => {
    setProcessing(row.id);
    try {
      await adminProcessPayout(row.id, proofRefs[row.id] ?? '');
      toast.success(`${t('portal.admin.payouts.toast.paid_prefix')} ${row.recipient_name ?? row.recipient_email}`);
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id
            ? { ...r, paid_at: new Date().toISOString(), payment_proof_url: proofRefs[row.id] ?? '' }
            : r
        )
      );
      setProofRefs((p) => ({ ...p, [row.id]: '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('portal.admin.payouts.toast.paid.error'));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
          {pending.length} {t('portal.admin.payouts.eyebrow.pending')} · {t('portal.admin.payouts.eyebrow.total')} {fmtVnd(pendingTotal)}
        </p>
        <h1 className="mt-2 font-headline text-3xl">{t('portal.admin.payouts.title')}</h1>
      </div>

      {/* Payout requests (dealer / supervisor) */}
      {requests.length > 0 && (
        <section className="mb-10">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
            {t('portal.admin.payouts.requests.heading')} ({requests.filter((r) => r.status === 'pending').length} {t('portal.admin.payouts.requests.pending_suffix')})
          </p>
          <div className="overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
            {requests.map((req, idx) => (
              <div key={req.id}>
                {idx > 0 && <div className="border-t border-[#1f2937]/40" />}
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${reqStatusCls[req.status]}`}>
                          {reqStatusLabel[req.status]}
                        </span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                          req.requester_role === 'supervisor'
                            ? 'bg-[#10b981]/15 text-[#10b981]'
                            : 'bg-[#ff5625]/15 text-[#ff5625]'
                        }`}>
                          {req.requester_role}
                        </span>
                        <p className="text-sm font-semibold text-[#e7eaf0]">
                          {req.requester?.full_name ?? req.requester?.email ?? req.requester_id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="mt-1 text-xs text-[#e7eaf0]/60">
                        {t('portal.admin.payouts.request.submitted')}: <span className="font-mono tabular-nums">{new Date(req.created_at).toLocaleString('vi-VN')}</span>
                        {req.notes && <span className="ml-3">{t('portal.admin.payouts.request.notes')}: <span className="text-[#9ca3af]">{req.notes}</span></span>}
                        {req.processed_at && (
                          <span className="ml-3">{t('portal.admin.payouts.request.processed')}: <span className="font-mono tabular-nums">{new Date(req.processed_at).toLocaleString('vi-VN')}</span>{req.processor_notes ? ` · ${req.processor_notes}` : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono tabular-nums text-2xl font-semibold text-[#e7eaf0]">{fmtVnd(req.amount)}</p>
                      <p className="text-[10px] text-[#e7eaf0]/40">{t('portal.admin.payouts.request.amount_label')}</p>
                    </div>
                  </div>
                  {req.status === 'pending' && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={reqNotes[req.id] ?? ''}
                        onChange={(e) => setReqNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                        placeholder={t('portal.admin.payouts.request.notes_placeholder')}
                        className="min-w-0 flex-1 rounded-lg border border-[#1f2937]/40 bg-[#11151a] px-3 py-2 text-sm outline-none focus:border-[#ff5625]"
                      />
                      <button
                        type="button"
                        disabled={reqProcessing === req.id}
                        onClick={() => processRequest(req.id, 'rejected')}
                        className="rounded-full border border-[#f87171]/40 px-4 py-2 text-xs font-medium text-[#f87171] hover:bg-[#f87171]/10 disabled:opacity-50"
                      >
                        {t('portal.admin.payouts.action.reject')}
                      </button>
                      <button
                        type="button"
                        disabled={reqProcessing === req.id}
                        onClick={() => processRequest(req.id, 'approved')}
                        className="rounded-full bg-[#3b82f6] px-5 py-2 text-xs font-bold text-[#121416] hover:bg-[#3b82f6]/90 disabled:opacity-50"
                      >
                        {reqProcessing === req.id ? t('portal.admin.payouts.action.processing') : t('portal.admin.payouts.action.approve_request')}
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={reqNotes[req.id] ?? ''}
                        onChange={(e) => setReqNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                        placeholder={t('portal.admin.payouts.request.txn_placeholder')}
                        className="min-w-0 flex-1 rounded-lg border border-[#1f2937]/40 bg-[#11151a] px-3 py-2 text-sm outline-none focus:border-[#ff5625]"
                      />
                      <button
                        type="button"
                        disabled={reqProcessing === req.id}
                        onClick={() => processRequest(req.id, 'paid')}
                        className="rounded-full bg-emerald-400 px-5 py-2 text-xs font-bold text-[#121416] hover:bg-emerald-400/90 disabled:opacity-50"
                      >
                        {reqProcessing === req.id ? t('portal.admin.payouts.action.processing') : t('portal.admin.payouts.action.mark_paid')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending payouts */}
      {pending.length === 0 ? (
        <div className="mb-10 rounded-2xl border-2 border-dashed border-[#1f2937]/50 p-10 text-center text-sm text-[#e7eaf0]/40">
          {t('portal.admin.payouts.empty.pending')}
        </div>
      ) : (
        <div className="mb-10 overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
          {pending.map((row, idx) => (
            <div key={row.id}>
              {idx > 0 && <div className="border-t border-[#1f2937]/40" />}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                        row.recipient_role === 'supervisor'
                          ? 'bg-[#10b981]/15 text-[#10b981]'
                          : 'bg-[#ff5625]/15 text-[#ff5625]'
                      }`}>
                        {row.recipient_role}
                      </span>
                      <p className="text-sm font-semibold text-[#e7eaf0]">
                        {row.recipient_name ?? row.recipient_email}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#e7eaf0]/60">
                      <span>{t('portal.admin.payouts.row.serial')}: <span className="font-mono tabular-nums">{row.serial_number}</span></span>
                      <span>{t('portal.admin.payouts.row.customer')}: {row.customer_name}</span>
                      <span>{t('portal.admin.payouts.row.sale_date')}: <span className="font-mono tabular-nums">{row.sale_date}</span></span>
                      <span>{t('portal.admin.payouts.row.sale_amount')}: <span className="font-mono tabular-nums">{fmtVnd(row.sale_price)}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tabular-nums text-2xl font-semibold text-[#e7eaf0]">
                      {fmtVnd(row.amount)}
                    </p>
                    <p className="text-[10px] text-[#e7eaf0]/40">{t('portal.admin.payouts.row.commission_label')}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="text"
                    value={proofRefs[row.id] ?? ''}
                    onChange={(e) => setProofRefs((p) => ({ ...p, [row.id]: e.target.value }))}
                    placeholder={t('portal.admin.payouts.row.proof_placeholder')}
                    className="min-w-0 flex-1 rounded-lg border border-[#1f2937]/40 bg-[#11151a] px-3 py-2 text-sm outline-none focus:border-[#ff5625]"
                  />
                  <button
                    type="button"
                    disabled={processing === row.id}
                    onClick={() => process(row)}
                    className="shrink-0 rounded-full bg-[#10b981] px-5 py-2 text-xs font-medium text-[#121416] transition-colors hover:bg-[#10b981]/80 disabled:opacity-50"
                  >
                    {processing === row.id ? t('portal.admin.payouts.action.processing') : t('portal.admin.payouts.action.confirm_paid')}
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
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#e7eaf0]/50">{t('portal.admin.payouts.history.heading')} ({paid.length})</p>
          <div className="overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
            {paid.map((row, idx) => (
              <div key={row.id}>
                {idx > 0 && <div className="border-t border-[#1f2937]/40" />}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                      row.recipient_role === 'supervisor'
                        ? 'bg-[#10b981]/15 text-[#10b981]'
                        : 'bg-[#ff5625]/15 text-[#ff5625]'
                    }`}>
                      {row.recipient_role}
                    </span>
                    <span className="font-medium text-[#e7eaf0]/80">{row.recipient_name ?? row.recipient_email}</span>
                    <span className="text-xs text-[#e7eaf0]/40 font-mono tabular-nums">{row.serial_number}</span>
                    {row.payment_proof_url && (
                      <span className="text-xs text-[#e7eaf0]/40">{t('portal.admin.payouts.history.ref')}: {row.payment_proof_url}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#10b981]">
                      {row.paid_at ? new Date(row.paid_at).toLocaleDateString('vi-VN') : ''}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#e7eaf0]/70">{fmtVnd(row.amount)}</span>
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
