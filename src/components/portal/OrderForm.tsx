'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getActiveModels, recordDealerOrder } from '@/lib/portal-queries';
import type { ProductModel } from '@/lib/portal-types';
import { AddressPicker, emptyAddress, fullAddress, type AddressValue } from '@/components/portal/AddressPicker';
import { InvoiceFieldsSection, emptyInvoice, validateInvoice, type InvoiceInfo } from '@/components/portal/InvoiceFieldsSection';
import { PaymentQRCard } from '@/components/portal/PaymentQRCard';
import { ProductPicker } from '@/components/portal/ProductPicker';
import { orderMemo } from '@/lib/vietqr';
import { useI18n } from '@/lib/i18n';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtDateTime = (d: Date) => d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export function OrderForm({ userId: _userId }: { userId: string }) {
  const { t } = useI18n();
  const [models, setModels] = useState<ProductModel[]>([]);
  const [modelId, setModelId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [invoice, setInvoice] = useState<InvoiceInfo>(emptyInvoice);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ orderId: string; amount: number; customer: string; createdAt: Date } | null>(null);

  useEffect(() => {
    getActiveModels().then((ms) => {
      setModels(ms);
      if (ms[0]) setModelId(ms[0].id);
    });
  }, []);

  const selectedModel = useMemo(() => models.find((m) => m.id === modelId) ?? null, [models, modelId]);
  const unitPrice = Number(selectedModel?.base_price ?? 0);
  const totalPrice = unitPrice * quantity;

  const submit = async () => {
    if (!modelId) { toast.error(t('portal.components.orderForm.err_select_product')); return; }
    if (quantity < 1) { toast.error(t('portal.components.orderForm.err_quantity_min')); return; }
    if (!address.province_code || !address.ward_code || !address.detail.trim()) {
      toast.error(t('portal.components.orderForm.err_address_required')); return;
    }
    const invoiceErr = validateInvoice(invoice);
    if (invoiceErr) { toast.error(t(invoiceErr)); return; }
    setBusy(true);
    try {
      const orderId = await recordDealerOrder({
        model_id: modelId,
        quantity,
        customer_name: customer,
        customer_phone: phone,
        shipping_address: fullAddress(address),
        invoice_required: invoice.required,
        invoice_company_name: invoice.company_name,
        invoice_tax_code: invoice.tax_code,
        invoice_email: invoice.email || null,
      });
      toast.success(t('portal.components.orderForm.toast_order_recorded'));
      setDone({ orderId, amount: totalPrice, customer, createdAt: new Date() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.components.orderForm.err_record_failed'));
    } finally { setBusy(false); }
  };

  if (done) {
    const memo = orderMemo(done.orderId);
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-emerald-500/30 bg-[#1a1c1f] p-5 text-center">
          <span className="material-symbols-outlined text-emerald-400 text-[40px]">check_circle</span>
          <h2 className="mt-2 font-headline text-2xl">{t('portal.components.orderForm.done_title_prefix')} {done.customer}</h2>
          <p className="mt-1 text-xs text-[#a8b3ac]">{t('portal.components.orderForm.done_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#3f4944] bg-[#1a1c1f] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[#a8b3ac]">{t('portal.components.orderForm.order_code')}</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#8bd6b6]">{memo}</p>
          </div>
          <div className="rounded-xl border border-[#3f4944] bg-[#1a1c1f] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[#a8b3ac]">{t('portal.components.orderForm.created_at')}</p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-[#e2e2e6]">{fmtDateTime(done.createdAt)}</p>
          </div>
        </div>

        <PaymentQRCard orderId={done.orderId} amount={done.amount} />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setDone(null); setQuantity(1); setCustomer(''); setPhone(''); setAddress(emptyAddress); }}
            className="flex-1 rounded-lg border border-[#3f4944] bg-[#1a1c1f] py-3 text-sm font-bold text-[#e2e2e6] hover:bg-[#1e2023]"
          >
            {t('portal.components.orderForm.new_order_button')}
          </button>
          <Link
            href="/portal/dealer/commission"
            className="flex flex-1 items-center justify-center rounded-lg bg-[#065f46] py-3 text-sm font-bold text-white hover:bg-[#065f46]/90"
          >
            {t('portal.components.orderForm.view_commission_book')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-[#3f4944]/40 bg-[#1a1c1e] p-6"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-[11px] uppercase tracking-wider text-[#a8b3ac] mb-1.5">{t('portal.components.orderForm.label_product')}</label>
          <ProductPicker models={models} selectedId={modelId} onSelect={setModelId} />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#a8b3ac] mb-1.5">{t('portal.components.orderForm.label_quantity')}</label>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-[#3f4944]/40 bg-[#0c0e11]">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex w-12 items-center justify-center text-lg font-bold text-[#a8b3ac] hover:bg-[#1e2023] hover:text-[#8bd6b6]"
              aria-label={t('portal.components.orderForm.aria_decrease')}
            >−</button>
            <input
              type="number"
              min={1}
              max={1000}
              value={quantity}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setQuantity(Math.min(1000, Math.max(1, Math.floor(v))));
              }}
              required
              className="w-full bg-transparent text-center text-base font-bold tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(1000, q + 1))}
              className="flex w-12 items-center justify-center text-lg font-bold text-[#a8b3ac] hover:bg-[#1e2023] hover:text-[#8bd6b6]"
              aria-label={t('portal.components.orderForm.aria_increase')}
            >+</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#a8b3ac] mb-1.5">{t('portal.components.orderForm.label_customer')}</label>
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            required
            placeholder={t('portal.components.orderForm.placeholder_customer')}
            className="w-full rounded-lg border border-[#3f4944]/40 bg-[#0c0e11] px-3 py-2.5 text-sm outline-none focus:border-[#8bd6b6]"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#a8b3ac] mb-1.5">{t('portal.components.orderForm.label_phone')}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder={t('portal.components.orderForm.placeholder_phone')}
            className="w-full rounded-lg border border-[#3f4944]/40 bg-[#0c0e11] px-3 py-2.5 text-sm font-mono outline-none focus:border-[#8bd6b6]"
          />
        </div>
      </div>

      <div className="rounded-lg border border-[#3f4944]/30 bg-[#0f1113] p-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[#8bd6b6] font-bold">{t('portal.components.orderForm.shipping_address')}</p>
        <AddressPicker value={address} onChange={setAddress} />
      </div>

      <InvoiceFieldsSection value={invoice} onChange={setInvoice} />

      <div className="flex items-center gap-2 rounded-lg border border-[#3f4944]/40 bg-[#0c0e11] px-3 py-2.5 text-xs text-[#a8b3ac]">
        <span className="material-symbols-outlined text-[16px] text-[#10b981]">schedule</span>
        {t('portal.components.orderForm.auto_record_note')}
      </div>

      <div className="rounded-lg border border-[#3f4944]/40 bg-[#0c0e11] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#a8b3ac]">{t('portal.components.orderForm.unit_price')}</span>
          <span className="font-mono tabular-nums text-[#e2e2e6]">{fmtVnd(unitPrice)} ₫</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-[#a8b3ac]">{t('portal.components.orderForm.label_quantity')}</span>
          <span className="font-mono tabular-nums text-[#e2e2e6]">× {quantity}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#3f4944]/30 pt-3">
          <span className="text-[11px] uppercase tracking-wider text-[#a8b3ac]">{t('portal.components.orderForm.total_amount')}</span>
          <span className="font-headline text-2xl text-[#8bd6b6] tabular-nums">{fmtVnd(totalPrice)} ₫</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[#065f46] py-3 font-bold text-white shadow-lg  transition-all hover:bg-[#065f46]/90 active:scale-95 disabled:opacity-50"
      >
        {busy ? t('portal.components.orderForm.submitting') : t('portal.components.orderForm.submit')}
      </button>
    </form>
  );
}
