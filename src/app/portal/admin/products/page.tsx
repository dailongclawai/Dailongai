'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { getAllModels, createModel, updateModel } from '@/lib/portal-queries';
import type { ProductModel } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const emptyForm = { id: '', code: '', name: '', description: '', base_price: '', active: true };

export default function AdminProductsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [models, setModels] = useState<ProductModel[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setModels(await getAllModels());
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  const edit = (m: ProductModel) => {
    setForm({ id: m.id, code: m.code, name: m.name, description: m.description ?? '', base_price: String(Number(m.base_price)), active: m.active });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    const price = Number(form.base_price.replace(/[^\d]/g, ''));
    if (!form.code.trim() || !form.name.trim() || !(price >= 0)) {
      toast.error('Nhập mã, tên và giá hợp lệ');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        base_price: price,
        active: form.active,
      };
      if (form.id) await updateModel(form.id, payload);
      else await createModel(payload);
      toast.success(form.id ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm');
      setForm({ ...emptyForm });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi lưu sản phẩm');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (m: ProductModel) => {
    setBusy(true);
    try {
      await updateModel(m.id, { active: !m.active });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-lg border border-[#1f2937]/50 bg-[#11151a] px-3 py-2 text-sm text-[#e7eaf0] placeholder:text-[#e7eaf0]/40 outline-none focus:border-[#ff5625]';

  return (
    <PortalShell variant="admin" nav={<AdminNav />}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Danh mục</p>
        <h1 className="mt-2 font-headline text-4xl">Sản phẩm máy</h1>
        <p className="mt-2 text-sm text-[#e7eaf0]/60">Đại lý chỉ ghi nhận đơn cho các model đang bật.</p>
      </div>

      <div className="mb-8 rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-xl">{form.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
          {form.id && (
            <button onClick={() => setForm({ ...emptyForm })} className="text-xs text-[#e7eaf0]/60 hover:text-[#ff5625]">+ Thêm mới</button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/70">Mã model</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VD: ZHIDUN-CEO" className={`${input} font-mono`} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/70">Tên sản phẩm</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: ZhiDun CEO" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/70">Giá niêm yết (đ)</label>
            <input value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} placeholder="29500000" className={`${input} font-mono tabular-nums`} />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-[#e7eaf0]/80">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#ff5625]" />
              Đang bán
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e7eaf0]/70">Mô tả</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Máy laser bán dẫn 650nm…" className={input} />
          </div>
        </div>
        <div className="mt-4">
          <button onClick={save} disabled={busy} className="rounded-full bg-[#ff5625] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#ff5625]/90 disabled:opacity-50">
            {form.id ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3 text-right">Giá (đ)</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#e7eaf0]/50">Chưa có sản phẩm. Thêm model đầu tiên ở trên.</td></tr>
            ) : models.map((m) => (
              <tr key={m.id} className="border-t border-[#1f2937]/40 hover:bg-[#1a1f26]/40">
                <td className="px-4 py-3 font-mono text-[#e7eaf0]/80">{m.code}</td>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(Number(m.base_price))}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${m.active ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-[#1a1f26] text-[#e7eaf0]/50'}`}>
                    {m.active ? 'Đang bán' : 'Ẩn'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => edit(m)} className="mr-3 text-xs text-[#ff5625] hover:underline">Sửa</button>
                  <button onClick={() => toggle(m)} disabled={busy} className="text-xs text-[#e7eaf0]/60 hover:text-[#e7eaf0] disabled:opacity-50">
                    {m.active ? 'Ẩn' : 'Hiện'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
