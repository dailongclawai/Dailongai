'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { CrmHandoverDialog } from './CrmHandoverDialog';
import {
  createCrmAccount, updateCrmAccount, getCrmContacts, createCrmContact, deleteCrmContact,
} from '@/lib/portal-queries';
import type { CrmAccount, CrmAccountKind, CrmContact, CrmSource } from '@/lib/portal-types';

const SOURCES: CrmSource[] = ['website', 'zalo', 'facebook', 'google_ads', 'tiktok', 'referral', 'hotline', 'event', 'other'];

interface Props {
  open: boolean;
  account: CrmAccount | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CrmAccountDrawer({ open, account, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CrmAccountKind>('customer');
  const [phone, setPhone] = useState('');
  const [zalo, setZalo] = useState('');
  const [email, setEmail] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [source, setSource] = useState<CrmSource | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [newContact, setNewContact] = useState({ full_name: '', phone: '', title: '' });
  const [handoverOpen, setHandoverOpen] = useState(false);

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
    setNotes(account?.notes ?? '');
    if (account) getCrmContacts(account.id).then(setContacts).catch(() => setContacts([]));
    else setContacts([]);
  }, [open, account]);

  const save = async () => {
    if (!name.trim()) { toast.error(t('portal.crm.account.name_required')); return; }
    setSaving(true);
    try {
      const input = {
        name, kind, phone, email, zaloPhone: zalo, province, address,
        source: source || null, notes, ownerId,
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

  const addContact = async () => {
    if (!account || !newContact.full_name.trim()) return;
    try {
      await createCrmContact({
        accountId: account.id,
        fullName: newContact.full_name,
        phone: newContact.phone,
        title: newContact.title,
        isPrimary: contacts.length === 0,
        ownerId,
      });
      setNewContact({ full_name: '', phone: '', title: '' });
      setContacts(await getCrmContacts(account.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeContact = async (id: string) => {
    try {
      await deleteCrmContact(id);
      if (account) setContacts(await getCrmContacts(account.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[#a0a0a8]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-[#1e2022] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#e2e2e5]">
            {account ? t('portal.crm.account.edit') : t('portal.crm.account.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[#a0a0a8]">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-acc-phone">{t('portal.crm.account.phone')}</label>
              <input id="crm-acc-phone" className={field} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="crm-acc-zalo">Zalo</label>
              <input id="crm-acc-zalo" className={field} value={zalo} onChange={e => setZalo(e.target.value)} />
            </div>
          </div>
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
            className="w-full rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>

        {account && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-bold text-[#e2e2e5]">{t('portal.crm.contact.section')}</h3>
            <ul className="mb-3 space-y-2">
              {contacts.map(c => (
                <li key={c.id} className="flex items-center justify-between rounded-xl bg-[#282a2c] px-3 py-2">
                  <span className="text-sm text-[#e2e2e5]">
                    {c.full_name}
                    {c.title ? ` · ${c.title}` : ''}
                    {c.phone ? ` · ${c.phone}` : ''}
                    {c.is_primary ? ' ★' : ''}
                  </span>
                  <button onClick={() => removeContact(c.id)} aria-label={t('portal.crm.contact.delete')} className="text-[#a0a0a8]">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </li>
              ))}
              {contacts.length === 0 && <li className="text-sm text-[#a0a0a8]">{t('portal.crm.contact.empty')}</li>}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              <input
                className={field} placeholder={t('portal.crm.contact.name')} aria-label={t('portal.crm.contact.name')}
                value={newContact.full_name}
                onChange={e => setNewContact({ ...newContact, full_name: e.target.value })}
              />
              <input
                className={field} placeholder={t('portal.crm.contact.title')} aria-label={t('portal.crm.contact.title')}
                value={newContact.title}
                onChange={e => setNewContact({ ...newContact, title: e.target.value })}
              />
              <input
                className={field} placeholder={t('portal.crm.account.phone')} aria-label={t('portal.crm.account.phone')}
                value={newContact.phone}
                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <button onClick={addContact} className="mt-2 w-full rounded-xl border border-[#3d3f41] py-2 text-sm text-[#e2e2e5]">
              {t('portal.crm.contact.add')}
            </button>
          </div>
        )}

        {account && profile?.role === 'staff' && profile.staff_segment && (
          <>
            <button
              onClick={() => setHandoverOpen(true)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00daf3] py-2.5 text-sm text-[#00daf3]"
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              {t('portal.crm.handover.button')}
            </button>
            <CrmHandoverDialog
              open={handoverOpen}
              accountId={account.id}
              mySegment={profile.staff_segment}
              onClose={() => setHandoverOpen(false)}
              onDone={() => { onSaved(); onClose(); }}
            />
          </>
        )}
      </div>
    </div>
  );
}
