'use client';

import { useEffect, useState } from 'react';
import { getDealerTierStatus, type DealerTierStatus } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export function TierCard({ profileId, audience = 'dealer' }: { profileId: string; audience?: 'dealer' | 'supervisor' }) {
  const [status, setStatus] = useState<DealerTierStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDealerTierStatus(profileId)
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-[#3d3f41]/30" />
        <div className="mt-3 h-9 w-28 animate-pulse rounded bg-[#3d3f41]/20" />
        <div className="mt-6 h-3 w-full animate-pulse rounded-full bg-[#3d3f41]/20" />
      </div>
    );
  }
  if (!status) return null;

  const color = status.current_color || '#ffb5a1';
  const teamLabel = audience === 'supervisor' ? 'Bậc đội của bạn' : 'Bậc hoa hồng hiện tại';
  const subjectVerb = audience === 'supervisor' ? 'Đội cần thêm' : 'Bán thêm';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-l-4 bg-[#11151a] p-6"
      style={{ borderLeftColor: color }}
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#9ca3af]">{teamLabel}</p>
          <p className="mt-2 font-headline text-[32px] font-bold leading-none" style={{ color }}>
            {status.current_name}
          </p>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
        >
          <span className="material-symbols-outlined fill" style={{ color }}>
            {status.current_icon}
          </span>
        </div>
      </div>

      {status.next_slug ? (
        <>
          <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wider">
            <span className="text-[#9ca3af]">Tiến độ lên hạng {status.next_name}</span>
            <span className="font-bold text-[#e7eaf0]">{status.progress_pct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#0a0c0f]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${status.progress_pct}%`,
                background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                boxShadow: `0 0 12px ${color}55`,
              }}
            />
          </div>
          <p className="mt-3 text-center text-sm italic text-[#9ca3af]">
            {subjectVerb} <span className="font-bold" style={{ color }}>{fmtVnd(status.amount_to_next)} ₫</span> doanh số để lên{' '}
            <span className="font-bold text-[#ff5625]">{status.next_name}</span>
          </p>
        </>
      ) : (
        <p className="text-center text-sm italic text-[#9ca3af]">
          Đã đạt bậc cao nhất. Doanh số 12 tháng: <span className="font-bold text-[#e7eaf0]">{fmtVnd(status.revenue_12m)} ₫</span>
        </p>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-[#1f2937]/30 pt-4 text-[11px] uppercase tracking-wider text-[#9ca3af]">
        <span>Doanh số 12 tháng</span>
        <span className="font-mono font-bold tabular-nums text-[#e7eaf0]">{fmtVnd(status.revenue_12m)} ₫</span>
      </div>
    </div>
  );
}
