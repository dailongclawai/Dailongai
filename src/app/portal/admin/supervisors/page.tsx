'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { getAllSupervisors, getAllTeamMembers } from '@/lib/portal-queries';
import type { SupervisorRow } from '@/lib/portal-queries';
import type { TeamMember } from '@/lib/portal-types';

const fmtVnd = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr' : new Intl.NumberFormat('vi-VN').format(n));

export default function AdminSupervisorsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [sv, tm] = await Promise.all([getAllSupervisors(), getAllTeamMembers()]);
    setSupervisors(sv);
    setTeam(tm);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  const teamOf = (svId: string) => team.filter((t) => t.supervisor_id === svId);
  const agg = (svId: string) => {
    const ts = teamOf(svId);
    return {
      dealers: ts.length,
      month: ts.reduce((s, t) => s + Number(t.month_sales), 0),
      units: ts.reduce((s, t) => s + Number(t.units_ytd), 0),
      pending: ts.reduce((s, t) => s + Number(t.orders_pending), 0),
    };
  };

  const totalDealers = team.length;
  const totalMonth = team.reduce((s, t) => s + Number(t.month_sales), 0);
  const totalUnits = team.reduce((s, t) => s + Number(t.units_ytd), 0);

  return (
    <PortalShell variant="admin" nav={<AdminNav />}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Đội ngũ</p>
        <h1 className="mt-2 font-headline text-4xl">Supervisor</h1>
        <p className="mt-2 text-sm text-[#e2e2e5]/60">Quản lý &amp; xem số liệu từng supervisor và đội của họ.</p>
      </div>

      {/* Overall */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: 'Supervisor', value: supervisors.length },
          { label: 'Đại lý có nhánh', value: totalDealers },
          { label: 'Doanh số tháng (đội)', value: fmtVnd(totalMonth) },
          { label: 'Máy YTD (đội)', value: totalUnits },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#3d3f41]/40 bg-[#1e2022] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">{k.label}</p>
            <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Supervisor list */}
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#3d3f41]/40 bg-[#282a2c]/40 text-[10px] uppercase tracking-wider text-[#e2e2e5]/60">
            <tr>
              <th className="px-4 py-3">Supervisor</th>
              <th className="px-4 py-3 text-right">Đại lý</th>
              <th className="px-4 py-3 text-right">Doanh số tháng</th>
              <th className="px-4 py-3 text-right">Máy YTD</th>
              <th className="px-4 py-3 text-right">Đơn chờ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {supervisors.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#e2e2e5]/50">Chưa có supervisor nào. Nâng cấp đại lý ở mục “Nâng cấp”.</td></tr>
            ) : supervisors.map((sv) => {
              const a = agg(sv.id);
              const open = openId === sv.id;
              return (
                <Fragment key={sv.id}>
                  <tr className="border-t border-[#3d3f41]/40 hover:bg-[#282a2c]/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sv.full_name ?? '(không tên)'}</p>
                      <p className="text-[11px] text-[#e2e2e5]/50">{sv.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{a.dealers}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(a.month)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{a.units}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#ff5625]">{a.pending}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpenId(open ? null : sv.id)} className="text-xs text-[#ff5625] hover:underline">
                        {open ? 'Ẩn đội' : 'Xem đội →'}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-t border-[#3d3f41]/40 bg-[#121416]">
                      <td colSpan={6} className="px-4 py-4">
                        {a.dealers === 0 ? (
                          <p className="text-center text-xs text-[#e2e2e5]/50">Supervisor này chưa có đại lý nào trong nhánh.</p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="text-[10px] uppercase tracking-wider text-[#e2e2e5]/40">
                              <tr>
                                <th className="px-3 py-2">Đại lý</th>
                                <th className="px-3 py-2 text-right">Doanh số tháng</th>
                                <th className="px-3 py-2 text-right">Máy YTD</th>
                                <th className="px-3 py-2 text-right">Đơn chờ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamOf(sv.id).map((t) => (
                                <tr key={t.dealer_id} className="border-t border-[#3d3f41]/40">
                                  <td className="px-3 py-2">{t.dealer_name ?? '(không tên)'}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtVnd(Number(t.month_sales))}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{t.units_ytd}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums">{t.orders_pending}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
