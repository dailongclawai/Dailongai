'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { approveOrder, rejectOrder } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import { Spinner } from './Spinner';
import { useI18n } from '@/lib/i18n';
import type { Order } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type ColumnKey = 'pending' | 'approved' | 'paid' | 'closed';

const COLUMNS: { key: ColumnKey; labelKey: string; tone: string; statuses: Order['status'][] }[] = [
  { key: 'pending', labelKey: 'portal.components.orderKanban.col_pending', tone: 'text-[#f59e0b] border-[#f59e0b]/40', statuses: ['pending'] },
  { key: 'approved', labelKey: 'portal.components.orderKanban.col_approved', tone: 'text-[#3b82f6] border-[#3b82f6]/40', statuses: ['approved'] },
  { key: 'paid', labelKey: 'portal.components.orderKanban.col_paid', tone: 'text-[#10b981] border-[#10b981]/40', statuses: ['paid'] },
  { key: 'closed', labelKey: 'portal.components.orderKanban.col_closed', tone: 'text-[#9ca3af] border-[#9ca3af]/40', statuses: ['rejected', 'voided'] },
];

interface Props {
  orders: Order[];
  adminId: string;
  dealerNames?: Record<string, string>;
  onResolved: () => void;
}

export function OrderKanban({ orders, adminId, dealerNames, onResolved }: Props) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const m: Record<ColumnKey, Order[]> = { pending: [], approved: [], paid: [], closed: [] };
    for (const o of orders) {
      const col = COLUMNS.find((c) => c.statuses.includes(o.status));
      if (col) m[col.key].push(o);
    }
    for (const k of Object.keys(m) as ColumnKey[]) {
      m[k].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return m;
  }, [orders]);

  const viewReceipt = async (path: string | null) => {
    if (!path) return;
    const { data } = await getSupabaseClient().storage.from('receipts').createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await approveOrder(id, adminId);
      toast.success(t('portal.components.orderKanban.toast_approved'));
      onResolved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.components.orderKanban.toast_error'));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt(t('portal.components.orderKanban.prompt_reject_reason'));
    if (!reason) return;
    setBusyId(id);
    try {
      await rejectOrder(id, reason);
      toast.success(t('portal.components.orderKanban.toast_rejected'));
      onResolved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.components.orderKanban.toast_error'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="-mx-2 overflow-x-auto pb-3 md:mx-0 md:overflow-visible">
      <div className="flex snap-x snap-mandatory gap-3 px-2 md:grid md:snap-none md:grid-cols-4 md:gap-4 md:px-0">
        {COLUMNS.map((col) => {
          const items = buckets[col.key];
          const total = items.reduce((s, o) => s + Number(o.sale_price), 0);
          return (
            <section
              key={col.key}
              className="snap-start flex w-[78vw] shrink-0 flex-col rounded-2xl border border-[#1f2937] bg-[#0a0c0f]/60 md:w-auto"
            >
              <header className={`sticky top-0 z-10 flex items-baseline justify-between rounded-t-2xl border-b bg-[#11151a] px-3 py-2 ${col.tone}`}>
                <p className="text-xs font-semibold uppercase tracking-wider">{t(col.labelKey)}</p>
                <p className="font-mono text-[11px] tabular-nums text-[#9ca3af]">
                  <span className="text-[#e7eaf0]">{items.length}</span>
                  {total > 0 && (
                    <>
                      {' · '}
                      <span>{fmtVnd(total)} ₫</span>
                    </>
                  )}
                </p>
              </header>
              <ul className="flex-1 space-y-2 p-2">
                {items.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-[#1f2937] p-4 text-center text-[11px] text-[#9ca3af]">
                    {t('portal.components.orderKanban.empty_column')}
                  </li>
                ) : items.slice(0, 30).map((o) => {
                  const dealerName = dealerNames?.[o.dealer_id];
                  const isPending = col.key === 'pending';
                  const isBusy = busyId === o.id;
                  return (
                    <li key={o.id} className="rounded-xl border border-[#1f2937] bg-[#11151a] p-3 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium text-[#e7eaf0]">{o.customer_name}</p>
                        <p className="font-mono text-[10px] tabular-nums text-[#9ca3af]">
                          {new Date(o.sale_date).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      {dealerName && (
                        <p className="mt-0.5 truncate text-[11px] text-[#9ca3af]">{t('portal.components.orderKanban.dealer_short')}: {dealerName}</p>
                      )}
                      <p className="mt-1 font-mono text-xs tabular-nums text-[#ff5625]">
                        {o.serial_number}
                      </p>
                      {o.invoice_required && (
                        <p
                          className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400"
                          title={`${o.invoice_company_name ?? ''} · MST ${o.invoice_tax_code ?? ''}${o.invoice_email ? ' · ' + o.invoice_email : ''}`}
                        >
                          <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                          {t('portal.components.orderKanban.invoice_chip')}
                          <span className="font-mono normal-case text-amber-400/80">{o.invoice_tax_code}</span>
                        </p>
                      )}
                      <p className="mt-1 font-headline text-lg text-[#e7eaf0] tabular-nums">
                        {fmtVnd(o.sale_price)} ₫
                      </p>
                      {o.receipt_image_url && (
                        <button
                          type="button"
                          onClick={() => viewReceipt(o.receipt_image_url)}
                          className="mt-1 text-[11px] text-[#3b82f6] hover:underline"
                        >
                          {t('portal.components.orderKanban.view_receipt')}
                        </button>
                      )}
                      {isPending && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => approve(o.id)}
                            disabled={isBusy}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#10b981] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#0ea271] disabled:opacity-50"
                          >
                            {isBusy ? <Spinner size={12} /> : <span>✓</span>}
                            {t('portal.components.orderKanban.approve_button')}
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(o.id)}
                            disabled={isBusy}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#f87171]/40 px-2 py-1.5 text-xs font-medium text-[#f87171] hover:bg-[#f87171]/10 disabled:opacity-50"
                          >
                            ✗ {t('portal.components.orderKanban.reject_button')}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
