'use client';

import { Fragment, useMemo, useState } from 'react';
import type { AuditEntry } from '@/lib/portal-types';
import { useI18n } from '@/lib/i18n';

const ACTION_KEYS = [
  'approve_order',
  'reject_order',
  'void_order',
  'mark_paid',
  'update_profile',
  'reject_registration',
  'insert_dealer_commissions',
  'update_dealer_commissions',
  'insert_supervisor_overrides',
] as const;

interface IconMeta {
  symbol: string;
  ring: string;
  fg: string;
}

function iconFor(action: string): IconMeta {
  if (action.includes('approve') || action.includes('mark_paid')) {
    return { symbol: 'check', ring: 'bg-[#10b981]/15 ring-[#10b981]/40', fg: 'text-[#10b981]' };
  }
  if (action.includes('reject') || action.includes('void')) {
    return { symbol: 'close', ring: 'bg-[#f87171]/15 ring-[#f87171]/40', fg: 'text-[#f87171]' };
  }
  if (action.includes('commission') || action.includes('override') || action.includes('payout')) {
    return { symbol: 'payments', ring: 'bg-[#f59e0b]/15 ring-[#f59e0b]/40', fg: 'text-[#f59e0b]' };
  }
  if (action.includes('profile') || action.includes('registration')) {
    return { symbol: 'person', ring: 'bg-[#3b82f6]/15 ring-[#3b82f6]/40', fg: 'text-[#3b82f6]' };
  }
  return { symbol: 'settings', ring: 'bg-[#9ca3af]/15 ring-[#9ca3af]/40', fg: 'text-[#9ca3af]' };
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string, t: (k: string) => string, locale: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return t('portal.components.auditTimeline.today');
  if (diff === 1) return t('portal.components.auditTimeline.yesterday');
  const intlLocale = locale === 'vi' ? 'vi-VN' : locale;
  return d.toLocaleDateString(intlLocale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  rows: AuditEntry[];
}

export function AuditTimeline({ rows }: Props) {
  const { t, locale } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const actionLabels: Record<string, string> = Object.fromEntries(
    ACTION_KEYS.map((k) => [k, t(`portal.components.auditTimeline.action.${k}`)]),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const r of rows) {
      const k = dayKey(r.created_at);
      const list = map.get(k);
      if (list) list.push(r); else map.set(k, [r]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1f2937] bg-[#11151a] p-10 text-center text-sm text-[#9ca3af]">
        {t('portal.components.auditTimeline.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
            {dayLabel(items[0].created_at, t, locale)} · <span className="text-[#9ca3af]">{day}</span>
          </h3>
          <ol className="relative ml-3 border-l-2 border-[#1f2937]">
            {items.map((r) => {
              const icon = iconFor(r.action);
              const label = actionLabels[r.action] ?? r.action;
              const isOpen = openId === r.id;
              const hasDiff = !!(r.before || r.after);
              return (
                <Fragment key={r.id}>
                  <li className="relative pl-8 pb-3">
                    <span
                      className={`absolute -left-[18px] top-2 flex h-9 w-9 items-center justify-center rounded-full ring-4 ${icon.ring} ring-[#0a0c0f]`}
                      aria-hidden="true"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${icon.fg}`}>{icon.symbol}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => hasDiff && setOpenId(isOpen ? null : r.id)}
                      disabled={!hasDiff}
                      className={`w-full rounded-xl border border-[#1f2937] bg-[#11151a] px-4 py-3 text-left transition-colors ${hasDiff ? 'hover:bg-[#1a1f26] cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className={`text-sm font-semibold ${icon.fg}`}>{label}</p>
                        <p className="font-mono text-xs tabular-nums text-[#9ca3af]">{timeLabel(r.created_at)}</p>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#9ca3af]">
                        <span className="text-[#e7eaf0]">{r.target_table}</span>
                        {r.target_id && (
                          <>
                            {' · '}
                            <span className="text-[#9ca3af]">{r.target_id.slice(0, 8)}</span>
                          </>
                        )}
                      </p>
                    </button>
                    {isOpen && hasDiff && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-[#1f2937] bg-black/40 p-3 text-[11px] text-[#9ca3af]">
{JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                      </pre>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
