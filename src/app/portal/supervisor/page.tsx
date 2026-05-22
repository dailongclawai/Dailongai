'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getSupervisorTeam, getMyPayouts } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { TeamMember, PayoutRow } from '@/lib/portal-types';

const fmtShortVnd = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr' : new Intl.NumberFormat('vi-VN').format(n));

export default function SupervisorDashboard() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [refLink, setRefLink] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'supervisor') router.replace('/portal/dashboard');
    else {
      getSupervisorTeam(session.user.id).then(setTeam);
      getMyPayouts().then(setPayouts);
    }
  }, [loading, session, profile, router]);

  useEffect(() => {
    if (!session) return;
    const base = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin;
    const link = `${base}/portal/register?ref=${session.user.id}`;
    setRefLink(link);
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [session]);

  if (loading || profile?.role !== 'supervisor') return null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(refLink);
    toast.success('Đã copy link mời đại lý');
  };

  const totalMonth = team.reduce((s, t) => s + Number(t.month_sales), 0);
  const totalUnits = team.reduce((s, t) => s + Number(t.units_ytd), 0);

  return (
    <PortalShell variant="supervisor">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#34d399]">Toàn đội</p>
        <h1 className="mt-2 font-headline text-4xl">Đội của tôi</h1>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Đại lý</p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{team.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Doanh số tháng</p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{fmtShortVnd(totalMonth)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Máy YTD toàn đội</p>
          <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{totalUnits}</p>
        </div>
      </div>
      <div className="mb-8 flex flex-col gap-6 rounded-2xl border border-[#34d399]/30 bg-[#34d399]/5 p-6 sm:flex-row sm:items-center">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR mời đại lý" className="h-32 w-32 rounded-lg bg-white p-2" />
        )}
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#34d399]">Mời đại lý vào nhánh của bạn</p>
          <p className="mt-2 text-sm text-[#e2e2e5]/70">
            Gửi QR hoặc link này cho đại lý. Khi họ đăng ký qua đó, tài khoản sẽ tự động thuộc nhánh của bạn và bạn thấy được số liệu kinh doanh của họ.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={refLink}
              className="flex-1 truncate rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-xs text-[#e2e2e5]/70"
            />
            <button onClick={copyLink} className="rounded-full bg-[#ff5625] px-4 py-2 text-xs font-medium text-white glow-primary-hover hover:bg-[#ff8a5c]">
              Copy
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-white/12 bg-white/5 text-[10px] uppercase tracking-wider text-[#e2e2e5]/60">
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
              <tr key={t.dealer_id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{t.dealer_name ?? '(không tên)'}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtShortVnd(Number(t.month_sales))}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{t.units_ytd}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{t.orders_pending}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/portal/supervisor/team?dealer=${t.dealer_id}`} className="text-xs text-[#ff5625] hover:underline">Chi tiết →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supervisor own commission earnings */}
      {payouts.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-baseline gap-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#34d399]">Hoa hồng supervisor của tôi</p>
            <span className="font-mono text-sm tabular-nums text-[#e2e2e5]/60">
              Chờ: {new Intl.NumberFormat('vi-VN').format(payouts.filter(p => !p.paid_at).reduce((s, p) => s + Number(p.amount), 0))} đ
            </span>
          </div>
          <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
            {payouts.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${p.paid_at ? 'bg-[#34d399]' : 'bg-[#ff5625]'}`} />
                  <span className="font-mono text-xs tabular-nums text-[#e2e2e5]/60">
                    {new Date(p.calculated_at).toLocaleDateString('vi-VN')}
                  </span>
                  {p.payment_proof_url && (
                    <span className="text-[10px] text-[#e2e2e5]/40">Ref: {p.payment_proof_url}</span>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-mono font-semibold tabular-nums ${p.paid_at ? 'text-[#34d399]' : 'text-[#ff5625]'}`}>
                    {new Intl.NumberFormat('vi-VN').format(Number(p.amount))} đ
                  </p>
                  <p className="text-[10px] text-[#e2e2e5]/40">{p.paid_at ? 'Đã nhận' : 'Chờ chi trả'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PortalShell>
  );
}
