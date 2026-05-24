'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

const STATUS_META: Record<Order['status'], { label: string; dot: string; pill: string }> = {
  approved: { label: 'Đã duyệt',    dot: 'bg-[#10b981]', pill: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' },
  paid:     { label: 'Đã thanh toán', dot: 'bg-[#10b981]', pill: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' },
  pending:  { label: 'Chờ duyệt',   dot: 'bg-[#f59e0b]', pill: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20' },
  rejected: { label: 'Từ chối',     dot: 'bg-[#f87171]', pill: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20' },
  voided:   { label: 'Đã hủy',      dot: 'bg-[#9ca3af]', pill: 'text-[#9ca3af] bg-[#9ca3af]/10 border-[#9ca3af]/20' },
};

const MAX_DAYS = 5;          // tối đa số ngày hiển thị
const DEFAULT_EXPANDED = 1;  // mở sẵn N ngày gần nhất

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function dayLabel(key: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(key);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff < 7) return `${diff} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface DayGroup {
  key: string;
  label: string;
  count: number;
  total: number;
  pending: number;
  orders: Order[];
}

export function ActivityFeed({ orders }: { orders: Order[] }) {
  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      const k = dayKey(o.created_at || o.sale_date);
      const list = map.get(k);
      if (list) list.push(o);
      else map.set(k, [o]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, MAX_DAYS)
      .map(([key, items]) => ({
        key,
        label: dayLabel(key),
        count: items.length,
        total: items.reduce((s, o) => s + Number(o.sale_price), 0),
        pending: items.filter((o) => o.status === 'pending').length,
        orders: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }));
  }, [orders]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.slice(0, DEFAULT_EXPANDED).map((g) => g.key)),
  );

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-[#1f2937] pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">Hoạt động</p>
          <h2 className="mt-1 font-headline text-2xl md:text-3xl">Đơn gần đây</h2>
        </div>
        <Link href="/portal/dealer/commission" className="text-xs text-[#9ca3af] hover:text-[#ff5625]">
          Xem tất cả →
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((g) => {
          const isOpen = expanded.has(g.key);
          return (
            <div key={g.key} className="overflow-hidden rounded-2xl border border-[#1f2937] bg-[#11151a]">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1a1f26]"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-headline text-base font-semibold text-[#e7eaf0]">{g.label}</span>
                  <span className="font-mono text-[10px] tabular-nums text-[#9ca3af]">{g.key.split('-').reverse().join('/')}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono tabular-nums text-[#9ca3af]">
                    <span className="font-semibold text-[#e7eaf0]">{g.count}</span> đơn
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#ff5625]">{fmtVnd(g.total)} ₫</span>
                  {g.pending > 0 && (
                    <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#f59e0b]">
                      {g.pending} chờ
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[18px] text-[#9ca3af]" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    keyboard_arrow_down
                  </span>
                </div>
              </button>

              {isOpen && (
                <ol className="relative ml-6 border-l-2 border-[#1f2937] pb-2">
                  {g.orders.map((o) => {
                    const meta = STATUS_META[o.status];
                    return (
                      <li key={o.id} className="relative pl-4 pr-3 py-2">
                        <span
                          className={`absolute -left-[7px] top-3.5 h-3 w-3 rounded-full ring-4 ring-[#11151a] ${meta.dot}`}
                          aria-hidden="true"
                        />
                        <div className="flex items-baseline justify-between gap-2 rounded-r-lg px-2 py-1 transition-colors hover:bg-[#1a1f26]">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-baseline gap-2">
                              <span className="font-mono text-[10px] tabular-nums text-[#9ca3af]">{formatTime(o.created_at)}</span>
                              <span className="truncate text-sm font-medium text-[#e7eaf0]">{o.customer_name}</span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                              <span className="font-mono tabular-nums text-[#e7eaf0]">{fmtVnd(o.sale_price)} ₫</span>
                              {o.serial_number && (
                                <>
                                  {' · '}
                                  <span className="font-mono tabular-nums">{o.serial_number}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] ${meta.pill}`}>
                            {meta.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {orders.length > groups.reduce((s, g) => s + g.count, 0) && (
        <p className="mt-3 text-center text-[11px] text-[#9ca3af]">
          Hiển thị {MAX_DAYS} ngày gần nhất.{' '}
          <Link href="/portal/dealer/commission" className="font-semibold text-[#ff5625] hover:underline">
            Xem toàn bộ lịch sử →
          </Link>
        </p>
      )}
    </section>
  );
}
