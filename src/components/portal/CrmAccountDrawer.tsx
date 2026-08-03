'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import {
  createCrmAccount, updateCrmAccount, lookupCrmPhones,
} from '@/lib/portal-queries';
import type { CrmAccount, CrmAccountKind, CrmOrgType, CrmPhoneMatch, CrmSource } from '@/lib/portal-types';

const SOURCES: CrmSource[] = ['website', 'zalo', 'facebook', 'google_ads', 'tiktok', 'referral', 'hotline', 'event', 'other'];
const ORG_TYPES: CrmOrgType[] = ['benh_vien_cong', 'benh_vien_tu', 'phong_kham', 'spa', 'dai_ly', 'khac'];

interface Props {
  open: boolean;
  account: CrmAccount | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CrmAccountDrawer({ open, account, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CrmAccountKind>('customer');
  const [phone, setPhone] = useState('');
  const [zalo, setZalo] = useState('');
  const [email, setEmail] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [source, setSource] = useState<CrmSource | ''>('');
  const [orgType, setOrgType] = useState<CrmOrgType | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<CrmPhoneMatch | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setKind(account?.kind ?? 'customer');
    setPhone(account?.phone ?? '');
    setZalo(account?.zalo_phone ?? '');
    setEmail(account?.email ?? '');
    setProvince(account?.province ?? '');
    setAddress(account?.address ?? '');
    setSource(account?.source ?? '');
    setOrgType(account?.org_type ?? '');
    setNotes(account?.notes ?? '');
    setDup(null);
  }, [open, account]);

  // Tra ngay khi rời ô số điện thoại. Trigger dưới DB mới là chốt chặn thật; ở đây
  // chỉ báo sớm để nhân viên biết khách đã có chủ và xin bắn khách thay vì gõ tiếp.
  const checkPhone = async (value: string) => {
    if (!value.trim()) { setDup(null); return; }
    try {
      const hits = await lookupCrmPhones([value]);
      setDup(hits.find(h => h.account_id !== account?.id) ?? null);
    } catch {
      setDup(null);
    }
  };

  const save = async () => {
    if (!name.trim()) { toast.error(t('portal.crm.account.name_required')); return; }
    setSaving(true);
    try {
      const input = {
        name, kind, phone, email, zaloPhone: zalo, province, address,
        source: source || null, orgType: orgType || null, notes, ownerId,
      };
      if (account) await updateCrmAccount(account.id, input);
      else await createCrmAccount(input);
      toast.success(t('portal.crm.account.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff8a50]';
  const label = 'mb-1 block text-xs text-[var(--crm-muted)]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-[var(--crm-s2)] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--crm-text)]">
            {account ? t('portal.crm.account.edit') : t('portal.crm.account.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[var(--crm-muted)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-acc-name">{t('portal.crm.account.name')}</label>
            <input id="crm-acc-name" className={field} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-kind">{t('portal.crm.account.kind')}</label>
            <select id="crm-acc-kind" className={field} value={kind} onChange={e => setKind(e.target.value as CrmAccountKind)}>
              <option value="customer">{t('portal.crm.account.kind_customer')}</option>
              <option value="dealer_prospect">{t('portal.crm.account.kind_prospect')}</option>
            </select>
          </div>
          {/* Loại cơ sở chỉ hỏi với khách tổ chức. Riêng "đại lý phân phối" mới
              được hưởng dải chiết khấu, nơi khác mua về dùng trả giá niêm yết. */}
          {kind === 'dealer_prospect' && (
            <div>
              <label className={label} htmlFor="crm-acc-org">{t('portal.crm.account.org_type')}</label>
              <select
                id="crm-acc-org" className={field}
                value={orgType} onChange={e => setOrgType(e.target.value as CrmOrgType | '')}
              >
                <option value="">—</option>
                {ORG_TYPES.map(o => (
                  <option key={o} value={o}>{t('portal.crm.org.' + o)}</option>
                ))}
              </select>
              {orgType === 'dai_ly' && (
                <p className="mt-1 text-xs text-[#ffb77d]">{t('portal.crm.account.org_dealer_hint')}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-acc-phone">{t('portal.crm.account.phone')}</label>
              <input
                id="crm-acc-phone" className={field} value={phone}
                onChange={e => setPhone(e.target.value)}
                onBlur={e => void checkPhone(e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="crm-acc-zalo">Zalo</label>
              <input id="crm-acc-zalo" className={field} value={zalo} onChange={e => setZalo(e.target.value)} />
            </div>
          </div>
          {dup && (
            <div className="rounded-xl border border-[#ff8a50] bg-[#ff8a50]/10 px-3 py-2">
              <p className="text-sm font-semibold text-[#ff8a50]">{t('portal.crm.account.dup_title')}</p>
              <p className="mt-1 text-sm text-[var(--crm-text)]">{dup.name}{dup.code ? ` · ${dup.code}` : ''}</p>
              <p className="mt-0.5 text-xs text-[var(--crm-muted)]">
                {t('portal.crm.account.dup_owner')}: {dup.owner_name || '—'}
                {dup.is_mine ? ` · ${t('portal.crm.account.dup_mine')}` : ''}
              </p>
              {!dup.is_mine && (
                <p className="mt-1 text-xs text-[#ffb77d]">{t('portal.crm.account.dup_hint')}</p>
              )}
            </div>
          )}
          <div>
            <label className={label} htmlFor="crm-acc-email">Email</label>
            <input id="crm-acc-email" className={field} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-acc-province">{t('portal.crm.account.province')}</label>
              <input id="crm-acc-province" className={field} value={province} onChange={e => setProvince(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="crm-acc-source">{t('portal.crm.account.source')}</label>
              <select id="crm-acc-source" className={field} value={source} onChange={e => setSource(e.target.value as CrmSource | '')}>
                <option value="">—</option>
                {SOURCES.map(s => <option key={s} value={s}>{t('portal.crm.source.' + s)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-address">{t('portal.crm.account.address')}</label>
            <input id="crm-acc-address" className={field} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-acc-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8692a] py-3 font-bold text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>


      </div>
    </div>
  );
}
