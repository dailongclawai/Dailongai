'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  getCrmLostReasonReport, getCrmMonthlyReport, getCrmReconIssues, getCrmSettings,
  getCrmSourceReport, getCrmStaffReport, updateCrmSettings,
} from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { HBarList, MonthlyBarChart } from '@/components/portal/CrmReportCharts';
import type {
  CrmLostReasonReportRow, CrmMonthlyReportRow, CrmReconIssue, CrmSettings,
  CrmSourceReportRow, CrmStaffReportRow,
} from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function CrmReportsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmStaffReportRow[]>([]);
  const [issues, setIssues] = useState<CrmReconIssue[]>([]);
  const [monthly, setMonthly] = useState<CrmMonthlyReportRow[]>([]);
  const [lostReasons, setLostReasons] = useState<CrmLostReasonReportRow[]>([]);
  const [sources, setSources] = useState<CrmSourceReportRow[]>([]);
  const [busy, setBusy] = useState(true);
  // Cấu hình giữ dạng chữ trong ô nhập, chỉ đổi ra số lúc lưu — gõ dở "1"
  // trên đường tới "15" mà ép số ngay thì ô nhảy lung tung.
  const [rate, setRate] = useState('');
  const [minDisc, setMinDisc] = useState('');
  const [staleDays, setStaleDays] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  // Boss chốt 28/07/2026: báo cáo tổng hợp CHỈ admin
  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [report, recon, cfg, byMonth, byReason, bySource] = await Promise.all([
        getCrmStaffReport(), getCrmReconIssues(), getCrmSettings(),
        getCrmMonthlyReport(), getCrmLostReasonReport(), getCrmSourceReport(),
      ]);
      setRows(report);
      setIssues(recon);
      setMonthly(byMonth);
      setLostReasons(byReason);
      setSources(bySource);
      if (cfg) {
        setRate(String(Math.round(cfg.staff_rate * 1000) / 10));
        setMinDisc(String(Math.round(cfg.dealer_discount_min * 1000) / 10));
        setStaleDays(String(cfg.followup_stale_days));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const saveCfg = async () => {
    const staffRate = Number(rate) / 100;
    const discMin = Number(minDisc) / 100;
    const days = Math.round(Number(staleDays));
    if (!(staffRate > 0 && staffRate <= 1) || !(discMin >= 0 && discMin < 1) || !(days >= 1 && days <= 90)) {
      toast.error(t('portal.crm.settings.invalid'));
      return;
    }
    setSavingCfg(true);
    try {
      await updateCrmSettings({ staff_rate: staffRate, dealer_discount_min: discMin, followup_stale_days: days });
      toast.success(t('portal.crm.settings.saved'));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingCfg(false);
    }
  };

  useEffect(() => {
    if (session && profile?.role === 'admin') void load();
  }, [session, profile, load]);

  const totals = useMemo(() => ({
    won: rows.reduce((a, r) => a + Number(r.deals_won), 0),
    open: rows.reduce((a, r) => a + Number(r.deals_open), 0),
    total: rows.reduce((a, r) => a + Number(r.commission_total), 0),
    pending: rows.reduce((a, r) => a + Number(r.amount_pending), 0),
    payable: rows.reduce((a, r) => a + Number(r.amount_payable), 0),
    paid: rows.reduce((a, r) => a + Number(r.amount_paid), 0),
  }), [rows]);

  if (loading || !profile || profile.role !== 'admin') return null;

  return (
    <PortalShell variant="admin">
      <CrmNav />
      <h1 className="mb-5 text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.reports.title')}</h1>

      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.reports.col_staff')}</th>
              <th className="px-4 py-3">{t('portal.crm.reports.col_segment')}</th>
              <th className="px-4 py-3">{t('portal.crm.reports.col_won')}</th>
              <th className="px-4 py-3">{t('portal.crm.reports.col_open')}</th>
              <th className="px-4 py-3">{t('portal.crm.reports.col_commission')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.pending')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.payable')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.paid')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.reports.empty')}</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.staff_id} className="border-t border-[var(--crm-line)]">
                <td className="px-4 py-3 text-[var(--crm-text)]">{r.staff_name || r.staff_email || r.staff_id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">
                  {r.staff_segment ? r.staff_segment.toUpperCase() : '—'}
                </td>
                <td className="px-4 py-3 text-[#34d399]">{r.deals_won}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.deals_open}</td>
                <td className="px-4 py-3 text-[var(--crm-text)]">{fmtVnd(Number(r.commission_total))}đ</td>
                <td className="px-4 py-3 text-[#ff5625]">{fmtVnd(Number(r.amount_pending))}đ</td>
                <td className="px-4 py-3 text-[#00daf3]">{fmtVnd(Number(r.amount_payable))}đ</td>
                <td className="px-4 py-3 text-[#34d399]">{fmtVnd(Number(r.amount_paid))}đ</td>
              </tr>
            ))}
            {!busy && rows.length > 0 && (
              <tr className="border-t-2 border-[var(--crm-line)] bg-[var(--crm-s1)] font-bold">
                <td className="px-4 py-3 text-[var(--crm-text)]">{t('portal.crm.commission.total')}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-[#34d399]">{totals.won}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{totals.open}</td>
                <td className="px-4 py-3 text-[var(--crm-text)]">{fmtVnd(totals.total)}đ</td>
                <td className="px-4 py-3 text-[#ff5625]">{fmtVnd(totals.pending)}đ</td>
                <td className="px-4 py-3 text-[#00daf3]">{fmtVnd(totals.payable)}đ</td>
                <td className="px-4 py-3 text-[#34d399]">{fmtVnd(totals.paid)}đ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Doanh số theo tháng — mốc cắt theo giờ Việt Nam, 12 tháng gần nhất */}
      <h2 className="crm-display mt-8 mb-3 text-[18px] font-medium text-[var(--crm-text)]">
        {t('portal.crm.reports.monthly_title')}
      </h2>
      {!busy && monthly.some(m => Number(m.won_value) > 0) && (
        <div className="mb-3 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4">
          <MonthlyBarChart
            ariaLabel={t('portal.crm.reports.monthly_title')}
            data={[...monthly].reverse().map(m => ({
              label: new Date(m.thang).toLocaleDateString('vi-VN', { month: '2-digit', year: '2-digit' }),
              value: Number(m.won_value),
              hint: `${new Date(m.thang).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}: `
                + `${fmtVnd(Number(m.won_value))}đ · ${m.deals_won} deal · ${m.new_accounts} khách mới`,
            }))}
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.reports.col_month')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_new_accounts')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_won')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_won_value')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_commission')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {/* Tháng nào cũng in kể cả bằng 0, nhưng cả năm trắng thì báo trống */}
            {!busy && monthly.every(m => m.deals_won === 0 && m.new_accounts === 0 && Number(m.commission_total) === 0) && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.reports.empty_data')}</td></tr>
            )}
            {!busy && !monthly.every(m => m.deals_won === 0 && m.new_accounts === 0 && Number(m.commission_total) === 0) && monthly.map(m => (
              <tr key={m.thang} className="border-t border-[var(--crm-line)]">
                <td className="px-4 py-3 font-mono text-[var(--crm-text)]">
                  {new Date(m.thang).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--crm-muted)]">{m.new_accounts}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#34d399]">{m.deals_won}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">{fmtVnd(Number(m.won_value))}đ</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#00daf3]">{fmtVnd(Number(m.commission_total))}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hiệu quả theo nguồn khách */}
      <h2 className="crm-display mt-8 mb-3 text-[18px] font-medium text-[var(--crm-text)]">
        {t('portal.crm.reports.source_title')}
      </h2>
      {!busy && sources.length > 0 && (
        <div className="mb-3 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4">
          <HBarList
            color="#00daf3"
            data={sources.map(s => ({
              label: s.source ? t('portal.crm.source.' + s.source) : t('portal.crm.reports.no_source'),
              value: s.accounts,
              hint: `${s.deals_won} deal thắng · ${fmtVnd(Number(s.won_value))}đ`,
            }))}
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.reports.col_source')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_accounts')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_won')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_won_value')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && sources.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.reports.empty_data')}</td></tr>
            )}
            {sources.map(s => (
              <tr key={s.source ?? 'none'} className="border-t border-[var(--crm-line)]">
                <td className="px-4 py-3 text-[var(--crm-text)]">
                  {s.source ? t('portal.crm.source.' + s.source) : t('portal.crm.reports.no_source')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--crm-muted)]">{s.accounts}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#34d399]">{s.deals_won}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">{fmtVnd(Number(s.won_value))}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lý do không mua */}
      <h2 className="crm-display mt-8 mb-3 text-[18px] font-medium text-[var(--crm-text)]">
        {t('portal.crm.reports.lost_title')}
      </h2>
      {!busy && lostReasons.length > 0 && (
        <div className="mb-3 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4">
          <HBarList
            color="#f87171"
            data={lostReasons.map(r => ({
              label: r.name,
              value: r.deals_lost,
              hint: `${fmtVnd(Number(r.lost_value))}đ`,
            }))}
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.reports.col_reason')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_count')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.reports.col_lost_value')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && lostReasons.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.reports.empty_data')}</td></tr>
            )}
            {lostReasons.map(r => (
              <tr key={r.name} className="border-t border-[var(--crm-line)]">
                <td className="px-4 py-3 text-[var(--crm-text)]">{r.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#f87171]">{r.deals_lost}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">{fmtVnd(Number(r.lost_value))}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Đối soát: bán ngoài sổ và giá lệch bảng giá */}
      <div className="mt-8 mb-3 flex flex-wrap items-center gap-3">
        <h2 className="crm-display mr-auto text-[18px] font-medium text-[var(--crm-text)]">
          {t('portal.crm.recon.title')}
        </h2>
        <span className={`rounded-full px-3 py-1 text-xs ${issues.length > 0
          ? 'bg-[#f87171]/10 text-[#f87171]'
          : 'bg-[#34d399]/10 text-[#34d399]'}`}>
          {issues.length > 0 ? `${issues.length} ${t('portal.crm.recon.flagged')}` : t('portal.crm.recon.clean')}
        </span>
      </div>
      <p className="mb-3 text-xs text-[var(--crm-muted)]">{t('portal.crm.recon.hint')}</p>

      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.recon.col_issue')}</th>
              <th className="px-4 py-3">{t('portal.crm.recon.col_ref')}</th>
              <th className="px-4 py-3">{t('portal.crm.recon.col_party')}</th>
              <th className="px-4 py-3">{t('portal.crm.recon.col_who')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.recon.col_amount')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.recon.col_expected')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && issues.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.recon.empty')}</td></tr>
            )}
            {issues.map(i => (
              <tr key={`${i.issue}-${i.ref_id}`} className="border-t border-[var(--crm-line)]">
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[#f87171]/10 px-2.5 py-1 text-xs text-[#f87171]">
                    {t('portal.crm.recon.issue_' + i.issue)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--crm-text)]">
                  {i.title}
                  {i.ref_code && <span className="ml-2 font-mono text-xs text-[var(--crm-muted)]">{i.ref_code}</span>}
                </td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{i.party_name ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{i.who ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">
                  {fmtVnd(Number(i.amount))}đ
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#00daf3]">
                  {i.expected_amount ? `${fmtVnd(Number(i.expected_amount))}đ` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cấu hình CRM — trước đây chỉ sửa được bằng SQL tay */}
      <div className="mt-8 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-5">
        <h2 className="crm-display mb-1 text-[18px] font-medium text-[var(--crm-text)]">
          {t('portal.crm.settings.title')}
        </h2>
        <p className="mb-4 text-xs text-[var(--crm-muted)]">{t('portal.crm.settings.hint')}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="cfg-rate">
              {t('portal.crm.settings.staff_rate')}
            </label>
            <input
              id="cfg-rate" type="number" min={0.1} max={100} step={0.1} value={rate}
              onChange={e => setRate(e.target.value)}
              className="w-32 rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s2)] px-3 py-2 text-right font-mono tabular-nums text-[var(--crm-text)] outline-none focus:border-[#ff5625]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="cfg-disc">
              {t('portal.crm.settings.dealer_discount_min')}
            </label>
            <input
              id="cfg-disc" type="number" min={0} max={99} step={0.1} value={minDisc}
              onChange={e => setMinDisc(e.target.value)}
              className="w-32 rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s2)] px-3 py-2 text-right font-mono tabular-nums text-[var(--crm-text)] outline-none focus:border-[#ff5625]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="cfg-stale">
              {t('portal.crm.settings.followup_stale_days')}
            </label>
            <input
              id="cfg-stale" type="number" min={1} max={90} step={1} value={staleDays}
              onChange={e => setStaleDays(e.target.value)}
              className="w-32 rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s2)] px-3 py-2 text-right font-mono tabular-nums text-[var(--crm-text)] outline-none focus:border-[#ff5625]"
            />
          </div>
          <button
            onClick={() => void saveCfg()}
            disabled={savingCfg}
            className="rounded-xl bg-[#ff5625] px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {savingCfg ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </PortalShell>
  );
}
