'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  createCrmDemoLoan, createCrmDemoUnit, getActiveModels, getCrmAccounts, getCrmDemoLoans,
  getCrmDemoUnits, returnCrmDemoLoan, setCrmDemoUnitActive,
} from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import type { CrmAccount, CrmDemoLoan, CrmDemoUnit, ProductModel } from '@/lib/portal-types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const todayVn = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CrmDemoPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [units, setUnits] = useState<CrmDemoUnit[]>([]);
  const [loans, setLoans] = useState<CrmDemoLoan[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  // Form mượn
  const [unitId, setUnitId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = todayVn(); d.setDate(d.getDate() + 3); return isoDate(d);
  });
  const [purpose, setPurpose] = useState('');
  // Trả máy 2 bước để khỏi bấm nhầm
  const [returningId, setReturningId] = useState<string | null>(null);
  // Form thêm máy (admin)
  const [newSerial, setNewSerial] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newModelId, setNewModelId] = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!loading && profile && profile.role !== 'staff' && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [u, l, a, m] = await Promise.all([
        getCrmDemoUnits(), getCrmDemoLoans(),
        getCrmAccounts().catch(() => []),
        getActiveModels().catch(() => []),
      ]);
      setUnits(u); setLoans(l); setAccounts(a); setModels(m);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  // Phiếu đang mở theo máy — nguồn duy nhất quyết định máy rảnh hay đang mượn.
  const openLoanByUnit = useMemo(() => {
    const m = new Map<string, CrmDemoLoan>();
    for (const l of loans) if (!l.returned_at) m.set(l.unit_id, l);
    return m;
  }, [loans]);
  const freeUnits = useMemo(
    () => units.filter(u => u.active && !openLoanByUnit.has(u.id)),
    [units, openLoanByUnit],
  );
  const today = isoDate(todayVn());
  const isOverdue = (l: CrmDemoLoan) => !l.returned_at && l.due_date < today;

  const borrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId) { toast.error(t('portal.crm.demo.field_unit_placeholder')); return; }
    if (!dueDate) { toast.error(t('portal.crm.demo.err_due_required')); return; }
    setSaving(true);
    try {
      await createCrmDemoLoan({
        unitId, borrowerId: session!.user.id,
        accountId: accountId || null, dueDate, purpose,
      });
      toast.success(t('portal.crm.demo.toast_borrowed'));
      setUnitId(''); setAccountId(''); setPurpose('');
      await load();
    } catch (err) {
      toast.error((err as Error).message === 'demo_unit_taken'
        ? t('portal.crm.demo.err_unit_taken') : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doReturn = async (id: string) => {
    if (returningId !== id) { setReturningId(id); return; }
    setReturningId(null);
    try {
      await returnCrmDemoLoan(id);
      toast.success(t('portal.crm.demo.toast_returned'));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim() || !newLabel.trim()) return;
    setSaving(true);
    try {
      await createCrmDemoUnit({ serial: newSerial, label: newLabel, modelId: newModelId || null });
      toast.success(t('portal.crm.demo.toast_unit_added'));
      setNewSerial(''); setNewLabel(''); setNewModelId('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-sm text-[var(--crm-text)] outline-none [color-scheme:dark] focus:border-[#8bd6b6]';
  const label = 'mb-1 block text-xs uppercase tracking-wider text-[var(--crm-muted)]';
  const caps = 'text-[11px] uppercase tracking-[0.25em] text-[var(--crm-muted)]/70';

  const unitStatus = (u: CrmDemoUnit) => {
    if (!u.active) return <span className="rounded-full bg-[var(--crm-s3)] px-2.5 py-1 text-[11px] text-[var(--crm-muted)]">{t('portal.crm.demo.status_inactive')}</span>;
    const open = openLoanByUnit.get(u.id);
    if (!open) return <span className="rounded-full bg-[#8bd6b6]/10 px-2.5 py-1 text-[11px] font-semibold text-[#8bd6b6]">{t('portal.crm.demo.status_available')}</span>;
    if (isOverdue(open)) return <span className="rounded-full bg-[#f87171]/10 px-2.5 py-1 text-[11px] font-semibold text-[#f87171]">{t('portal.crm.demo.status_overdue')}</span>;
    return <span className="rounded-full bg-[#ffb77d]/10 px-2.5 py-1 text-[11px] font-semibold text-[#ffb77d]">{t('portal.crm.demo.status_out')}</span>;
  };

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-6">
        <h1 className="crm-display text-2xl font-bold tracking-tight text-[var(--crm-text)]">{t('portal.crm.demo.title')}</h1>
        <p className="mt-1 text-sm text-[var(--crm-muted)]">{t('portal.crm.demo.subtitle')}</p>
      </div>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}

      {/* Danh mục máy */}
      <p className={`${caps} mb-3`}>{t('portal.crm.demo.units_caps')}</p>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {units.map(u => {
          const open = openLoanByUnit.get(u.id);
          const model = models.find(m => m.id === u.model_id);
          return (
            <div key={u.id} className={`rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4 ${u.active ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--crm-text)]">{u.label}</p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--crm-muted)]">
                    {u.serial_number}{model ? ` · ${model.name}` : ''}
                  </p>
                </div>
                {unitStatus(u)}
              </div>
              {open && (
                <p className="mt-3 text-xs text-[var(--crm-muted)]">
                  {open.borrower?.full_name ?? '—'}
                  {open.account?.name ? ` → ${open.account.name}` : ''}
                  {' · '}
                  <span className={isOverdue(open) ? 'font-semibold text-[#f87171]' : 'text-[#ffb77d]'}>
                    {t('portal.crm.demo.col_due')} {fmtDate(open.due_date)}
                  </span>
                </p>
              )}
              {isAdmin && (
                <button
                  onClick={() => setCrmDemoUnitActive(u.id, !u.active).then(load).catch(e => toast.error((e as Error).message))}
                  className="mt-3 text-xs text-[var(--crm-muted)] underline-offset-2 hover:text-[#8bd6b6] hover:underline"
                >
                  {u.active ? t('portal.crm.demo.retire') : t('portal.crm.demo.restore')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Đăng ký mượn */}
        <form onSubmit={borrow} className="space-y-4 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-5">
          <h2 className="font-semibold text-[var(--crm-text)]">{t('portal.crm.demo.borrow_title')}</h2>
          <div>
            <label className={label} htmlFor="demo-unit">{t('portal.crm.demo.field_unit')}</label>
            <select id="demo-unit" className={field} value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">
                {freeUnits.length ? t('portal.crm.demo.field_unit_placeholder') : t('portal.crm.demo.no_units_free')}
              </option>
              {freeUnits.map(u => <option key={u.id} value={u.id}>{u.label} · {u.serial_number}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="demo-account">{t('portal.crm.demo.field_account')}</label>
            <select id="demo-account" className={field} value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">{t('portal.crm.demo.field_account_none')}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="demo-due">{t('portal.crm.demo.field_due')}</label>
              <input id="demo-due" type="date" min={today} className={field} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="demo-purpose">{t('portal.crm.demo.field_purpose')}</label>
              <input id="demo-purpose" className={field} value={purpose} onChange={e => setPurpose(e.target.value)} />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || freeUnits.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#065f46] px-4 py-2 font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">assignment_add</span>
            {t('portal.crm.demo.submit')}
          </button>
        </form>

        {/* Thêm máy (admin) */}
        {isAdmin && (
          <form onSubmit={addUnit} className="space-y-4 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-5">
            <h2 className="font-semibold text-[var(--crm-text)]">{t('portal.crm.demo.admin_add_caps')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="demo-new-serial">{t('portal.crm.demo.field_serial')}</label>
                <input id="demo-new-serial" className={field} value={newSerial} onChange={e => setNewSerial(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="demo-new-label">{t('portal.crm.demo.field_label')}</label>
                <input id="demo-new-label" className={field} value={newLabel} onChange={e => setNewLabel(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="demo-new-model">{t('portal.crm.opp.model')}</label>
              <select id="demo-new-model" className={field} value={newModelId} onChange={e => setNewModelId(e.target.value)}>
                <option value="">—</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !newSerial.trim() || !newLabel.trim()}
              className="flex items-center gap-2 rounded-xl border border-[#8bd6b6]/40 px-4 py-2 font-semibold text-[#8bd6b6] transition-colors hover:bg-[#8bd6b6]/10 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {t('portal.crm.demo.add_btn')}
            </button>
          </form>
        )}
      </div>

      {/* Phiếu mượn */}
      <p className={`${caps} mb-3`}>{t('portal.crm.demo.loans_caps')}</p>
      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--crm-line)] text-left text-[11px] uppercase tracking-wider text-[var(--crm-muted)]">
              <th className="px-4 py-3">{t('portal.crm.demo.col_unit')}</th>
              <th className="px-4 py-3">{t('portal.crm.demo.col_borrower')}</th>
              <th className="px-4 py-3">{t('portal.crm.demo.col_account')}</th>
              <th className="px-4 py-3">{t('portal.crm.demo.col_borrowed')}</th>
              <th className="px-4 py-3">{t('portal.crm.demo.col_due')}</th>
              <th className="px-4 py-3">{t('portal.crm.demo.col_status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--crm-muted)]">{t('portal.crm.demo.empty_loans')}</td></tr>
            )}
            {loans.map(l => {
              const canReturn = !l.returned_at && (isAdmin || l.borrower_id === session?.user.id);
              return (
                <tr key={l.id} className="border-b border-[var(--crm-line)]/40 transition-colors hover:bg-[var(--crm-s2)]">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[var(--crm-text)]">{l.unit?.label ?? '—'}</span>
                    <span className="ml-1.5 font-mono text-xs text-[var(--crm-muted)]">{l.unit?.serial_number}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--crm-text)]">{l.borrower?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--crm-muted)]">{l.account?.name ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--crm-muted)]">{fmtDate(l.borrowed_at)}</td>
                  <td className={`px-4 py-3 tabular-nums ${isOverdue(l) ? 'font-semibold text-[#f87171]' : 'text-[var(--crm-muted)]'}`}>{fmtDate(l.due_date)}</td>
                  <td className="px-4 py-3">
                    {l.returned_at ? (
                      <span className="text-[#8bd6b6]">{t('portal.crm.demo.returned_on')} {fmtDate(l.returned_at)}</span>
                    ) : isOverdue(l) ? (
                      <span className="font-semibold text-[#f87171]">{t('portal.crm.demo.status_overdue')}</span>
                    ) : (
                      <span className="text-[#ffb77d]">{t('portal.crm.demo.status_out')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canReturn && (
                      <button
                        onClick={() => void doReturn(l.id)}
                        onBlur={() => setReturningId(null)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          returningId === l.id
                            ? 'bg-[#065f46] text-white'
                            : 'border border-[#8bd6b6]/40 text-[#8bd6b6] hover:bg-[#8bd6b6]/10'
                        }`}
                      >
                        {returningId === l.id ? t('portal.crm.demo.return_confirm') : t('portal.crm.demo.return_btn')}
                      </button>
                    )}
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
