'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupervisorTeam } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { TeamMember } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };
const fmtShortVnd = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr' : new Intl.NumberFormat('vi-VN').format(n));

export default function SupervisorDashboard() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'supervisor') router.replace('/portal/dashboard');
    else getSupervisorTeam(session.user.id).then(setTeam);
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'supervisor') return null;

  const totalMonth = team.reduce((s, t) => s + Number(t.month_sales), 0);
  const totalUnits = team.reduce((s, t) => s + Number(t.units_ytd), 0);

  return (
    <PortalShell variant="supervisor">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#5d8d6a]">Toàn đội</p>
        <h1 style={display} className="mt-2 text-4xl font-light italic">Đội của tôi</h1>
      </div>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đại lý</p>
          <p style={numeric} className="mt-2 text-3xl font-medium">{team.length}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Doanh số tháng</p>
          <p style={numeric} className="mt-2 text-3xl font-medium">{fmtShortVnd(totalMonth)}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Máy YTD toàn đội</p>
          <p style={numeric} className="mt-2 text-3xl font-medium">{totalUnits}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
            <tr>
              <th className="px-4 py-3">Đại lý</th>
              <th className="px-4 py-3 text-right">Doanh số tháng</th>
              <th className="px-4 py-3 text-right">Máy YTD</th>
              <th className="px-4 py-3 text-right">Đơn chờ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.dealer_id} className="border-t border-[#0e1525]/10 hover:bg-[#f5f1e8]/50">
                <td className="px-4 py-3 font-medium">{t.dealer_name ?? '(không tên)'}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{fmtShortVnd(Number(t.month_sales))}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{t.units_ytd}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{t.orders_pending}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/portal/supervisor/team/${t.dealer_id}`} className="text-xs text-[#bc7e3b] hover:underline">Chi tiết →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
