'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import { getAllModels, createModel, updateModel } from '@/lib/portal-queries';
import type { ProductModel } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const emptyForm = { id: '', code: '', name: '', description: '', base_price: '', dealer_price: '', active: true };

export default function AdminProductsPage() {
  const router = useRouter();
  const { t } = useI18n();
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
    setForm({ id: m.id, code: m.code, name: m.name, description: m.description ?? '', base_price: String(Number(m.base_price)), dealer_price: m.dealer_price ? String(Number(m.dealer_price)) : '', active: m.active });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    const price = Number(form.base_price.replace(/[^\d]/g, ''));
    const dealerRaw = form.dealer_price.replace(/[^\d]/g, '');
    const dealerPrice = dealerRaw ? Number(dealerRaw) : null;
    if (!form.code.trim() || !form.name.trim() || !(price >= 0)) {
      toast.error(t('portal.admin.products.toast.invalid'));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        base_price: price,
        dealer_price: dealerPrice,
        active: form.active,
      };
      if (form.id) await updateModel(form.id, payload);
      else await createModel(payload);
      toast.success(form.id ? t('portal.admin.products.toast.updated') : t('portal.admin.products.toast.created'));
      setForm({ ...emptyForm });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.admin.products.toast.save_error'));
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
      toast.error(e instanceof Error ? e.message : t('portal.admin.products.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-lg border border-[#49443f]/50 bg-[#1a1c1f] px-3 py-2 text-sm text-[#e2e2e6] placeholder:text-[#e2e2e6]/40 outline-none focus:border-[#ff8a50]';

  return (
    <PortalShell variant="admin">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff8a50]">{t('portal.admin.products.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-4xl">{t('portal.admin.products.title')}</h1>
        <p className="mt-2 text-sm text-[#e2e2e6]/60">{t('portal.admin.products.subtitle')}</p>
      </div>

      <div className="mb-8 rounded-2xl border border-[#49443f]/40 bg-[#1a1c1f] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-xl">{form.id ? t('portal.admin.products.form.title_edit') : t('portal.admin.products.form.title_create')}</h2>
          {form.id && (
            <button onClick={() => setForm({ ...emptyForm })} className="text-xs text-[#e2e2e6]/60 hover:text-[#ff8a50]">{t('portal.admin.products.form.add_new')}</button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/70">{t('portal.admin.products.form.code_label')}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t('portal.admin.products.form.code_placeholder')} className={`${input} font-mono`} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/70">{t('portal.admin.products.form.name_label')}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('portal.admin.products.form.name_placeholder')} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/70">{t('portal.admin.products.form.price_label')}</label>
            <input value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} placeholder="29500000" className={`${input} font-mono tabular-nums`} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/70">{t('portal.admin.products.form.dealer_price_label')}</label>
            <input value={form.dealer_price} onChange={(e) => setForm({ ...form, dealer_price: e.target.value })} placeholder="24000000" className={`${input} font-mono tabular-nums`} />
            <p className="mt-1 text-[11px] text-[#e2e2e6]/50">{t('portal.admin.products.form.dealer_price_hint')}</p>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-[#e2e2e6]/80">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#ff8a50]" />
              {t('portal.admin.products.status.active')}
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e6]/70">{t('portal.admin.products.form.description_label')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder={t('portal.admin.products.form.description_placeholder')} className={input} />
          </div>
        </div>
        <div className="mt-4">
          <button onClick={save} disabled={busy} className="rounded-full bg-[#e8692a] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e8692a]/90 disabled:opacity-50">
            {form.id ? t('portal.admin.products.form.save_edit') : t('portal.admin.products.form.save_create')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-[#49443f]/40 bg-[#1a1c1f]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-[#49443f]/40 bg-[#1e2023]/40 text-[10px] uppercase tracking-wider text-[#e2e2e6]/60">
            <tr>
              <th className="px-4 py-3">{t('portal.admin.products.table.code')}</th>
              <th className="px-4 py-3">{t('portal.admin.products.table.name')}</th>
              <th className="px-4 py-3 text-right">{t('portal.admin.products.table.price')}</th>
              <th className="px-4 py-3 text-right">{t('portal.admin.products.table.dealer_price')}</th>
              <th className="px-4 py-3 text-center">{t('portal.admin.products.table.status')}</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#e2e2e6]/50">{t('portal.admin.products.table.empty')}</td></tr>
            ) : models.map((m) => (
              <tr key={m.id} className="border-t border-[#49443f]/40 hover:bg-[#1e2023]/40">
                <td className="px-4 py-3 font-mono text-[#e2e2e6]/80">{m.code}</td>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(Number(m.base_price))}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#e2e2e6]/70">{m.dealer_price ? fmtVnd(Number(m.dealer_price)) : '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${m.active ? 'bg-[#ff5625]/15 text-[#ff5625]' : 'bg-[#1e2023] text-[#e2e2e6]/50'}`}>
                    {m.active ? t('portal.admin.products.status.active') : t('portal.admin.products.status.hidden')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => edit(m)} className="mr-3 text-xs text-[#ff8a50] hover:underline">{t('portal.admin.products.action.edit')}</button>
                  <button onClick={() => toggle(m)} disabled={busy} className="text-xs text-[#e2e2e6]/60 hover:text-[#e2e2e6] disabled:opacity-50">
                    {m.active ? t('portal.admin.products.action.hide') : t('portal.admin.products.action.show')}
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
