'use client';

import type { SupervisorGoal } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

interface Props {
  goal: SupervisorGoal | null;
}

export function MonthlyGoalCard({ goal }: Props) {
  if (!goal) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1f2937]/40 bg-[#11151a]/40 p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-[#e7eaf0]/40">flag</span>
          <div>
            <p className="text-sm font-medium text-[#e7eaf0]/70">Chưa có mục tiêu tháng</p>
            <p className="mt-0.5 text-[11px] text-[#e7eaf0]/40">
              Admin chưa thiết lập mục tiêu doanh số cho bạn tháng này.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pct = goal.progress_pct;
  const pacePct = goal.on_pace_pct;
  const ahead = pct >= pacePct;
  const remaining = Math.max(0, goal.target_revenue - goal.current_revenue);
  const monthLabel = goal.year_month.slice(0, 7).split('-').reverse().join('/');

  // Tone by status
  let tone = { ring: '#ff5625', from: '#ff5625', to: '#ff8a5b' }; // behind = orange
  if (pct >= 100) tone = { ring: '#34d399', from: '#34d399', to: '#5fdfb1' };
  else if (ahead) tone = { ring: '#00daf3', from: '#00daf3', to: '#5be4ff' };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#1e2022] via-[#1e2022] to-[#0c0e10] p-6 sm:p-7"
      style={{ borderColor: `${tone.ring}40` }}
    >
      <div
        className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full blur-3xl"
        style={{ background: `${tone.from}15` }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: tone.ring }}>
            Mục tiêu tháng {monthLabel}
          </p>
          <p className="mt-2 flex items-baseline gap-3 font-headline">
            <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{fmtVnd(goal.current_revenue)}</span>
            <span className="text-base text-[#e7eaf0]/50">/ {fmtVnd(goal.target_revenue)} ₫</span>
          </p>
          {goal.note && (
            <p className="mt-2 text-[11px] italic text-[#e7eaf0]/50">{goal.note}</p>
          )}
        </div>

        <div className="text-right">
          <p className="font-headline text-4xl font-bold tabular-nums" style={{ color: tone.ring }}>
            {pct}<span className="text-xl text-[#e7eaf0]/50">%</span>
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[#e7eaf0]/45">đã đạt</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-[#06080a]/60">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: `linear-gradient(90deg, ${tone.from} 0%, ${tone.to} 100%)`,
            boxShadow: `0 0 12px ${tone.from}55`,
          }}
        />
        {/* Pace marker */}
        {pacePct < 100 && (
          <div
            className="absolute top-0 h-full w-[2px] bg-white/40"
            style={{ left: `${pacePct}%` }}
            title={`Tốc độ chuẩn: ${pacePct}%`}
          />
        )}
      </div>

      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#e7eaf0]/50">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          Còn <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]/80">{goal.days_left}</span> ngày
          (tháng có {goal.days_in_month} ngày)
        </div>
        {pct < 100 ? (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]" style={{ color: tone.ring }}>
              {ahead ? 'trending_up' : 'trending_flat'}
            </span>
            <span className="font-mono tabular-nums" style={{ color: tone.ring }}>
              {ahead ? `Nhanh hơn pace ${pct - pacePct}%` : `Cần thêm ${fmtVnd(remaining)} ₫`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#10b981]">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span className="font-semibold">Đã đạt mục tiêu</span>
          </div>
        )}
      </div>
    </div>
  );
}
