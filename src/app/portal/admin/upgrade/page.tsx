'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { adminSetStaff } from '@/lib/portal-queries';
import type { StaffSegment } from '@/lib/portal-types';
import { PortalShell } from '@/components/portal/PortalShell';
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
  const [staffId, setStaffId] = useState('');
  const [staffSegment, setStaffSegment] = useState<StaffSegment>('b2c');
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

  // Ô nhập tay nhận cả số tài khoản 6 chữ số lẫn UUID — nút copy trong bảng
  // copy số ngắn, nên chuỗi toàn chữ số phải tra profiles.account_no lấy UUID
  // trước khi gọi RPC (RPC chỉ nhận uuid).
  const resolveProfileId = async (raw: string): Promise<string> => {
    if (!/^\d+$/.test(raw)) return raw;
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('id')
      .eq('account_no', Number(raw))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(t('portal.admin.upgrade.toast.not_found').replace('{id}', raw));
    return (data as { id: string }).id;
  };

  const upgrade = async (id: string) => {
    if (!id.trim()) {
      toast.error(t('portal.admin.upgrade.toast.missing_id'));
      return;
    }
    setBusy(true);
    try {
      const pid = await resolveProfileId(id.trim());
      const { error } = await getSupabaseClient().rpc('admin_set_supervisor', { p_user_id: pid });
      if (error) throw error;
      toast.success(t('portal.admin.upgrade.toast.upgraded'));
      setUserId('');
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const assignStaff = async () => {
    if (!staffId.trim()) {
      toast.error(t('portal.admin.upgrade.toast.missing_id'));
      return;
    }
    setBusy(true);
    try {
      const pid = await resolveProfileId(staffId.trim());
      await adminSetStaff(pid, staffSegment);
      toast.success(t('portal.admin.upgrade.staff_done'));
      setStaffId('');
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
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
     
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff8a50]">{t('portal.admin.upgrade.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-4xl">{t('portal.admin.upgrade.title')}</h1>
      </div>

      <div className="mb-8 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60">{t('portal.admin.upgrade.input.label')}</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={t('portal.admin.upgrade.input.placeholder')}
            className="w-full rounded-lg border border-[#49443f]/40 bg-[#1a1c1f] px-3 py-2 text-sm outline-none focus:border-[#ff8a50] font-mono tabular-nums"
          />
        </div>
        <button
          onClick={() => upgrade(userId)}
          disabled={busy}
          className="rounded-full bg-[#e8692a] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e8692a]/90 disabled:opacity-50"
        >
          {t('portal.admin.upgrade.action.promote')}
        </button>
      </div>

      {/* Boss chốt 28/07/2026: CRM chỉ mở cho staff — admin gán vai trò ở đây */}
      <div className="mb-8 rounded-2xl border border-[#49443f]/40 bg-[#1a1c1f] p-4">
        <h2 className="mb-3 text-sm font-bold text-[#e2e2e6]">{t('portal.admin.upgrade.staff_title')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60" htmlFor="staff-user-id">
              {t('portal.admin.upgrade.input.label')}
            </label>
            <input
              id="staff-user-id"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder={t('portal.admin.upgrade.input.placeholder')}
              className="w-full rounded-lg border border-[#49443f]/40 bg-[#1a1c1f] px-3 py-2 text-sm font-mono tabular-nums outline-none focus:border-[#ff8a50]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/60" htmlFor="staff-segment">
              {t('portal.admin.upgrade.staff_segment')}
            </label>
            <select
              id="staff-segment"
              value={staffSegment}
              onChange={(e) => setStaffSegment(e.target.value as StaffSegment)}
              className="rounded-lg border border-[#49443f]/40 bg-[#1a1c1f] px-3 py-2 text-sm outline-none focus:border-[#ff8a50]"
            >
              <option value="b2c">{t('portal.crm.segment.b2c')}</option>
              <option value="b2b">{t('portal.crm.segment.b2b')}</option>
            </select>
          </div>
          <button
            onClick={() => void assignStaff()}
            disabled={busy}
            className="rounded-full bg-[#d97706] px-5 py-2.5 text-sm font-medium text-[#0c0e10] transition-colors hover:bg-[#d97706]/90 disabled:opacity-50"
          >
            {t('portal.admin.upgrade.staff_submit')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto portal-scroll rounded-2xl border border-[#49443f]/40 bg-[#1a1c1f]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#49443f]/40 bg-[#1e2023]/40 text-[10px] uppercase tracking-wider text-[#e2e2e6]/60">
            <tr>
              <th className="px-4 py-3">{t('portal.admin.upgrade.table.identity')}</th>
              <th className="px-4 py-3">{t('portal.admin.upgrade.table.email')}</th>
              <th className="px-4 py-3">{t('portal.admin.upgrade.table.role')}</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#49443f]/40 hover:bg-[#1e2023]/40">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.full_name ?? r.email ?? t('portal.admin.upgrade.row.unnamed')}</p>
                  <div className="mt-0.5"><AccountIdBadge accountNo={r.account_no} id={r.id} /></div>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#e2e2e6]/60">{r.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    r.role === 'admin' ? 'border border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]'
                    : r.role === 'supervisor' ? 'border border-orange-500/30 bg-orange-500/10 text-orange-400'
                    : r.role === 'dealer' ? 'border border-[#49443f]/60 bg-[#1e2023] text-[#b3aca8]'
                    : 'text-[#b3aca8]/60'
                  }`}>{r.role ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.role === 'dealer' && (
                    <button
                      onClick={() => upgrade(r.id)}
                      disabled={busy}
                      className="rounded-full border border-[#49443f]/60 px-3 py-1.5 text-xs font-medium text-[#e2e2e6] hover:border-[#ff8a50] hover:text-[#ff8a50] disabled:opacity-50"
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
