'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { getAuditLog } from '@/lib/portal-queries';
import type { AuditEntry } from '@/lib/portal-types';

const actionLabel: Record<string, string> = {
  approve_order: 'Duyệt đơn',
  reject_order: 'Từ chối đơn',
  void_order: 'Huỷ đơn',
  mark_paid: 'Đánh dấu đã trả',
  update_profile: 'Cập nhật hồ sơ',
  reject_registration: 'Từ chối đăng ký',
  insert_dealer_commissions: 'Gán hoa hồng đại lý',
  update_dealer_commissions: 'Sửa hoa hồng đại lý',
  insert_supervisor_overrides: 'Gán override supervisor',
};

const actionColor = (a: string) =>
  a.includes('approve') || a.includes('paid') ? 'text-[#34d399]'
  : a.includes('reject') || a.includes('void') ? 'text-[#f87171]'
  : 'text-[#ff5625]';

export default function AdminAuditPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => { setRows(await getAuditLog(150)); }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell variant="admin" nav={<AdminNav />}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Bảo mật</p>
        <h1 className="mt-2 font-headline text-4xl">Nhật ký kiểm toán</h1>
        <p className="mt-2 text-sm text-[#e2e2e5]/60">Mọi thay đổi quan trọng được ghi bất biến (immutable).</p>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/12 bg-white/5 text-[10px] uppercase tracking-wider text-[#e2e2e5]/60">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Hành động</th>
              <th className="px-4 py-3">Bảng</th>
              <th className="px-4 py-3">Đối tượng</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#e2e2e5]/50">Chưa có bản ghi nào.</td></tr>
            ) : rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t border-white/12 hover:bg-white/5">
                  <td className="px-4 py-3 font-mono tabular-nums text-xs text-[#e2e2e5]/60">{new Date(r.created_at).toLocaleString('vi-VN')}</td>
                  <td className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${actionColor(r.action)}`}>{actionLabel[r.action] ?? r.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#e2e2e5]/70">{r.target_table}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#e2e2e5]/50">{r.target_id?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {(r.before || r.after) && (
                      <button onClick={() => setOpen(open === r.id ? null : r.id)} className="text-xs text-[#ff5625] hover:underline">
                        {open === r.id ? 'Ẩn' : 'Chi tiết'}
                      </button>
                    )}
                  </td>
                </tr>
                {open === r.id && (
                  <tr className="border-t border-white/12 bg-[#121416]">
                    <td colSpan={5} className="px-4 py-3">
                      <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-[#e2e2e5]/70">
{JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
