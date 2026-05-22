'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { toast } from 'sonner';
import type { Profile, ProductModel, ProfileRole } from '@/lib/portal-types';

export default function RegistrationsPage() {
  const router = useRouter();
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
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Queue cần xử lý</p>
        <h1 className="mt-2 font-headline text-4xl">Đăng ký chờ duyệt</h1>
      </div>
      {fetching ? (
        <p className="text-[#fadcd5]/60">Đang tải…</p>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#5b4039]/50 p-12 text-center text-sm text-[#fadcd5]/60">
          Không có đăng ký mới.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#5b4039]/40 bg-[#2c1c17] backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#5b4039]/40 bg-[#372621]/40 text-[10px] uppercase tracking-wider text-[#fadcd5]/60">
              <tr>
                <th className="px-4 py-3">Hồ sơ</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3 text-right">Hành động</th>
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
      toast.success(`Đã duyệt ${profile.email ?? profile.full_name ?? 'hồ sơ'}`);
      onResolved();
    }
  };

  const reject = async () => {
    const reason = window.prompt('Lý do từ chối?');
    if (!reason) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_reject_registration', {
      p_profile_id: profile.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã từ chối');
      onResolved();
    }
  };

  return (
    <tr className="border-t border-[#5b4039]/40 hover:bg-[#372621]/40">
      <td className="px-4 py-3">
        <p className="font-medium">{profile.full_name ?? '(chưa có tên)'}</p>
        <p className="text-[11px] text-[#fadcd5]/60">{profile.email ?? '—'}</p>
        <p className="text-[11px] text-[#fadcd5]/60 font-mono tabular-nums">{profile.phone ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProfileRole)}
          className="rounded-md border border-[#5b4039]/40 bg-[#2c1c17] px-2 py-1 text-xs"
        >
          <option value="dealer">Dealer</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        {role === 'dealer' ? (
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="rounded-md border border-[#5b4039]/40 bg-[#2c1c17] px-2 py-1 text-xs"
          >
            <option value="">— Không gán —</option>
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
              className="rounded-md border border-[#5b4039]/40 bg-[#2c1c17] px-1.5 py-1 text-[11px]"
            >
              <option value="percent">%</option>
              <option value="fixed">VND</option>
            </select>
            <input
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              className="w-20 rounded-md border border-[#5b4039]/40 bg-[#2c1c17] px-2 py-1 text-xs font-mono tabular-nums"
            />
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="rounded-md border border-[#5b4039]/40 bg-[#2c1c17] px-1.5 py-1 text-[11px]"
            >
              <option value="">All</option>
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
            className="rounded-full bg-[#ff5626] px-3 py-1.5 text-xs font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff5626]/90 disabled:opacity-50"
          >
            Duyệt
          </button>
          <button
            onClick={reject}
            disabled={busy}
            className="rounded-full border border-[#5b4039]/60 px-3 py-1.5 text-xs font-medium text-[#fadcd5] hover:border-[#f87171] hover:text-[#f87171] disabled:opacity-50"
          >
            Từ chối
          </button>
        </div>
      </td>
    </tr>
  );
}
