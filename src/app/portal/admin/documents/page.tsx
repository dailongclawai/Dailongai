'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { getSalesDocuments, uploadSalesDoc, createSalesDocument, deleteSalesDocument, getSalesDocUrl } from '@/lib/portal-queries';
import type { SalesDocument, DocCategory, DocVisibility } from '@/lib/portal-types';

const catLabel: Record<DocCategory, string> = {
  catalog: 'Catalog', video: 'Video', contract_template: 'Mẫu hợp đồng', manual: 'Hướng dẫn',
};
const visLabel: Record<DocVisibility, string> = {
  all: 'Tất cả', dealer: 'Đại lý', supervisor: 'Supervisor',
};

export default function AdminDocumentsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [docs, setDocs] = useState<SalesDocument[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('catalog');
  const [visibility, setVisibility] = useState<DocVisibility>('all');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => { setDocs(await getSalesDocuments()); }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  const upload = async () => {
    if (!title.trim() || !file) {
      toast.error('Nhập tiêu đề và chọn tệp');
      return;
    }
    setBusy(true);
    try {
      const path = await uploadSalesDoc(file);
      await createSalesDocument({ title: title.trim(), file_url: path, category, visible_to: visibility });
      toast.success('Đã tải tài liệu lên');
      setTitle(''); setFile(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi tải lên');
    } finally {
      setBusy(false);
    }
  };

  const open = async (doc: SalesDocument) => {
    const url = await getSalesDocUrl(doc.file_url);
    if (url) window.open(url, '_blank');
    else toast.error('Không mở được tệp');
  };

  const remove = async (id: string) => {
    setBusy(true);
    try { await deleteSalesDocument(id); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Lỗi'); }
    finally { setBusy(false); }
  };

  const input = 'w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]';

  return (
    <PortalShell variant="admin" nav={<AdminNav />}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Hỗ trợ bán hàng</p>
        <h1 className="mt-2 font-headline text-4xl">Tài liệu</h1>
        <p className="mt-2 text-sm text-[#e2e2e5]/60">Catalog, mẫu hợp đồng, video, hướng dẫn cho đại lý &amp; supervisor.</p>
      </div>

      <div className="mb-8 rounded-2xl border border-white/12 bg-[#1e2022] p-6">
        <h2 className="mb-4 font-headline text-xl">Tải tài liệu mới</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/70">Tiêu đề</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Catalog ZhiDun CEO 2026" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/70">Loại</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as DocCategory)} className={input}>
              {Object.entries(catLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/70">Hiển thị cho</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as DocVisibility)} className={input}>
              {Object.entries(visLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/70">Tệp (PDF, ảnh, MP4 — tối đa 50MB)</label>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-[#e2e2e5]/70 file:mr-3 file:rounded-full file:border-0 file:bg-[#ff5625] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#ff8a5c]" />
          </div>
        </div>
        <div className="mt-4">
          <button onClick={upload} disabled={busy} className="rounded-full bg-[#ff5625] px-6 py-2.5 text-sm font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff8a5c] disabled:opacity-50">
            {busy ? 'Đang tải…' : 'Tải lên'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-white/12 bg-white/5 text-[10px] uppercase tracking-wider text-[#e2e2e5]/60">
            <tr>
              <th className="px-4 py-3">Tiêu đề</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Hiển thị</th>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#e2e2e5]/50">Chưa có tài liệu nào.</td></tr>
            ) : docs.map((d) => (
              <tr key={d.id} className="border-t border-white/12 hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{d.title}</td>
                <td className="px-4 py-3 text-[#e2e2e5]/70">{catLabel[d.category]}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-[#e2e2e5]/70">{visLabel[d.visible_to]}</span></td>
                <td className="px-4 py-3 font-mono tabular-nums text-xs text-[#e2e2e5]/60">{new Date(d.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => open(d)} className="mr-3 text-xs text-[#ff5625] hover:underline">Mở</button>
                  <button onClick={() => remove(d.id)} disabled={busy} className="text-xs text-[#f87171] hover:underline disabled:opacity-50">Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
