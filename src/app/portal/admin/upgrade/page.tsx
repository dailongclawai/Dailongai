'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

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
      nav={
        <>
          <Link href="/portal/admin" className="text-[#0e1525]/60 hover:text-[#0e1525]">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="text-[#0e1525]/60 hover:text-[#0e1525]">Đơn hàng</Link>
          <Link href="/portal/admin/upgrade" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Nâng cấp</Link>
        </>
      }
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Phân quyền</p>
        <h1 style={display} className="mt-2 text-4xl font-light italic">Nâng đại lý lên Supervisor</h1>
      </div>

      <div className="mb-8 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Account ID đại lý</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="dán account ID (UUID)"
            className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
            style={numeric}
          />
        </div>
        <button
          onClick={() => upgrade(userId)}
          disabled={busy}
          className="rounded-full bg-[#0e1525] px-5 py-2.5 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50"
        >
          Nâng lên Supervisor
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Account ID</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#0e1525]/10 hover:bg-[#f5f1e8]/50">
                <td className="px-4 py-3 font-medium">{r.full_name ?? r.email ?? '(không tên)'}</td>
                <td className="px-4 py-3 text-[11px] text-[#0e1525]/60" style={numeric}>{r.id}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-[#bc7e3b]">{r.role ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {r.role === 'dealer' && (
                    <button
                      onClick={() => upgrade(r.id)}
                      disabled={busy}
                      className="rounded-full border border-[#0e1525]/30 px-3 py-1.5 text-xs font-medium hover:bg-[#0e1525]/5 disabled:opacity-50"
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
