'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { AccountIdBadge } from '@/components/portal/AccountIdBadge';
import { toast } from 'sonner';
import type { Profile, ProductModel, ProfileRole } from '@/lib/portal-types';

export default function RegistrationsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [pending, setPending] = useState<Profile[]>([]);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    setFetching(true);
    const client = getSupabaseClient();
    const [{ data: p }, { data: sv }, { data: m }] = await Promise.all([
      client.from('profiles').select('*').is('role', null).eq('status', 'pending').order('created_at', { ascending: false }),
      client.from('profiles').select('*').eq('role', 'supervisor').eq('status', 'active'),
      client.from('product_models').select('*').eq('active', true).order('code'),
    ]);
    setPending((p as Profile[]) ?? []);
    setSupervisors((sv as Profile[]) ?? []);
    setModels((m as ProductModel[]) ?? []);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.admin.registrations.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-4xl">{t('portal.admin.registrations.title')}</h1>
      </div>
      {fetching ? (
        <p className="text-[#e7eaf0]/60">{t('portal.admin.registrations.loading')}</p>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#1f2937]/50 p-12 text-center text-sm text-[#e7eaf0]/60">
          {t('portal.admin.registrations.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto portal-scroll rounded-2xl border border-[#1f2937]/40 bg-[#11151a] backdrop-blur">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
              <tr>
                <th className="px-4 py-3">{t('portal.admin.registrations.table.profile')}</th>
                <th className="px-4 py-3">{t('portal.admin.registrations.table.role')}</th>
                <th className="px-4 py-3">{t('portal.admin.registrations.table.supervisor')}</th>
                <th className="px-4 py-3">{t('portal.admin.registrations.table.commission')}</th>
                <th className="px-4 py-3 text-right">{t('portal.admin.registrations.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <RegistrationRow
                  key={p.id}
                  profile={p}
                  supervisors={supervisors}
                  models={models}
                  onResolved={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}

function RegistrationRow({
  profile,
  supervisors,
  models,
  onResolved,
}: {
  profile: Profile;
  supervisors: Profile[];
  models: ProductModel[];
  onResolved: () => void;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState<ProfileRole>('dealer');
  const [supervisorId, setSupervisorId] = useState('');
  const [commissionType, setCommissionType] = useState<'fixed' | 'percent'>('percent');
  const [rateValue, setRateValue] = useState('15');
  const [modelId, setModelId] = useState('');
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_approve_registration', {
      p_profile_id: profile.id,
      p_role: role,
      p_supervisor_id: role === 'dealer' && supervisorId ? supervisorId : null,
      p_commission_type: commissionType,
      p_rate_value: Number(rateValue),
      p_model_id: modelId || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${t('portal.admin.registrations.toast.approved_prefix')} ${profile.email ?? profile.full_name ?? t('portal.admin.registrations.toast.approved_fallback')}`);
      onResolved();
    }
  };

  const reject = async () => {
    const reason = window.prompt(t('portal.admin.registrations.prompt.reject_reason'));
    if (!reason) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_reject_registration', {
      p_profile_id: profile.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t('portal.admin.registrations.toast.rejected'));
      onResolved();
    }
  };

  return (
    <tr className="border-t border-[#1f2937]/40 hover:bg-[#1a1f26]/40">
      <td className="px-4 py-3">
        <p className="font-medium">{profile.full_name ?? t('portal.admin.registrations.row.no_name')}</p>
        <div className="mt-0.5">
          <AccountIdBadge accountNo={profile.account_no} id={profile.id} />
        </div>
        <p className="mt-1 text-[11px] text-[#e7eaf0]/60">{profile.email ?? '—'}</p>
        <p className="text-[11px] text-[#e7eaf0]/60 font-mono tabular-nums">{profile.phone ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProfileRole)}
          className="rounded-md border border-[#1f2937]/40 bg-[#11151a] px-2 py-1 text-xs"
        >
          <option value="dealer">{t('portal.admin.registrations.role.dealer')}</option>
          <option value="supervisor">{t('portal.admin.registrations.role.supervisor')}</option>
          <option value="admin">{t('portal.admin.registrations.role.admin')}</option>
        </select>
      </td>
      <td className="px-4 py-3">
        {role === 'dealer' ? (
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="rounded-md border border-[#1f2937]/40 bg-[#11151a] px-2 py-1 text-xs"
          >
            <option value="">{t('portal.admin.registrations.supervisor.unassigned')}</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.email}
              </option>
            ))}
          </select>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        {role === 'dealer' ? (
          <div className="flex items-center gap-1.5">
            <select
              value={commissionType}
              onChange={(e) => setCommissionType(e.target.value as 'fixed' | 'percent')}
              className="rounded-md border border-[#1f2937]/40 bg-[#11151a] px-1.5 py-1 text-[11px]"
            >
              <option value="percent">%</option>
              <option value="fixed">VND</option>
            </select>
            <input
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              className="w-20 rounded-md border border-[#1f2937]/40 bg-[#11151a] px-2 py-1 text-xs font-mono tabular-nums"
            />
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="rounded-md border border-[#1f2937]/40 bg-[#11151a] px-1.5 py-1 text-[11px]"
            >
              <option value="">{t('portal.admin.registrations.commission.all_models')}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.code}</option>
              ))}
            </select>
          </div>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={approve}
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            {t('portal.admin.registrations.action.approve')}
          </button>
          <button
            onClick={reject}
            disabled={busy}
            className="rounded-full border border-[#1f2937]/60 px-3 py-1.5 text-xs font-medium text-[#e7eaf0] hover:border-[#f87171] hover:text-[#f87171] disabled:opacity-50"
          >
            {t('portal.admin.registrations.action.reject')}
          </button>
        </div>
      </td>
    </tr>
  );
}
