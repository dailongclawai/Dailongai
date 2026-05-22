'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getActiveModels, recordOrderBatch } from '@/lib/portal-queries';
import type { BatchItem } from '@/lib/portal-queries';
import type { ProductModel } from '@/lib/portal-types';

const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };
const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

interface CartItem {
  key: number;
  model: ProductModel;
  serial: string;
}

let _seq = 0;

export function OrderForm({ userId: _userId }: { userId: string }) {
  const router = useRouter();
  const [models, setModels] = useState<ProductModel[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    saleDate: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getActiveModels().then(setModels);
  }, []);

  const addToCart = (model: ProductModel) => {
    setCart((c) => [...c, { key: ++_seq, model, serial: '' }]);
  };

  const removeFromCart = (key: number) => {
    setCart((c) => c.filter((i) => i.key !== key));
  };

  const updateSerial = (key: number, serial: string) => {
    setCart((c) => c.map((i) => (i.key === key ? { ...i, serial } : i)));
  };

  const setC = (k: keyof typeof customer, v: string) =>
    setCustomer((c) => ({ ...c, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (cart.length === 0) e.cart = 'Thêm ít nhất 1 máy vào đơn';
    cart.forEach((item) => {
      if (item.serial.trim().length < 3)
        e[`serial_${item.key}`] = 'Serial tối thiểu 3 ký tự';
    });
    if (customer.name.trim().length < 2) e.name = 'Nhập tên khách';
    if (!/^0\d{9,10}$/.test(customer.phone)) e.phone = 'SĐT không hợp lệ';
    if (!customer.saleDate) e.saleDate = 'Chọn ngày bán';
    return e;
  };

  const checkout = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setBusy(true);
    try {
      const items: BatchItem[] = cart.map((i) => ({
        model_id: i.model.id,
        serial_number: i.serial.trim(),
        sale_price: Number(i.model.base_price),
      }));
      const count = await recordOrderBatch({
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        customerAddress: customer.address.trim() || null,
        saleDate: customer.saleDate,
        receiptImageUrl: null,
        items,
      });
      toast.success(`Đã ghi nhận ${count} máy, chờ admin duyệt`);
      router.replace('/portal/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi ghi nhận đơn');
      setBusy(false);
    }
  };

  const total = cart.reduce((s, i) => s + Number(i.model.base_price), 0);

  return (
    <div className="space-y-8">
      {/* Product catalog */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Sản phẩm</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <div
              key={m.id}
              className="flex flex-col justify-between rounded-2xl border border-[#0e1525]/15 bg-white/80 p-5"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">{m.code}</p>
                <p className="mt-1 font-medium text-[#0e1525]">{m.name}</p>
                <p style={numeric} className="mt-2 text-lg font-semibold text-[#bc7e3b]">
                  {fmtVnd(Number(m.base_price))} đ
                </p>
              </div>
              <button
                type="button"
                onClick={() => addToCart(m)}
                className="mt-4 rounded-full border border-[#0e1525] px-4 py-2 text-xs font-medium text-[#0e1525] transition-colors hover:bg-[#0e1525] hover:text-[#f5f1e8]"
              >
                + Thêm vào đơn
              </button>
            </div>
          ))}
        </div>
        {errors.cart && <p className="mt-2 text-xs text-[#c46a5e]">{errors.cart}</p>}
      </section>

      {/* Cart */}
      {cart.length > 0 && (
        <section>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#5d8d6a]">
            Đơn hàng — {cart.length} máy
          </p>
          <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
            <table className="w-full text-sm">
              <thead className="border-b border-[#0e1525]/10 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
                <tr>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Số serial</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.key} className="border-t border-[#0e1525]/10">
                    <td className="px-4 py-3 text-xs text-[#0e1525]/70">
                      {item.model.code}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="VD: ZD-A-0001"
                        value={item.serial}
                        onChange={(e) => updateSerial(item.key, e.target.value)}
                        className="w-40 rounded-lg border border-[#0e1525]/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#0e1525]"
                      />
                      {errors[`serial_${item.key}`] && (
                        <p className="mt-1 text-xs text-[#c46a5e]">
                          {errors[`serial_${item.key}`]}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" style={numeric}>
                      {fmtVnd(Number(item.model.base_price))} đ
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.key)}
                        className="text-lg leading-none text-[#c46a5e] hover:text-[#a0393d]"
                        aria-label="Xoá"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#0e1525]/15 bg-[#f5f1e8]">
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#0e1525]/60"
                  >
                    Tổng cộng
                  </td>
                  <td
                    className="px-4 py-3 text-right font-semibold text-[#bc7e3b]"
                    style={numeric}
                  >
                    {fmtVnd(total)} đ
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Customer info */}
      {cart.length > 0 && (
        <section>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#0e1525]/60">
            Thông tin khách hàng
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/50">
                Tên khách *
              </label>
              <input
                type="text"
                value={customer.name}
                onChange={(e) => setC('name', e.target.value)}
                className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
              />
              {errors.name && <p className="mt-1 text-xs text-[#c46a5e]">{errors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/50">
                SĐT khách *
              </label>
              <input
                type="tel"
                value={customer.phone}
                onChange={(e) => setC('phone', e.target.value)}
                className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
              />
              {errors.phone && <p className="mt-1 text-xs text-[#c46a5e]">{errors.phone}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/50">
                Ngày bán *
              </label>
              <input
                type="date"
                value={customer.saleDate}
                onChange={(e) => setC('saleDate', e.target.value)}
                className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
              />
              {errors.saleDate && (
                <p className="mt-1 text-xs text-[#c46a5e]">{errors.saleDate}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/50">
                Địa chỉ (tuỳ chọn)
              </label>
              <input
                type="text"
                value={customer.address}
                onChange={(e) => setC('address', e.target.value)}
                className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
              />
            </div>
          </div>
        </section>
      )}

      {/* Order summary + checkout */}
      {cart.length > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-[#bc7e3b]/30 bg-[#bc7e3b]/5 px-6 py-5">
          <div className="flex-1">
            <p className="text-xs text-[#0e1525]/60">{cart.length} máy · tổng giá trị</p>
            <p style={numeric} className="mt-1 text-2xl font-semibold text-[#bc7e3b]">
              {fmtVnd(total)} đ
            </p>
          </div>
          <button
            type="button"
            onClick={checkout}
            disabled={busy}
            className="rounded-full bg-[#0e1525] px-8 py-3 text-sm font-medium text-[#f5f1e8] transition-colors hover:bg-[#bc7e3b] disabled:opacity-50"
          >
            {busy ? 'Đang gửi…' : 'Đặt hàng'}
          </button>
        </div>
      )}
    </div>
  );
}
