'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getPublicActiveModels,
  submitPublicOrder,
  type PublicActiveModel,
} from '@/lib/portal-queries';
import { AddressPicker, emptyAddress, fullAddress, type AddressValue } from '@/components/portal/AddressPicker';
import { InvoiceFieldsSection, emptyInvoice, validateInvoice, type InvoiceInfo } from '@/components/portal/InvoiceFieldsSection';
import { useI18n } from '@/lib/i18n';
import { PaymentQRCard } from '@/components/portal/PaymentQRCard';
import { ProductPicker } from '@/components/portal/ProductPicker';
import { trackReferral } from '@/lib/referral-tracker';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export interface QuickCheckoutProps {
  slug: string;
  surface: 'public';
  dealerName?: string | null;
  dealerId?: string | null;
  hideProductPicker?: boolean;
  onClose?: () => void;
}

export function QuickCheckout({
  slug,
  surface,
  dealerName,
  dealerId,
  hideProductPicker,
  // onClose is available for modal callers; not used in the form itself
  onClose: _onClose,  // eslint-disable-line @typescript-eslint/no-unused-vars
}: QuickCheckoutProps) {
  const { t } = useI18n();

  const [models, setModels] = useState<PublicActiveModel[]>([]);
  const [modelId, setModelId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [invoice, setInvoice] = useState<InvoiceInfo>(emptyInvoice);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<number>(0);

  useEffect(() => {
    getPublicActiveModels().then((ms) => {
      setModels(ms);
      if (ms[0]) setModelId(ms[0].id);
    });
  }, []);

  // Track dealer QR view (dedup'd per browser per day)
  useEffect(() => {
    if (dealerId) {
      void trackReferral({ eventType: 'dealer_view', dealerId });
    }
  }, [dealerId]);

  const selectedModel = useMemo(() => models.find((m) => m.id === modelId) ?? null, [models, modelId]);
  const unitPrice = selectedModel?.base_price ?? 0;
  const totalPrice = unitPrice * quantity;

  const submit = async () => {
    if (!modelId) { toast.error('Chọn sản phẩm'); return; }
    if (quantity < 1) { toast.error('Số lượng phải ≥ 1'); return; }
    if (!address.province_code || !address.ward_code || !address.detail.trim()) {
      toast.error('Nhập đủ tỉnh, phường và địa chỉ chi tiết'); return;
    }
    const invoiceErr = validateInvoice(invoice);
    if (invoiceErr) { toast.error(t(invoiceErr)); return; }
    setBusy(true);
    try {
      const newOrderId = await submitPublicOrder({
        slug,
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
      setOrderId(newOrderId);
      setPaidAmount(totalPrice);
      setDone(true);
      toast.success('Đã gửi đơn — chuyển khoản theo QR bên dưới');
      // Track every QR-attributed order (DB trigger only handles first ever)
      if (dealerId) void trackReferral({ eventType: 'dealer_order', dealerId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi gửi đơn');
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#121416] text-[#e2e2e5] py-10 px-4">
        <div className="mx-auto max-w-lg">
          <div className="text-center mb-6">
            <span className="material-symbols-outlined text-emerald-400 text-[56px]">check_circle</span>
            <h1 className="font-headline text-2xl mt-2">Đã ghi nhận đơn</h1>
            {dealerName && (
              <p className="text-sm text-[#a0a0a8] mt-1">
                Đơn đã gửi tới <span className="text-[#ff5625] font-bold">{dealerName}</span>
              </p>
            )}
          </div>

          <PaymentQRCard orderId={orderId} amount={paidAmount} dealerName={dealerName} surface={surface} />

          <button
            onClick={() => { setDone(false); setOrderId(''); setQuantity(1); setCustomer(''); setPhone(''); setAddress(emptyAddress); setInvoice(emptyInvoice); }}
            className="mt-6 w-full rounded-lg border border-[#3d3f41]/40 bg-[#1a1c1e] py-2 text-xs text-[#a0a0a8] hover:text-[#e2e2e5]"
          >
            Gửi đơn khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121416] text-[#e2e2e5] py-10 px-4">
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625] font-bold">Đại Long Medical</p>
          <h1 className="font-headline text-3xl mt-2">Đặt đơn nhanh</h1>
          {dealerName && (
            <p className="text-sm text-[#a0a0a8] mt-2">
              Đại lý phụ trách: <span className="font-bold text-[#e2e2e5]">{dealerName}</span>
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="rounded-2xl border border-[#3d3f41]/40 bg-[#1a1c1e] p-6 space-y-4"
        >
          {!hideProductPicker && (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#a0a0a8] mb-1.5">Sản phẩm</label>
              <ProductPicker models={models} selectedId={modelId} onSelect={setModelId} surface="public" />
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#a0a0a8] mb-1.5">Số lượng</label>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-[#3d3f41]/40 bg-[#121416]">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex w-12 items-center justify-center text-lg font-bold text-[#a0a0a8] hover:bg-[#282a2c] hover:text-[#ff5625]"
                aria-label="Giảm"
              >
                −
              </button>
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
                className="flex w-12 items-center justify-center text-lg font-bold text-[#a0a0a8] hover:bg-[#282a2c] hover:text-[#ff5625]"
                aria-label="Tăng"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#a0a0a8] mb-1.5">Tên khách hàng</label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              required
              placeholder="Họ tên khách"
              className="w-full rounded-lg border border-[#3d3f41]/40 bg-[#121416] px-3 py-2.5 text-sm outline-none focus:border-[#ff5625]"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#a0a0a8] mb-1.5">Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="VD: 0903 123 456"
              className="w-full rounded-lg border border-[#3d3f41]/40 bg-[#121416] px-3 py-2.5 text-sm font-mono outline-none focus:border-[#ff5625]"
            />
          </div>

          <div className="rounded-lg border border-[#3d3f41]/30 bg-[#0f1113] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[#ff5625] font-bold">Địa chỉ giao hàng</p>
            <AddressPicker value={address} onChange={setAddress} />
          </div>

          <InvoiceFieldsSection value={invoice} onChange={setInvoice} />

          {/* Price summary */}
          <div className="rounded-lg border border-[#3d3f41]/40 bg-[#121416] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#a0a0a8]">Đơn giá công bố</span>
              <span className="font-mono tabular-nums text-[#e2e2e5]">{fmtVnd(unitPrice)} ₫</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-[#a0a0a8]">Số lượng</span>
              <span className="font-mono tabular-nums text-[#e2e2e5]">× {quantity}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#3d3f41]/30 pt-3">
              <span className="text-[11px] uppercase tracking-wider text-[#a0a0a8]">Thành tiền</span>
              <span className="font-headline text-2xl text-[#ff5625] tabular-nums">{fmtVnd(totalPrice)} ₫</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#ff5625] py-3 font-bold text-white shadow-lg shadow-[#ff5625]/20 transition-all hover:bg-[#ff5625]/90 active:scale-95 disabled:opacity-50"
          >
            {busy ? 'Đang gửi…' : dealerName ? 'Gửi đơn' : 'Đặt & thanh toán'}
          </button>

          <p className="text-[11px] text-[#a0a0a8]/70 text-center pt-2 border-t border-[#3d3f41]/30">
            Đơn sẽ được Đại Long Medical duyệt trong giờ hành chính. Đại lý sẽ liên hệ với khách hàng để hoàn tất.
          </p>
        </form>
      </div>
    </div>
  );
}
