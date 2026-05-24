'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { getAllSupervisors, getAllTeamMembers, getUnassignedDealers, getDealerCurrentCommissions, setDealerFixedCommission, clearDealerFixedCommission } from '@/lib/portal-queries';
import type { SupervisorRow } from '@/lib/portal-queries';
import type { TeamMember, UnassignedDealer, DealerCurrentCommission } from '@/lib/portal-types';
import { toast } from 'sonner';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function AdminSupervisorsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState<UnassignedDealer[]>([]);
  const [editingDealer, setEditingDealer] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(async () => {
    const [sv, tm, ua] = await Promise.all([getAllSupervisors(), getAllTeamMembers(), getUnassignedDealers()]);
    setSupervisors(sv);
    setTeam(tm);
    setUnassigned(ua);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  const teamOf = (svId: string) => team.filter((t) => t.supervisor_id === svId);
  const agg = (svId: string) => {
    const ts = teamOf(svId);
    return {
      dealers: ts.length,
      month: ts.reduce((s, t) => s + Number(t.month_sales), 0),
      units: ts.reduce((s, t) => s + Number(t.units_ytd), 0),
      pending: ts.reduce((s, t) => s + Number(t.orders_pending), 0),
    };
  };

  const totalDealers = team.length;
  const totalMonth = team.reduce((s, t) => s + Number(t.month_sales), 0);
  const totalUnits = team.reduce((s, t) => s + Number(t.units_ytd), 0);

  return (
    <PortalShell variant="admin" nav={<AdminNav />}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.supervisors.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-4xl">{t('portal.admin.supervisors.title')}</h1>
        <p className="mt-2 text-sm text-[#e7eaf0]/60">{t('portal.admin.supervisors.subtitle')}</p>
      </div>

      {/* Overall */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: t('portal.admin.supervisors.stat.supervisors'), value: supervisors.length },
          { label: t('portal.admin.supervisors.stat.dealers_in_team'), value: totalDealers },
          { label: t('portal.admin.supervisors.stat.month_sales'), value: fmtVnd(totalMonth) },
          { label: t('portal.admin.supervisors.stat.month_units'), value: totalUnits },

        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{k.label}</p>
            <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Supervisor list */}
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
            <tr>
              <th className="px-4 py-3">{t('portal.admin.supervisors.table.supervisor')}</th>
              <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.dealers')}</th>
              <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.month_sales')}</th>
              <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.month_units')}</th>
              <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.pending_orders')}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {supervisors.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#e7eaf0]/50">{t('portal.admin.supervisors.empty')}</td></tr>
            ) : supervisors.map((sv) => {
              const a = agg(sv.id);
              const open = openId === sv.id;
              return (
                <Fragment key={sv.id}>
                  <tr className="border-t border-[#1f2937]/40 hover:bg-[#1a1f26]/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sv.full_name ?? t('portal.admin.supervisors.unnamed')}</p>
                      <p className="text-[11px] text-[#e7eaf0]/50">{sv.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{a.dealers}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(a.month)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{a.units}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#ff5625]">{a.pending}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpenId(open ? null : sv.id)} className="text-xs text-[#ff5625] hover:underline">
                        {open ? t('portal.admin.supervisors.action.hide_team') : t('portal.admin.supervisors.action.view_team')}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-t border-[#1f2937]/40 bg-[#0a0c0f]">
                      <td colSpan={6} className="px-4 py-4">
                        {a.dealers === 0 ? (
                          <p className="text-center text-xs text-[#e7eaf0]/50">{t('portal.admin.supervisors.empty_branch')}</p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">
                              <tr>
                                <th className="px-3 py-2">{t('portal.admin.supervisors.table.dealer')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.month_sales')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.month_units')}</th>
                                <th className="px-3 py-2 text-right">{t('portal.admin.supervisors.table.pending_orders')}</th>
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamOf(sv.id).map((member) => (
                                <tr key={member.dealer_id} className="border-t border-[#1f2937]/40">
                                  <td className="px-3 py-2">{member.dealer_name ?? t('portal.admin.supervisors.unnamed')}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtVnd(Number(member.month_sales))}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{member.units_ytd}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{member.orders_pending}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => setEditingDealer({ id: member.dealer_id, name: member.dealer_name ?? '' })}
                                      className="text-xs text-[#ff5625] hover:underline"
                                    >
                                      {t('portal.admin.supervisors.action.edit_commission')}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unassigned dealers */}
      <div className="mt-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.supervisors.unassigned.title')}</p>
        <p className="mt-1 text-xs text-[#e7eaf0]/50">{t('portal.admin.supervisors.unassigned.subtitle')}</p>
        <div className="mt-4 overflow-x-auto overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
              <tr>
                <th className="px-4 py-3">{t('portal.admin.supervisors.table.dealer')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.month_sales')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.month_units')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.supervisors.table.pending_orders')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {unassigned.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-[#e7eaf0]/50">{t('portal.admin.supervisors.unassigned.empty')}</td></tr>
              ) : unassigned.map((d) => (
                <tr key={d.dealer_id} className="border-t border-[#1f2937]/40 hover:bg-[#1a1f26]/40">
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.dealer_name ?? t('portal.admin.supervisors.unnamed')}</p>
                    <p className="text-[11px] text-[#e7eaf0]/50">#{d.dealer_account_no ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(Number(d.month_sales))}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{d.units_ytd}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#ff5625]">{d.orders_pending}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingDealer({ id: d.dealer_id, name: d.dealer_name ?? '' })}
                      className="text-xs text-[#ff5625] hover:underline"
                    >
                      {t('portal.admin.supervisors.action.edit_commission')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingDealer && (
        <CommissionEditModal
          dealerId={editingDealer.id}
          dealerName={editingDealer.name}
          onClose={() => setEditingDealer(null)}
          onSaved={() => { setEditingDealer(null); void refresh(); }}
        />
      )}
    </PortalShell>
  );
}

const MIN_FIXED = 4_500_000;
const MAX_FIXED = 7_500_000;
const STEP_FIXED = 100_000;

function CommissionEditModal({
  dealerId,
  dealerName,
  onClose,
  onSaved,
}: {
  dealerId: string;
  dealerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [comm, setComm] = useState<DealerCurrentCommission | null>(null);
  const [amount, setAmount] = useState(MIN_FIXED);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDealerCurrentCommissions([dealerId]).then((map) => {
      const c = map[dealerId] ?? null;
      setComm(c);
      if (c?.source === 'fixed' && c.override_amount) setAmount(c.override_amount);
    });
  }, [dealerId]);

  const save = async () => {
    setBusy(true);
    try {
      await setDealerFixedCommission(dealerId, amount);
      toast.success(t('portal.admin.supervisors.toast.commission_saved'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.admin.supervisors.toast.commission_error'));
    } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await clearDealerFixedCommission(dealerId);
      toast.success(t('portal.admin.supervisors.toast.commission_cleared'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.admin.supervisors.toast.commission_error'));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/60 bg-[#0d1117] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
          {t('portal.admin.supervisors.modal.title_prefix')} {dealerName || t('portal.admin.supervisors.unnamed')}
        </p>

        {comm === null ? (
          <p className="mt-4 text-sm text-[#e7eaf0]/60">{t('portal.admin.supervisors.modal.loading')}</p>
        ) : (
          <>
            {/* Tier auto */}
            <div className="mt-4 rounded-xl border border-[#10b981]/30 bg-[#10b981]/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#10b981]">{t('portal.admin.supervisors.modal.tier_label')}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="font-headline text-lg">{comm.tier_label}</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-[#10b981]">
                  {comm.tier_percent}% <span className="text-xs font-normal text-[#e7eaf0]/40">{t('portal.admin.supervisors.modal.tier_of_sale')}</span>
                </p>
              </div>
            </div>

            {/* Fixed override */}
            <div className="mt-3 rounded-xl border border-[#ff5625]/30 bg-[#ff5625]/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#ff5625]">{t('portal.admin.supervisors.modal.fixed_label')}</p>
                {comm.source === 'fixed' && (
                  <span className="rounded-full bg-[#ff5625]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5625]">
                    {t('portal.admin.supervisors.modal.fixed_active_badge')}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[11px] text-[#e7eaf0]/50">{t('portal.admin.supervisors.modal.fixed_amount_per_unit')}</span>
                <span className="font-mono text-xl font-bold tabular-nums text-[#ff5625]">
                  {amount.toLocaleString('vi-VN')} <span className="text-sm text-[#e7eaf0]/50">₫</span>
                </span>
              </div>
              <input
                type="range" min={MIN_FIXED} max={MAX_FIXED} step={STEP_FIXED}
                value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-2 w-full accent-[#ff5625]"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[#e7eaf0]/40">
                <span>{MIN_FIXED.toLocaleString('vi-VN')} ₫</span>
                <span>{MAX_FIXED.toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number" min={MIN_FIXED} max={MAX_FIXED} step={100_000}
                  value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                  className="flex-1 rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-1.5 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]"
                />
                <button
                  onClick={save} disabled={busy || amount < MIN_FIXED || amount > MAX_FIXED}
                  className="rounded-lg bg-[#ff5625] px-4 py-2 text-xs font-bold text-white hover:bg-[#ff5625]/90 disabled:opacity-50"
                >
                  {t('portal.admin.supervisors.modal.save_btn')}
                </button>
              </div>
              {comm.source === 'fixed' && (
                <button
                  onClick={clear} disabled={busy}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1f2937]/50 px-3 py-2 text-[11px] text-[#e7eaf0]/70 hover:border-[#10b981]/40 hover:text-[#10b981] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">backspace</span>
                  {t('portal.admin.supervisors.modal.clear_btn')}
                </button>
              )}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-[#1f2937]/50 py-2 text-xs text-[#e7eaf0]/60 hover:text-[#e7eaf0]"
        >
          {t('portal.admin.supervisors.modal.cancel_btn')}
        </button>
      </div>
    </div>
  );
}
