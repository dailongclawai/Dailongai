'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getMyStaffCommissions, adminPayStaffCommission, releaseDueCommissions } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import type { CrmStaffCommission, CrmCommissionStatus } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

const STATUS_COLOR: Record<CrmCommissionStatus, string> = {
  pending: 'text-[#ff5625]',
  payable: 'text-[#00daf3]',
  paid: 'text-[#34d399]',
  void: 'text-[var(--crm-muted)]',
};

export default function CrmCommissionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmStaffCommission[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  // Boss chốt 28/07/2026: CRM chỉ mở cho staff và admin
  useEffect(() => {
    if (!loading && profile && profile.role !== 'staff' && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await getMyStaffCommissions());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const totals = useMemo(() => {
    const sum = (s: CrmCommissionStatus) =>
      rows.filter(r => r.status === s).reduce((acc, r) => acc + Number(r.amount), 0);
    return {
      pending: sum('pending'),
      payable: sum('payable'),
      paid: sum('paid'),
      all: rows.reduce((acc, r) => acc + Number(r.amount), 0),
    };
  }, [rows]);

  const isAdmin = profile?.role === 'admin';


  const release = async () => {
    try {
      const n = await releaseDueCommissions();
      toast.success(`${t('portal.crm.commission.released')}: ${n}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const pay = async (id: string) => {
    const ref = window.prompt(t('portal.crm.commission.payment_ref'));
    if (!ref) return;
    try {
      await adminPayStaffCommission(id, ref);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || !profile) return null;

  const cards: Array<{ key: string; label: string; value: number; tone: string }> = [
    { key: 'pending', label: t('portal.crm.commission.pending'), value: totals.pending, tone: 'text-[#ff5625]' },
    { key: 'payable', label: t('portal.crm.commission.payable'), value: totals.payable, tone: 'text-[#00daf3]' },
    { key: 'paid', label: t('portal.crm.commission.paid'), value: totals.paid, tone: 'text-[#34d399]' },
    { key: 'total', label: t('portal.crm.commission.total'), value: totals.all, tone: 'text-[var(--crm-text)]' },
  ];

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.commission.title')}</h1>
        {isAdmin && (
          <button
            onClick={() => void release()}
            className="rounded-xl border border-[#00daf3] px-4 py-2 text-sm text-[#00daf3]"
          >
            {t('portal.crm.commission.release')}
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(c => (
          <div key={c.key} className="rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s2)] p-4">
            <p className="text-xs text-[var(--crm-muted)]">{c.label}</p>
            <p className={`mt-1 text-lg font-bold ${c.tone}`}>{fmtVnd(c.value)}đ</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.commission.col_date')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.col_deal')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.col_base')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.col_rate')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.col_amount')}</th>
              <th className="px-4 py-3">{t('portal.crm.commission.col_status')}</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.commission.empty')}</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-[var(--crm-line)]">
                <td className="px-4 py-3 text-[var(--crm-muted)]">{new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3 font-mono text-[#00daf3]">{r.opportunity_id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{fmtVnd(Number(r.order_value))}đ</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{(Number(r.rate) * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 font-bold text-[var(--crm-text)]">{fmtVnd(Number(r.amount))}đ</td>
                <td className={`px-4 py-3 ${STATUS_COLOR[r.status]}`}>
                  {t('portal.crm.commission.' + r.status)}
                  {r.status === 'pending' && (
                    <span className="mt-0.5 block text-xs text-[var(--crm-muted)]">
                      {t('portal.crm.commission.waiting_trial')}{' '}
                      {new Date(r.eligible_at).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {(r.status === 'payable'
                      || (r.status === 'pending' && new Date(r.eligible_at) <= new Date())) && (
                      <button onClick={() => void pay(r.id)} className="rounded-lg border border-[var(--crm-line)] px-3 py-1.5 text-xs text-[var(--crm-text)] hover:border-[#34d399]">
                        {t('portal.crm.commission.mark_paid')}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
