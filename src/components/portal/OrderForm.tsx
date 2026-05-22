'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { getActiveModels, recordOrder, uploadReceipt } from '@/lib/portal-queries';
import type { ProductModel } from '@/lib/portal-types';

const schema = z.object({
  modelId: z.string().uuid('Chọn model máy'),
  serialNumber: z.string().min(3, 'Số serial tối thiểu 3 ký tự'),
  customerName: z.string().min(2, 'Nhập tên khách'),
  customerPhone: z.string().regex(/^0\d{9,10}$/, 'SĐT khách không hợp lệ'),
  salePrice: z.number().positive('Giá bán phải > 0'),
  saleDate: z.string().min(10, 'Chọn ngày bán'),
});

export function OrderForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [models, setModels] = useState<ProductModel[]>([]);
  const [form, setForm] = useState({
    modelId: '', serialNumber: '', customerName: '', customerPhone: '',
    customerAddress: '', salePrice: '', saleDate: new Date().toISOString().slice(0, 10),
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getActiveModels().then(setModels);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, salePrice: Number(form.salePrice) });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { next[String(i.path[0])] = i.message; });
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      let receiptUrl: string | null = null;
      if (receipt) receiptUrl = await uploadReceipt(userId, receipt);
      await recordOrder({
        modelId: form.modelId,
        serialNumber: form.serialNumber,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerAddress: form.customerAddress || null,
        salePrice: Number(form.salePrice),
        saleDate: form.saleDate,
        receiptImageUrl: receiptUrl,
      });
      toast.success('Đã ghi nhận đơn, chờ admin duyệt');
      router.replace('/portal/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi ghi nhận đơn');
      setBusy(false);
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Model máy</label>
        <select value={form.modelId} onChange={(e) => set('modelId', e.target.value)} className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm">
          <option value="">— Chọn model —</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
        {errors.modelId && <p className="mt-1 text-xs text-[#c46a5e]">{errors.modelId}</p>}
      </div>
      {[
        { k: 'serialNumber', label: 'Số serial máy', type: 'text' },
        { k: 'customerName', label: 'Tên khách hàng', type: 'text' },
        { k: 'customerPhone', label: 'SĐT khách', type: 'tel' },
        { k: 'customerAddress', label: 'Địa chỉ (tùy chọn)', type: 'text' },
        { k: 'salePrice', label: 'Giá bán (VND)', type: 'number' },
        { k: 'saleDate', label: 'Ngày bán', type: 'date' },
      ].map((f) => (
        <div key={f.k}>
          <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">{f.label}</label>
          <input
            type={f.type}
            value={form[f.k as keyof typeof form]}
            onChange={(e) => set(f.k, e.target.value)}
            className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm focus:border-[#0e1525] outline-none"
          />
          {errors[f.k] && <p className="mt-1 text-xs text-[#c46a5e]">{errors[f.k]}</p>}
        </div>
      ))}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Ảnh biên nhận / hợp đồng</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>
      <button type="submit" disabled={busy} className="rounded-full bg-[#0e1525] px-6 py-3 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50">
        {busy ? 'Đang gửi…' : 'Ghi nhận đơn'}
      </button>
    </form>
  );
}
