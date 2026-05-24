'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exportCommissionReport } from '@/lib/export-commission-report';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import { DailyOrdersChart } from '@/components/portal/DailyOrdersChart';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';
import { getDealerLedger } from '@/lib/portal-queries';
import type { LedgerRow } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type Bucket = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

function statusOf(r: LedgerRow, t: (k: string) => string): { label: string; cls: string; dot: string; bucket: Exclude<Bucket, 'all'> } {
  if (r.status === 'rejected') return { label: t('portal.dealer.commission.status.rejected'), cls: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20', dot: 'bg-[#f87171]', bucket: 'rejected' };
  if (r.status === 'voided' || r.commission?.voided_at) return { label: t('portal.dealer.commission.status.voided'), cls: 'text-[#9ca3af] bg-[#1a1f26] border-[#1f2937]/40', dot: 'bg-[#a0a0a8]', bucket: 'rejected' };
  if (r.commission?.paid_at) return { label: t('portal.dealer.commission.status.paid'), cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  if (r.commission) return { label: t('portal.dealer.commission.status.approved_pending_payout'), cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20', dot: 'bg-[#3b82f6]', bucket: 'approved' };
  if (r.status === 'pending') return { label: t('portal.dealer.commission.status.pending'), cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', bucket: 'pending' };
  if (r.status === 'approved') return { label: t('portal.dealer.commission.status.approved'), cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20', dot: 'bg-[#3b82f6]', bucket: 'approved' };
  if (r.status === 'paid') return { label: t('portal.dealer.commission.status.paid'), cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  return { label: t('portal.dealer.commission.status.processing'), cls: 'text-[#9ca3af] bg-[#1a1f26] border-[#1f2937]/40', dot: 'bg-[#a0a0a8]', bucket: 'pending' };
}

const rateOf = (r: LedgerRow) =>
  r.commission && !r.commission.voided_at && Number(r.sale_price) > 0
    ? Math.round((Number(r.commission.amount) / Number(r.sale_price)) * 100)
    : null;

function planLabel(pct: number | null, t: (k: string) => string): { name: string; cls: string } {
  if (pct === null) return { name: t('portal.dealer.commission.plan.estimated'), cls: 'bg-[#1a1f26] text-[#9ca3af] border-[#1f2937]/40' };
  if (pct >= 23) return { name: `${t('portal.dealer.commission.plan.gold')} ${pct}%`, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  if (pct >= 18) return { name: `${t('portal.dealer.commission.plan.silver')} ${pct}%`, cls: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' };
  return { name: `${t('portal.dealer.commission.plan.standard')} ${pct}%`, cls: 'bg-[#ff5625]/10 text-[#ff5625] border-[#ff5625]/20' };
}

export default function DealerCommissionPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [filter, setFilter] = useState<Bucket>('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role && profile.role !== 'dealer') { router.replace('/portal/403'); return; }
    if (profile) {
      setFetching(true);
      getDealerLedger(profile.id)
        .then(setRows)
        .finally(() => setFetching(false));
    }
  }, [loading, session, profile, router]);

  const stats = useMemo(() => {
    let pendingCnt = 0, pendingVal = 0;        // chờ duyệt: order pending, no commission yet (estimated)
    let waitingCnt = 0, waitingVal = 0;        // tạm tính: same orders, estimated commission at 15%
    let approvedCnt = 0, approvedVal = 0;      // đã duyệt · chờ chi
    let paidCnt = 0, paidVal = 0;              // đã thanh toán
    for (const r of rows) {
      const c = r.commission;
      if (c?.paid_at && !c.voided_at) { paidCnt++; paidVal += Number(c.amount); continue; }
      if (c && !c.voided_at) { approvedCnt++; approvedVal += Number(c.amount); continue; }
      if (r.status === 'pending') {
        pendingCnt++; pendingVal += Number(r.sale_price);
        waitingCnt++; waitingVal += Math.round(Number(r.sale_price) * 0.15);
      }
    }
    return { pendingCnt, pendingVal, waitingCnt, waitingVal, approvedCnt, approvedVal, paidCnt, paidVal };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const b = statusOf(r, t).bucket;
    if (filter !== 'all' && b !== filter) return false;
    if (q && !(`${r.serial_number} ${r.customer_name}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (from && r.sale_date < from) return false;
    if (to && r.sale_date > to) return false;
    return true;
  }), [rows, filter, q, from, to, t]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, LedgerRow[]>();
    for (const r of filtered) {
      const key = (r.sale_date || '').slice(0, 7) || 'unknown';
      const list = groups.get(key);
      if (list) list.push(r); else groups.set(key, [r]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const sold = items
          .filter((r) => r.commission && !r.commission.voided_at)
          .reduce((s, r) => s + Number(r.commission?.amount ?? 0), 0);
        return { key, items, sold, count: items.length };
      });
  }, [filtered]);

  const monthLabel = (key: string) => {
    if (key === 'unknown') return t('portal.dealer.commission.month.unknown');
    const [y, m] = key.split('-');
    return `${t('portal.dealer.commission.month.prefix')} ${m}/${y}`;
  };

  if (loading || !session || !profile) return (
    <PortalShell variant="dealer">
      <PortalSkeleton.Ledger />
    </PortalShell>
  );

  const exportExcel = () => {
    if (filtered.length === 0) { toast.error(t('portal.dealer.commission.toast.no_orders_export')); return; }
    exportCommissionReport(filtered, {
      ownerName: profile.full_name || 'Đại lý',
      ownerRole: 'dealer',
    });
    toast.success(`${t('portal.dealer.commission.toast.exported_prefix')} ${filtered.length} ${t('portal.dealer.commission.toast.exported_suffix')}`);
  };


  return (
    <PortalShell variant="dealer">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.dealer.commission.eyebrow')}</p>
          <h1 className="mt-1 font-headline text-3xl">{t('portal.dealer.commission.title')}</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">{t('portal.dealer.commission.subtitle')}</p>
        </div>
        <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg bg-[#ff5625] px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#ff5625]/90 active:scale-95">
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t('portal.dealer.commission.btn.export')}
        </button>
      </div>

      {/* Filter row */}
      <div className="portal-glass mb-8 grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-3">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.dealer.commission.filter.status_label')}</label>
          <div className="relative">
            <select value={filter} onChange={(e) => setFilter(e.target.value as Bucket)} className="w-full cursor-pointer appearance-none rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] px-4 py-2.5 text-sm text-[#e7eaf0] focus:ring-1 focus:ring-[#ff5625] outline-none">
              <option value="all">{t('portal.dealer.commission.filter.all')}</option>
              <option value="pending">{t('portal.dealer.commission.filter.pending')}</option>
              <option value="approved">{t('portal.dealer.commission.filter.approved')}</option>
              <option value="paid">{t('portal.dealer.commission.filter.paid')}</option>
              <option value="rejected">{t('portal.dealer.commission.filter.rejected')}</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">expand_more</span>
          </div>
        </div>
        <div className="sm:col-span-4">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.dealer.commission.filter.date_range')}</label>
          <div className="flex items-center gap-2 rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] px-3 py-2">
            <span className="material-symbols-outlined text-[18px] text-[#9ca3af]">calendar_today</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent text-sm text-[#e7eaf0] outline-none [color-scheme:dark]" />
            <span className="text-[#9ca3af]">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-transparent text-sm text-[#e7eaf0] outline-none [color-scheme:dark]" />
          </div>
        </div>
        <div className="sm:col-span-5">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.dealer.commission.filter.search_label')}</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#9ca3af]">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('portal.dealer.commission.filter.search_placeholder')} className="w-full rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] py-2.5 pl-11 pr-4 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af]/40 focus:ring-1 focus:ring-[#ff5625] outline-none" />
          </div>
        </div>
      </div>

      {/* Daily orders chart — số đơn + doanh số theo ngày (chỉ đơn đã thành công) */}
      <div className="mb-8">
        <DailyOrdersChart rows={rows} days={30} title={t('portal.dealer.commission.chart.title')} />
      </div>

      {/* Grouped commission timeline (replaces flat table) */}
      {fetching ? (
        <PortalSkeleton.Ledger />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1f2937] bg-[#11151a] p-10 text-center text-sm text-[#9ca3af]">
          {t('portal.dealer.commission.empty')}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByMonth.map((group) => (
            <section key={group.key}>
              <header className="sticky top-[64px] z-10 -mx-2 mb-3 flex items-baseline justify-between gap-3 rounded-md bg-[#0a0c0f]/95 px-2 py-2 backdrop-blur">
                <h3 className="font-headline text-lg text-[#e7eaf0]">{monthLabel(group.key)}</h3>
                <p className="text-xs text-[#9ca3af]">
                  <span className="font-mono font-semibold tabular-nums text-[#ff5625]">{fmtVnd(group.sold)} ₫</span>
                  {' · '}
                  <span className="font-mono tabular-nums">{group.count}</span> {t('portal.dealer.commission.orders_word')}
                </p>
              </header>
              <ul className="space-y-3">
                {group.items.map((r) => {
                  const st = statusOf(r, t);
                  const pct = rateOf(r);
                  const plan = planLabel(pct, t);
                  const open = openId === r.id;
                  const commissionAmount = r.commission && !r.commission.voided_at ? Number(r.commission.amount) : null;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="w-full rounded-2xl border border-[#1f2937] bg-[#11151a] p-4 text-left transition-colors hover:border-[#ff5625]/40 hover:bg-[#1a1f26] active:scale-[0.998]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#e7eaf0] truncate">{r.customer_name}</p>
                            <p className="mt-0.5 text-xs text-[#9ca3af]">
                              <span className="font-mono tabular-nums">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</span>
                              {' · '}
                              <span className="font-mono tabular-nums text-[#ff5625]">{r.serial_number}</span>
                            </p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${st.bucket === 'paid' ? 'animate-pulse' : ''}`} />
                            {st.label}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.dealer.commission.card.sale_price')}</p>
                            <p className="font-headline text-lg tabular-nums">{fmtVnd(Number(r.sale_price))} ₫</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.dealer.commission.card.commission')}</p>
                            <p className={`font-headline text-lg tabular-nums ${commissionAmount && r.commission?.paid_at ? 'text-[#10b981]' : commissionAmount ? 'text-[#3b82f6]' : 'text-[#9ca3af]'}`}>
                              {commissionAmount !== null ? `${fmtVnd(commissionAmount)} ₫` : '—'}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.dealer.commission.card.plan')}</p>
                            <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${plan.cls}`}>{plan.name}</span>
                          </div>
                        </div>
                        {open && (
                          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#1f2937] pt-4 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] uppercase text-[#9ca3af]">{t('portal.dealer.commission.card.order_date')}</p>
                              <p className="text-sm">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-[#9ca3af]">{t('portal.dealer.commission.card.plan')}</p>
                              <p className="text-sm">{plan.name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-[#9ca3af]">{t('portal.dealer.commission.card.payout_date')}</p>
                              <p className="text-sm">{r.commission?.paid_at ? new Date(r.commission.paid_at).toLocaleDateString('vi-VN') : t('portal.dealer.commission.card.not_paid')}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <p className="text-[10px] uppercase text-[#9ca3af]">{t('portal.dealer.commission.card.tx_id')}</p>
                              <p className="font-mono text-xs text-[#ff5625] break-all">{r.commission?.payment_proof_url || '—'}</p>
                            </div>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="px-2 text-xs text-[#9ca3af]">
            {t('portal.dealer.commission.showing_prefix')} <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">{filtered.length}</span> {t('portal.dealer.commission.showing_of')}{' '}
            <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">{rows.length}</span> {t('portal.dealer.commission.showing_suffix')}
          </p>
        </div>
      )}

    </PortalShell>
  );
}
