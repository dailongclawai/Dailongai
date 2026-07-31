'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmStaffReport } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import type { CrmStaffReportRow } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function CrmReportsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmStaffReportRow[]>([]);
  const [busy, setBusy] = useState(true);

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
      setRows(await getCrmStaffReport());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session && profile?.role === 'admin') void load();
  }, [session, profile, load]);

  const totals = useMemo(() => ({
    won: rows.reduce((a, r) => a + Number(r.deals_won), 0),
    open: rows.reduce((a, r) => a + Number(r.deals_open), 0),
    total: rows.reduce((a, r) => a + Number(r.commission_total), 0),
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
              <tr><td colSpan={9} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.reports.empty')}</td></tr>
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
                <td className="px-4 py-3 text-[#00daf3]">{fmtVnd(totals.payable)}đ</td>
                <td className="px-4 py-3 text-[#34d399]">{fmtVnd(totals.paid)}đ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
