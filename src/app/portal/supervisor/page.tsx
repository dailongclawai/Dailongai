'use client';

import { useEffect, useMemo, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { exportCommissionReport } from '@/lib/export-commission-report';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { DailyOrdersChart } from '@/components/portal/DailyOrdersChart';
import { SupervisorIncomeSummary } from '@/components/portal/SupervisorIncomeSummary';
import { PodiumLeaderboard } from '@/components/portal/PodiumLeaderboard';
import { SupervisorInviteCard } from '@/components/portal/SupervisorInviteCard';
import { AccountIdBadge } from '@/components/portal/AccountIdBadge';
import { SupervisorFunnelCard } from '@/components/portal/FunnelChart';
import {
  getSupervisorTeam, getMyPayouts, getDealerCurrentCommissions,
  setDealerFixedCommission, clearDealerFixedCommission,
  getSupervisorLedger,
  getTeamLeaderboard,
} from '@/lib/portal-queries';
import type { TeamMember, PayoutRow, DealerCurrentCommission } from '@/lib/portal-types';
import type { SupervisorLedgerRow, LedgerRow, LeaderboardRow } from '@/lib/portal-queries';

const MIN_FIXED = 4500000;
const MAX_FIXED = 7500000;
const STEP_FIXED = 500000;

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type Tab = 'team' | 'commission';
type Bucket = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

type TFn = (key: string) => string;

function statusOf(r: LedgerRow, t: TFn): { label: string; cls: string; dot: string; bucket: Exclude<Bucket, 'all'> } {
  if (r.status === 'rejected') return { label: t('portal.supervisor.dashboard.status.rejected'), cls: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20', dot: 'bg-[#f87171]', bucket: 'rejected' };
  if (r.status === 'voided' || r.commission?.voided_at) return { label: t('portal.supervisor.dashboard.status.voided'), cls: 'text-[#9ca3af] bg-[#1a1f26] border-[#1f2937]/40', dot: 'bg-[#a0a0a8]', bucket: 'rejected' };
  if (r.commission?.paid_at) return { label: t('portal.supervisor.dashboard.status.paid'), cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  if (r.commission) return { label: t('portal.supervisor.dashboard.status.approved_pending_payout'), cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20', dot: 'bg-[#3b82f6]', bucket: 'approved' };
  if (r.status === 'pending') return { label: t('portal.supervisor.dashboard.status.pending'), cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', bucket: 'pending' };
  if (r.status === 'approved') return { label: t('portal.supervisor.dashboard.status.approved'), cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20', dot: 'bg-[#3b82f6]', bucket: 'approved' };
  if (r.status === 'paid') return { label: t('portal.supervisor.dashboard.status.paid'), cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  return { label: t('portal.supervisor.dashboard.status.processing'), cls: 'text-[#9ca3af] bg-[#1a1f26] border-[#1f2937]/40', dot: 'bg-[#a0a0a8]', bucket: 'pending' };
}

const rateOf = (r: LedgerRow) =>
  r.commission && !r.commission.voided_at && Number(r.sale_price) > 0
    ? +(Number(r.commission.amount) / Number(r.sale_price) * 100).toFixed(2)
    : null;

function overrideLabel(pct: number | null, t: TFn): { name: string; cls: string } {
  if (pct === null) return { name: t('portal.supervisor.dashboard.override.estimated'), cls: 'bg-[#1a1f26] text-[#9ca3af] border-[#1f2937]/40' };
  return { name: `${t('portal.supervisor.dashboard.override.prefix')} ${pct}%`, cls: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' };
}

export default function SupervisorPage() {
  return (
    <Suspense fallback={null}>
      <SupervisorDashboard />
    </Suspense>
  );
}

function SupervisorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'commission' ? 'commission' : 'team';
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();

  // Team tab state
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [currentByDealer, setCurrentByDealer] = useState<Record<string, DealerCurrentCommission>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [editingDealer, setEditingDealer] = useState<TeamMember | null>(null);
  const [editAmount, setEditAmount] = useState(6000000);
  const [editMode, setEditMode] = useState<'tier' | 'fixed'>('tier');
  const [savingPlan, setSavingPlan] = useState(false);

  // Commission tab state
  const [rows, setRows] = useState<SupervisorLedgerRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [filter, setFilter] = useState<Bucket>('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role !== 'supervisor') { router.replace('/portal/403'); return; }
    if (!profile) return;
    getSupervisorTeam(session.user.id).then(async (t) => {
      setTeam(t);
      if (t.length) setCurrentByDealer(await getDealerCurrentCommissions(t.map((r) => r.dealer_id)));
    });
    getSupervisorLedger(profile.id).then(setRows);
    getMyPayouts().then(setPayouts);
    getTeamLeaderboard().then(setLeaderboard).catch(() => setLeaderboard([]));
  }, [loading, session, profile, router]);

  // Live sync: refetch team commission state when any team-dealer rule changes
  // (RLS + supabase_realtime publication ensure supervisor only gets events for own team)
  useEffect(() => {
    if (!session || profile?.role !== 'supervisor' || team.length === 0) return;
    const supabase = getSupabaseClient();
    const teamIds = team.map((t) => t.dealer_id);

    const refresh = async () => {
      try {
        const fresh = await getDealerCurrentCommissions(teamIds);
        setCurrentByDealer(fresh);
      } catch {
        // silent
      }
    };

    const channel = supabase
      .channel(`supervisor-team-commission-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dealer_commissions' },
        (payload) => {
          const row = (payload.new as { dealer_id?: string } | null) ?? (payload.old as { dealer_id?: string } | null);
          if (row?.dealer_id && teamIds.includes(row.dealer_id)) void refresh();
        },
      )
      .subscribe();

    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, team.length]);

  const stats = useMemo(() => {
    let pendingCnt = 0, pendingVal = 0;
    let approvedCnt = 0, approvedVal = 0;
    let paidCnt = 0, paidVal = 0;
    for (const r of rows) {
      const c = r.commission;
      if (c?.paid_at && !c.voided_at) { paidCnt++; paidVal += Number(c.amount); continue; }
      if (c && !c.voided_at) { approvedCnt++; approvedVal += Number(c.amount); continue; }
      if (r.status === 'pending') { pendingCnt++; pendingVal += Number(r.sale_price); }
    }
    return { pendingCnt, pendingVal, approvedCnt, approvedVal, paidCnt, paidVal };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const b = statusOf(r, t).bucket;
    if (filter !== 'all' && b !== filter) return false;
    const haystack = `${r.serial_number ?? ''} ${r.customer_name} ${r.dealer_name ?? ''}`.toLowerCase();
    if (q && !haystack.includes(q.toLowerCase())) return false;
    if (from && r.sale_date < from) return false;
    if (to && r.sale_date > to) return false;
    return true;
  }), [rows, filter, q, from, to, t]);

  if (loading || profile?.role !== 'supervisor') return null;

  // ── Team handlers ──
  const openCommissionEditor = async (t: TeamMember) => {
    // Refetch fresh state before opening modal — avoid stale cache mismatch
    let curr = currentByDealer[t.dealer_id];
    try {
      const fresh = await getDealerCurrentCommissions([t.dealer_id]);
      setCurrentByDealer((prev) => ({ ...prev, ...fresh }));
      curr = fresh[t.dealer_id] ?? curr;
    } catch {
      // fall back to cached
    }
    setEditAmount(curr?.override_amount ? Number(curr.override_amount) : 6000000);
    setEditMode(curr?.source === 'fixed' ? 'fixed' : 'tier');
    setEditingDealer(t);
  };

  const saveFixedAmount = async () => {
    if (!editingDealer) return;
    if (editAmount < MIN_FIXED || editAmount > MAX_FIXED) {
      toast.error(`${t('portal.supervisor.dashboard.toast.amount_range_prefix')} ${MIN_FIXED.toLocaleString('vi-VN')} ${t('portal.supervisor.dashboard.toast.amount_range_to')} ${MAX_FIXED.toLocaleString('vi-VN')} ${t('portal.supervisor.dashboard.toast.amount_range_suffix')}`);
      return;
    }
    setSavingPlan(true);
    try {
      await setDealerFixedCommission(editingDealer.dealer_id, editAmount);
      const fresh = await getDealerCurrentCommissions(team.map((r) => r.dealer_id));
      setCurrentByDealer(fresh);
      toast.success(`${t('portal.supervisor.dashboard.toast.fixed_set_prefix')} ${editingDealer.dealer_name ?? t('portal.shell.role.dealer')}`);
      setEditingDealer(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.supervisor.dashboard.toast.commission_update_error'));
    } finally { setSavingPlan(false); }
  };

  const clearFixedAmount = async () => {
    if (!editingDealer) return;
    setSavingPlan(true);
    try {
      await clearDealerFixedCommission(editingDealer.dealer_id);
      const fresh = await getDealerCurrentCommissions(team.map((r) => r.dealer_id));
      setCurrentByDealer(fresh);
      toast.success(`${t('portal.supervisor.dashboard.toast.tier_restored_prefix')} ${editingDealer.dealer_name ?? t('portal.shell.role.dealer')} ${t('portal.supervisor.dashboard.toast.tier_restored_suffix')}`);
      setEditingDealer(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.supervisor.dashboard.toast.clear_override_error'));
    } finally { setSavingPlan(false); }
  };

  // ── Commission handlers ──
  const exportExcel = () => {
    if (filtered.length === 0) { toast.error(t('portal.supervisor.dashboard.toast.no_orders_export')); return; }
    exportCommissionReport(filtered, {
      ownerName: profile.full_name || 'Supervisor',
      ownerRole: 'supervisor',
    });
    toast.success(`${t('portal.supervisor.dashboard.toast.exported_prefix')} ${filtered.length} ${t('portal.supervisor.dashboard.toast.exported_suffix')}`);
  };

  const activeCount = team.filter((t) => Number(t.month_sales) > 0).length;
  const pendingTeamOrders = team.reduce((s, t) => s + Number(t.orders_pending), 0);

  return (
    <PortalShell variant="supervisor">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">{t('portal.shell.role.supervisor')}</p>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl">{profile.full_name || t('portal.shell.role.supervisor')} · {t('portal.supervisor.dashboard.heading_suffix')}</h1>
      </div>

      {/* Hoa hồng đang chờ chi — top emphasis (same as dealer dashboard) */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.10] via-[#10b981]/[0.04] to-[#11151a] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#10b981]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-[#10b981]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#10b981]">account_balance_wallet</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#10b981]">
                {t('portal.supervisor.dashboard.hero.pending_payout')}
              </p>
            </div>
            <p className="mt-3 font-headline text-[44px] font-bold leading-none tracking-tight tabular-nums text-[#10b981] md:text-[64px]">
              {fmtVnd(stats.approvedVal)}
              <span className="ml-2 align-top font-mono text-2xl tabular-nums text-[#10b981]/70">₫</span>
            </p>
            <p className="mt-3 text-xs text-[#9ca3af]">
              {t('portal.supervisor.dashboard.hero.auto_payout_note')}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-3 sm:text-right">
            <div className="rounded-xl border border-[#1f2937] bg-[#0a0c0f]/60 px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.hero.total_received')}</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#e7eaf0]">
                {fmtVnd(stats.paidVal)} ₫
              </p>
            </div>
          </div>
        </div>
      </section>

      {tab === 'team' && (
        <>
          {/* Cài đặt hoa hồng đại lý + Mời đại lý mới (side by side) */}
          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.05] to-[#11151a]">
              <div className="flex items-center justify-between gap-3 border-b border-[#10b981]/20 bg-[#10b981]/[0.04] px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-[#10b981]">tune</span>
                  <div>
                    <p className="text-sm font-bold text-[#e7eaf0]">{t('portal.supervisor.dashboard.commission_settings.title')}</p>
                    <p className="text-[10px] text-[#9ca3af]">{t('portal.supervisor.dashboard.commission_settings.subtitle')}</p>
                  </div>
                </div>
                {team.length > 0 && (
                  <p className="font-mono text-[11px] tabular-nums text-[#9ca3af]">
                    <span className="font-semibold text-[#10b981]">{team.length}</span> {t('portal.supervisor.dashboard.commission_settings.dealers_label')}
                  </p>
                )}
              </div>
              {team.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-[#9ca3af]">
                  {t('portal.supervisor.dashboard.commission_settings.empty')}
                </div>
              ) : (
                <ul className="max-h-[320px] divide-y divide-[#1f2937]/60 overflow-y-auto portal-scroll">
                  {[...team]
                    .sort((a, b) => Number(b.month_sales) - Number(a.month_sales))
                    .map((tm) => {
                      const comm = currentByDealer[tm.dealer_id];
                      const isFixed = comm?.source === 'fixed';
                      const name = tm.dealer_name ?? t('portal.supervisor.dashboard.no_name');
                      const initials = name.trim().split(/\s+/).slice(-2).map((w) => w[0] ?? '').join('').toUpperCase() || '?';
                      const hash = Array.from(tm.dealer_id).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
                      const gradients = [
                        'from-[#ff5625] to-[#f59e0b]',
                        'from-[#3b82f6] to-[#06b6d4]',
                        'from-[#10b981] to-[#84cc16]',
                        'from-[#a855f7] to-[#ec4899]',
                        'from-[#f59e0b] to-[#ef4444]',
                        'from-[#06b6d4] to-[#8b5cf6]',
                        'from-[#84cc16] to-[#22d3ee]',
                        'from-[#ec4899] to-[#fb7185]',
                      ];
                      const gradient = gradients[hash % gradients.length];
                      const act = Number(tm.month_sales) > 0
                        ? { label: t('portal.supervisor.dashboard.activity.active'), cls: 'bg-[#10b981]/15 text-[#10b981]' }
                        : Number(tm.orders_pending) > 0
                          ? { label: t('portal.supervisor.dashboard.activity.has_pending'), cls: 'bg-[#ff5625]/15 text-[#ff5625]' }
                          : { label: t('portal.supervisor.dashboard.activity.quiet'), cls: 'bg-[#1a1f26] text-[#9ca3af]' };
                      return (
                        <li key={tm.dealer_id}>
                          <button
                            type="button"
                            onClick={() => openCommissionEditor(tm)}
                            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#10b981]/[0.06] active:bg-[#10b981]/15"
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-xs font-bold text-white`}>
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-[#e7eaf0]">{name}</p>
                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${act.cls}`}>
                                  {act.label}
                                </span>
                              </div>
                              <div className="mt-0.5">
                                <AccountIdBadge accountNo={tm.dealer_account_no} id={tm.dealer_id} />
                              </div>
                              <p className="mt-1 text-[11px] text-[#9ca3af]">
                                <span className="font-mono tabular-nums text-[#e7eaf0]">{fmtVnd(Number(tm.month_sales))} ₫</span>
                                {' · '}
                                <span className="font-mono tabular-nums">{tm.units_ytd}</span> {t('portal.supervisor.dashboard.units_month_suffix')}
                                {Number(tm.orders_pending) > 0 && (
                                  <>
                                    {' · '}
                                    <span className="font-mono tabular-nums text-[#ff5625]">{tm.orders_pending}</span> {t('portal.supervisor.dashboard.pending_suffix')}
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono text-base font-bold tabular-nums ${isFixed ? 'text-[#ff5625]' : 'text-[#10b981]'}`}>
                                  {comm?.rate_display ?? '15%'}
                                </span>
                                {isFixed && (
                                  <span className="rounded-sm bg-[#ff5625]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#ff5625]">
                                    {t('portal.supervisor.dashboard.fixed_badge')}
                                  </span>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#10b981] transition-colors group-hover:border-[#10b981] group-hover:bg-[#10b981] group-hover:text-white">
                                <span className="material-symbols-outlined text-[12px]">edit</span>
                                {t('portal.supervisor.dashboard.configure_btn')}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
            <SupervisorInviteCard
              supervisorId={profile.id}
              supervisorName={profile.full_name}
              teamCount={team.length}
            />
          </div>

          {/* Leaderboard + Funnel side-by-side on desktop */}
          <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PodiumLeaderboard rows={leaderboard} />
            <SupervisorFunnelCard supervisorId={profile.id} />
          </div>

          {/* Activity stats (focus on people/activity, not revenue) */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.dashboard.stat.team_size')}</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{team.length}</p>
            </div>
            <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.dashboard.stat.active_month')}</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#10b981]">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.dashboard.stat.orders_pending')}</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#ff5625]">{pendingTeamOrders}</p>
            </div>
          </div>


          {/* Unified dealer card grid (mobile stack, desktop 2/3 cols) */}
          {team.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1f2937] bg-[#11151a] p-10 text-center text-sm text-[#9ca3af]">
              {t('portal.supervisor.dashboard.empty_team_invite')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...team].sort((a, b) => Number(b.month_sales) - Number(a.month_sales)).map((tm) => {
                const act = Number(tm.month_sales) > 0
                  ? { label: t('portal.supervisor.dashboard.activity.active'), cls: 'bg-[#10b981]/15 text-[#10b981]' }
                  : Number(tm.orders_pending) > 0
                    ? { label: t('portal.supervisor.dashboard.activity.has_pending'), cls: 'bg-[#ff5625]/15 text-[#ff5625]' }
                    : { label: t('portal.supervisor.dashboard.activity.quiet'), cls: 'bg-[#1a1f26] text-[#9ca3af]' };
                const name = tm.dealer_name ?? t('portal.supervisor.dashboard.no_name');
                const initials = name.trim().split(/\s+/).slice(-2).map((w) => w[0] ?? '').join('').toUpperCase() || '?';
                const hash = Array.from(tm.dealer_id).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
                const gradients = [
                  'from-[#ff5625] to-[#f59e0b]',
                  'from-[#3b82f6] to-[#06b6d4]',
                  'from-[#10b981] to-[#84cc16]',
                  'from-[#a855f7] to-[#ec4899]',
                  'from-[#f59e0b] to-[#ef4444]',
                  'from-[#06b6d4] to-[#8b5cf6]',
                  'from-[#84cc16] to-[#22d3ee]',
                  'from-[#ec4899] to-[#fb7185]',
                ];
                const gradient = gradients[hash % gradients.length];
                return (
                  <div
                    key={tm.dealer_id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-[#1f2937] bg-[#11151a] transition-colors hover:border-[#1f2937]/80"
                  >
                    <div className="flex items-start gap-3 border-b border-[#1f2937] p-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#e7eaf0]">{name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${act.cls}`}>
                            {act.label}
                          </span>
                          <AccountIdBadge accountNo={tm.dealer_account_no} id={tm.dealer_id} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.card.sales')}</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{fmtVnd(Number(tm.month_sales))}</p>
                      </div>
                      <div className="border-x border-[#1f2937]">
                        <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.card.units')}</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{tm.units_ytd}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.card.pending')}</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#ff5625]">{tm.orders_pending}</p>
                      </div>
                    </div>
                    <Link
                      href={`/portal/supervisor/team?dealer=${tm.dealer_id}`}
                      className="border-t border-[#1f2937] px-4 py-2.5 text-center text-xs text-[#ff5625] transition-colors hover:bg-[#1a1f26]"
                    >
                      {t('portal.supervisor.dashboard.card.detail_link')}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'commission' && (
        <>
          {/* Income summary (đẹp riêng cho supervisor) */}
          <div className="mb-8">
            <SupervisorIncomeSummary payouts={payouts} />
          </div>

          {/* Daily orders chart đội */}
          <div className="mb-8">
            <DailyOrdersChart rows={rows} days={30} title={t('portal.supervisor.dashboard.chart.team_daily')} />
          </div>

          {/* Action bar */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.supervisor.dashboard.ledger.eyebrow')}</p>
              <p className="mt-1 text-sm text-[#9ca3af]">{t('portal.supervisor.dashboard.ledger.subhead')}</p>
            </div>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg bg-[#ff5625] px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#ff5625]/90 active:scale-95">
              <span className="material-symbols-outlined text-[18px]">download</span> {t('portal.supervisor.dashboard.export_report')}
            </button>
          </div>

          {/* Filter */}
          <div className="portal-glass mb-8 grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-3">
              <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.filter.status_label')}</label>
              <div className="relative">
                <select value={filter} onChange={(e) => setFilter(e.target.value as Bucket)} className="w-full cursor-pointer appearance-none rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] px-4 py-2.5 text-sm text-[#e7eaf0] focus:ring-1 focus:ring-[#ff5625] outline-none">
                  <option value="all">{t('portal.supervisor.dashboard.filter.all')}</option>
                  <option value="pending">{t('portal.supervisor.dashboard.filter.pending')}</option>
                  <option value="approved">{t('portal.supervisor.dashboard.filter.approved')}</option>
                  <option value="paid">{t('portal.supervisor.dashboard.filter.paid')}</option>
                  <option value="rejected">{t('portal.supervisor.dashboard.filter.rejected')}</option>
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">expand_more</span>
              </div>
            </div>
            <div className="sm:col-span-4">
              <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.filter.date_range')}</label>
              <div className="flex items-center gap-2 rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] px-3 py-2">
                <span className="material-symbols-outlined text-[18px] text-[#9ca3af]">calendar_today</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent text-sm text-[#e7eaf0] outline-none [color-scheme:dark]" />
                <span className="text-[#9ca3af]">–</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-transparent text-sm text-[#e7eaf0] outline-none [color-scheme:dark]" />
              </div>
            </div>
            <div className="sm:col-span-5">
              <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.filter.search_label')}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#9ca3af]">search</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('portal.supervisor.dashboard.filter.search_placeholder')} className="w-full rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] py-2.5 pl-11 pr-4 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af]/40 focus:ring-1 focus:ring-[#ff5625] outline-none" />
              </div>
            </div>
          </div>

          {/* Ledger table */}
          <div className="overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
            <div className="portal-scroll overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-[#1f2937]/40 bg-[#1a1f26]/50 text-[11px] uppercase tracking-wider text-[#9ca3af]">
                    <th className="px-6 py-4">{t('portal.supervisor.dashboard.table.serial')}</th>
                    <th className="px-6 py-4">{t('portal.supervisor.dashboard.table.dealer')}</th>
                    <th className="px-6 py-4">{t('portal.supervisor.dashboard.table.customer')}</th>
                    <th className="px-6 py-4 text-right">{t('portal.supervisor.dashboard.table.sale_price')}</th>
                    <th className="px-6 py-4">{t('portal.supervisor.dashboard.table.override')}</th>
                    <th className="px-6 py-4 text-right">{t('portal.supervisor.dashboard.table.commission')}</th>
                    <th className="px-6 py-4">{t('portal.supervisor.dashboard.table.status')}</th>
                    <th className="w-10 px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d3f41]/20">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-[#9ca3af]/60">{t('portal.supervisor.dashboard.table.empty')}</td></tr>
                  ) : filtered.map((r) => {
                    const st = statusOf(r, t);
                    const pct = rateOf(r);
                    const ovr = overrideLabel(pct, t);
                    const open = openId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr onClick={() => setOpenId(open ? null : r.id)} className="group cursor-pointer transition-colors hover:bg-[#1a1f26]">
                          <td className="px-6 py-5 font-mono text-sm text-[#ff5625]">{r.serial_number ?? '—'}</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff5625]/15 text-[11px] font-bold text-[#ff5625]">
                                {(r.dealer_name ?? '?').trim().slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium">{r.dealer_name ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm">{r.customer_name}</td>
                          <td className="px-6 py-5 text-right font-mono text-sm tabular-nums">{fmtVnd(Number(r.sale_price))} ₫</td>
                          <td className="px-6 py-5">
                            <span className={`rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${ovr.cls}`}>{ovr.name}</span>
                          </td>
                          <td className={`px-6 py-5 text-right font-mono text-sm font-bold tabular-nums ${r.commission?.paid_at ? 'text-emerald-400' : 'text-[#e7eaf0]'}`}>
                            {r.commission && !r.commission.voided_at ? `${fmtVnd(Number(r.commission.amount))} ₫` : '—'}
                          </td>
                          <td className="px-6 py-5">
                            <div className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${st.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${st.bucket === 'paid' ? 'animate-pulse' : ''}`} />{st.label}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="material-symbols-outlined text-[#9ca3af] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>keyboard_arrow_down</span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-[#06080a]/50">
                            <td colSpan={8} className="px-12 py-6">
                              <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">{t('portal.supervisor.dashboard.detail.order_date')}</p>
                                  <p className="text-sm">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">{t('portal.supervisor.dashboard.detail.owner')}</p>
                                  <p className="text-sm">{r.dealer_name ?? '—'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">{t('portal.supervisor.dashboard.detail.paid_date')}</p>
                                  <p className="text-sm">{r.commission?.paid_at ? new Date(r.commission.paid_at).toLocaleDateString('vi-VN') : t('portal.supervisor.dashboard.detail.not_paid')}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">{t('portal.supervisor.dashboard.detail.txn_ref')}</p>
                                  <p className="font-mono text-sm text-[#ff5625] break-all">{r.commission?.payment_proof_url || '—'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#1f2937]/40 bg-[#1a1f26]/20 px-6 py-4">
              <p className="text-sm text-[#9ca3af]">{t('portal.supervisor.dashboard.table.showing_prefix')} <span className="font-bold text-[#e7eaf0]">{filtered.length}</span> {t('portal.supervisor.dashboard.table.showing_of')} <span className="font-bold text-[#e7eaf0]">{rows.length}</span> {t('portal.supervisor.dashboard.table.showing_suffix')}</p>
            </div>
          </div>

        </>
      )}

      {/* Edit commission modal: tier auto display + fixed override input */}
      {editingDealer && (() => {
        const curr = currentByDealer[editingDealer.dealer_id];
        const isOverride = curr?.source === 'fixed';
        return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => !savingPlan && setEditingDealer(null)}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#1f2937]/60 bg-[#11151a] shadow-2xl  sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#1f2937]/40 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#10b981]">{t('portal.supervisor.dashboard.modal.dealer_commission')}</p>
                <h3 className="mt-1 text-base font-semibold">{editingDealer.dealer_name ?? t('portal.supervisor.dashboard.no_name')}</h3>
              </div>
              <button onClick={() => !savingPlan && setEditingDealer(null)} className="rounded-lg p-1.5 text-[#e7eaf0]/50 hover:bg-[#1a1f26] hover:text-[#e7eaf0]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* 2-option switcher */}
            <div className="grid grid-cols-2 gap-2 border-b border-[#1f2937]/40 bg-[#0a0c0f] p-3">
              <button
                type="button"
                onClick={() => !savingPlan && setEditMode('tier')}
                disabled={savingPlan}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                  editMode === 'tier'
                    ? 'border-[#10b981]/60 bg-[#10b981]/10'
                    : 'border-[#1f2937] bg-[#11151a] hover:border-[#10b981]/30'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`material-symbols-outlined text-[18px] ${editMode === 'tier' ? 'text-[#10b981]' : 'text-[#9ca3af]'}`}>auto_awesome</span>
                  <span className={`text-sm font-bold ${editMode === 'tier' ? 'text-[#10b981]' : 'text-[#e7eaf0]'}`}>{t('portal.supervisor.dashboard.modal.tier_auto')}</span>
                  {!isOverride && <span className="ml-auto rounded-sm bg-[#10b981]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#10b981]">{t('portal.supervisor.dashboard.modal.in_use')}</span>}
                </span>
                <span className="text-[10px] text-[#9ca3af]">{t('portal.supervisor.dashboard.modal.tier_auto_hint')}</span>
              </button>
              <button
                type="button"
                onClick={() => !savingPlan && setEditMode('fixed')}
                disabled={savingPlan}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                  editMode === 'fixed'
                    ? 'border-[#ff5625]/60 bg-[#ff5625]/10'
                    : 'border-[#1f2937] bg-[#11151a] hover:border-[#ff5625]/30'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`material-symbols-outlined text-[18px] ${editMode === 'fixed' ? 'text-[#ff5625]' : 'text-[#9ca3af]'}`}>price_change</span>
                  <span className={`text-sm font-bold ${editMode === 'fixed' ? 'text-[#ff5625]' : 'text-[#e7eaf0]'}`}>{t('portal.supervisor.dashboard.modal.fixed_per_unit')}</span>
                  {isOverride && <span className="ml-auto rounded-sm bg-[#ff5625]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#ff5625]">{t('portal.supervisor.dashboard.modal.in_use')}</span>}
                </span>
                <span className="text-[10px] text-[#9ca3af]">{t('portal.supervisor.dashboard.modal.fixed_hint')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {editMode === 'tier' ? (
                <>
                  <p className="mb-3 text-[11px] leading-relaxed text-[#9ca3af]">
                    {t('portal.supervisor.dashboard.modal.tier_explainer_part1')} <span className="text-[#e7eaf0]">{t('portal.supervisor.dashboard.modal.tier_formula')}</span> {t('portal.supervisor.dashboard.modal.tier_explainer_part2')}
                  </p>
                  <div className="rounded-xl border border-[#10b981]/30 bg-[#10b981]/[0.06] p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.dashboard.modal.current_tier')}</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#e7eaf0]">{curr?.tier_label ?? t('portal.supervisor.team.tier.default_label')}</p>
                        <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                          {t('portal.supervisor.dashboard.modal.closed_prefix')} <span className="font-mono tabular-nums text-[#e7eaf0]">{curr?.units_ytd ?? 0}</span> {t('portal.supervisor.dashboard.modal.closed_suffix')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-3xl font-bold tabular-nums text-[#10b981]">{Number(curr?.tier_percent ?? 15)}%</p>
                        <p className="text-[10px] text-[#9ca3af]">{t('portal.supervisor.team.tier.of_sale_price')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: t('portal.supervisor.dashboard.modal.tier1_label'), units: '1–200', pct: '15%' },
                      { label: t('portal.supervisor.dashboard.modal.tier2_label'), units: '201–300', pct: '20%' },
                      { label: t('portal.supervisor.dashboard.modal.tier3_label'), units: '301+', pct: '25%' },
                    ].map((tier) => {
                      const active = Number(curr?.tier_percent ?? 15) === Number(tier.pct.replace('%', ''));
                      return (
                        <div
                          key={tier.label}
                          className={`rounded-lg border p-2.5 ${active ? 'border-[#10b981]/50 bg-[#10b981]/[0.06]' : 'border-[#1f2937] bg-[#0a0c0f] opacity-60'}`}
                        >
                          <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">{tier.label}</p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#e7eaf0]">{tier.units} {t('portal.supervisor.dashboard.modal.units_word')}</p>
                          <p className={`font-headline text-base ${active ? 'text-[#10b981]' : 'text-[#9ca3af]'}`}>{tier.pct}</p>
                        </div>
                      );
                    })}
                  </div>
                  {isOverride && (
                    <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/[0.06] p-3 text-[11px] text-[#f59e0b]">
                      <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                      {t('portal.supervisor.dashboard.modal.switch_to_tier_hint')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mb-3 text-[11px] leading-relaxed text-[#9ca3af]">
                    {t('portal.supervisor.dashboard.modal.fixed_explainer_part1')} <span className="text-[#e7eaf0]">{t('portal.supervisor.dashboard.modal.fixed_formula')}</span> {t('portal.supervisor.dashboard.modal.fixed_explainer_part2')}
                  </p>
                  <div className="rounded-xl border border-[#ff5625]/30 bg-[#ff5625]/[0.06] p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.supervisor.team.fixed.amount_per_unit')}</span>
                      <span className="font-mono text-2xl font-bold tabular-nums text-[#ff5625]">
                        {editAmount.toLocaleString('vi-VN')} <span className="text-base text-[#9ca3af]">₫</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_FIXED}
                      max={MAX_FIXED}
                      step={STEP_FIXED}
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      disabled={savingPlan}
                      className="mt-3 w-full accent-[#ff5625]"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[#9ca3af]">
                      <span>{MIN_FIXED.toLocaleString('vi-VN')} ₫</span>
                      <span>{MAX_FIXED.toLocaleString('vi-VN')} ₫</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-[11px] text-[#9ca3af]">{t('portal.supervisor.dashboard.modal.direct_input_label')}</label>
                      <input
                        type="number"
                        min={MIN_FIXED}
                        max={MAX_FIXED}
                        step={100000}
                        value={editAmount}
                        onChange={(e) => setEditAmount(Number(e.target.value))}
                        disabled={savingPlan}
                        className="flex-1 rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-1.5 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]"
                      />
                    </div>
                  </div>
                  {!isOverride && (
                    <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-[#10b981]/30 bg-[#10b981]/[0.06] p-3 text-[11px] text-[#10b981]">
                      <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                      {t('portal.supervisor.dashboard.modal.switch_to_fixed_hint')}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#1f2937]/40 bg-[#1a1f26]/20 px-5 py-4">
              <button
                onClick={() => !savingPlan && setEditingDealer(null)}
                disabled={savingPlan}
                className="rounded-lg border border-[#1f2937]/50 px-4 py-2 text-sm text-[#e7eaf0]/80 hover:bg-[#1a1f26] disabled:opacity-50"
              >
                {t('portal.supervisor.dashboard.modal.cancel')}
              </button>
              {editMode === 'tier' ? (
                <button
                  onClick={clearFixedAmount}
                  disabled={savingPlan || !isOverride}
                  title={!isOverride ? t('portal.supervisor.dashboard.modal.already_tier_tooltip') : t('portal.supervisor.dashboard.modal.apply_tier_tooltip')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10b981] px-5 py-2 text-sm font-bold text-white hover:bg-[#0ea271] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  {savingPlan ? t('portal.supervisor.dashboard.modal.saving') : (isOverride ? t('portal.supervisor.dashboard.modal.apply_tier_btn') : t('portal.supervisor.dashboard.modal.using_tier_btn'))}
                </button>
              ) : (
                <button
                  onClick={saveFixedAmount}
                  disabled={savingPlan || editAmount < MIN_FIXED || editAmount > MAX_FIXED}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff5625] px-5 py-2 text-sm font-bold text-white hover:bg-[#ff5625]/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">price_change</span>
                  {savingPlan ? t('portal.supervisor.dashboard.modal.saving') : t('portal.supervisor.dashboard.modal.apply_fixed_btn')}
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

    </PortalShell>
  );
}
