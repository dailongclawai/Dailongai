'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';

interface Row {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

export default function AdminUpgradePage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await getSupabaseClient()
      .from('profiles')
      .select('id, full_name, email, role')
      .order('role');
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  const upgrade = async (id: string) => {
    if (!id.trim()) {
      toast.error('Nhập account ID');
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_set_supervisor', { p_user_id: id.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Đã nâng lên Supervisor');
    setUserId('');
    await refresh();
  };

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Phân quyền</p>
        <h1 className="mt-2 font-headline text-4xl">Nâng đại lý lên Supervisor</h1>
      </div>

      <div className="mb-8 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs uppercase tracking-wider text-[#fadcd5]/60">Account ID đại lý</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="dán account ID (UUID)"
            className="w-full rounded-lg border border-[#5b4039]/40 bg-[#2c1c17] px-3 py-2 text-sm outline-none focus:border-[#ffb5a1] font-mono tabular-nums"
          />
        </div>
        <button
          onClick={() => upgrade(userId)}
          disabled={busy}
          className="rounded-full bg-[#ff5626] px-5 py-2.5 text-sm font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff5626]/90 disabled:opacity-50"
        >
          Nâng lên Supervisor
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#5b4039]/40 bg-[#2c1c17]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#5b4039]/40 bg-[#372621]/40 text-[10px] uppercase tracking-wider text-[#fadcd5]/60">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Account ID</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#5b4039]/40 hover:bg-[#372621]/40">
                <td className="px-4 py-3 font-medium">{r.full_name ?? r.email ?? '(không tên)'}</td>
                <td className="px-4 py-3 text-[11px] text-[#fadcd5]/60 font-mono tabular-nums">{r.id}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-[#ffb5a1]">{r.role ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {r.role === 'dealer' && (
                    <button
                      onClick={() => upgrade(r.id)}
                      disabled={busy}
                      className="rounded-full border border-[#5b4039]/60 px-3 py-1.5 text-xs font-medium text-[#fadcd5] hover:border-[#ffb5a1] hover:text-[#ffb5a1] disabled:opacity-50"
                    >
                      Nâng lên Supervisor
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
