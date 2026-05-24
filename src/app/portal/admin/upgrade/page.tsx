'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { AccountIdBadge } from '@/components/portal/AccountIdBadge';

interface Row {
  id: string;
  account_no: number | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

export default function AdminUpgradePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await getSupabaseClient()
      .from('profiles')
      .select('id, account_no, full_name, email, role')
      .order('role');
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  const upgrade = async (id: string) => {
    if (!id.trim()) {
      toast.error(t('portal.admin.upgrade.toast.missing_id'));
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_set_supervisor', { p_user_id: id.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('portal.admin.upgrade.toast.upgraded'));
    setUserId('');
    await refresh();
  };

  const downgrade = async (id: string, name: string | null) => {
    if (!confirm(t('portal.admin.upgrade.confirm.downgrade').replace('{name}', name ?? id))) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_set_dealer', { p_user_id: id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('portal.admin.upgrade.toast.downgraded'));
    await refresh();
  };

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.upgrade.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-4xl">{t('portal.admin.upgrade.title')}</h1>
      </div>

      <div className="mb-8 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/60">{t('portal.admin.upgrade.input.label')}</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={t('portal.admin.upgrade.input.placeholder')}
            className="w-full rounded-lg border border-[#1f2937]/40 bg-[#11151a] px-3 py-2 text-sm outline-none focus:border-[#ff5625] font-mono tabular-nums"
          />
        </div>
        <button
          onClick={() => upgrade(userId)}
          disabled={busy}
          className="rounded-full bg-[#ff5625] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50"
        >
          {t('portal.admin.upgrade.action.promote')}
        </button>
      </div>

      <div className="overflow-x-auto portal-scroll rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
            <tr>
              <th className="px-4 py-3">{t('portal.admin.upgrade.table.identity')}</th>
              <th className="px-4 py-3">{t('portal.admin.upgrade.table.email')}</th>
              <th className="px-4 py-3">{t('portal.admin.upgrade.table.role')}</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#1f2937]/40 hover:bg-[#1a1f26]/40">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.full_name ?? r.email ?? t('portal.admin.upgrade.row.unnamed')}</p>
                  <div className="mt-0.5"><AccountIdBadge accountNo={r.account_no} id={r.id} /></div>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#e7eaf0]/60">{r.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    r.role === 'admin' ? 'border border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]'
                    : r.role === 'supervisor' ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : r.role === 'dealer' ? 'border border-[#1f2937]/60 bg-[#1a1f26] text-[#9ca3af]'
                    : 'text-[#9ca3af]/60'
                  }`}>{r.role ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.role === 'dealer' && (
                    <button
                      onClick={() => upgrade(r.id)}
                      disabled={busy}
                      className="rounded-full border border-[#1f2937]/60 px-3 py-1.5 text-xs font-medium text-[#e7eaf0] hover:border-[#ff5625] hover:text-[#ff5625] disabled:opacity-50"
                    >
                      {t('portal.admin.upgrade.action.promote')}
                    </button>
                  )}
                  {r.role === 'supervisor' && (
                    <button
                      onClick={() => downgrade(r.id, r.full_name)}
                      disabled={busy}
                      className="rounded-full border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-400 hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      {t('portal.admin.upgrade.action.demote')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
