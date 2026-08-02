'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { createCrmContact, updateCrmContact } from '@/lib/portal-queries';
import type { CrmContact } from '@/lib/portal-types';

interface Props {
  open: boolean;
  accountId: string;
  contact: CrmContact | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Thêm/sửa một đầu mối của khách tổ chức (bác sĩ, kế toán, giám đốc…). */
export function CrmContactDrawer({ open, accountId, contact, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [zalo, setZalo] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [doNotCall, setDoNotCall] = useState(false);
  const [doNotEmail, setDoNotEmail] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(contact?.full_name ?? '');
    setTitle(contact?.title ?? '');
    setPhone(contact?.phone ?? '');
    setEmail(contact?.email ?? '');
    setZalo(contact?.zalo_phone ?? '');
    setIsPrimary(contact?.is_primary ?? false);
    setDoNotCall(contact?.do_not_call ?? false);
    setDoNotEmail(contact?.do_not_email ?? false);
    setNotes(contact?.notes ?? '');
  }, [open, contact]);

  const save = async () => {
    if (!fullName.trim()) { toast.error(t('portal.crm.contact.name_required')); return; }
    setSaving(true);
    try {
      const input = {
        accountId, fullName, title, phone, email, zaloPhone: zalo,
        isPrimary, doNotCall, doNotEmail, notes, ownerId,
      };
      if (contact) await updateCrmContact(contact.id, input);
      else await createCrmContact(input);
      toast.success(t('portal.crm.contact.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#8bd6b6]';
  const label = 'mb-1 block text-xs text-[var(--crm-muted)]';
  const check = 'flex items-center gap-2 text-sm text-[var(--crm-text)]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-[var(--crm-s2)] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--crm-text)]">
            {contact ? t('portal.crm.contact.edit') : t('portal.crm.contact.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[var(--crm-muted)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-ct-name">{t('portal.crm.contact.full_name')}</label>
            <input id="crm-ct-name" className={field} value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-ct-title">{t('portal.crm.contact.title')}</label>
            <input id="crm-ct-title" className={field} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-ct-phone">{t('portal.crm.account.phone')}</label>
              <input id="crm-ct-phone" className={field} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="crm-ct-zalo">Zalo</label>
              <input id="crm-ct-zalo" className={field} value={zalo} onChange={e => setZalo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="crm-ct-email">Email</label>
            <input id="crm-ct-email" className={field} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <label className={check}>
            <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
            {t('portal.crm.contact.is_primary')}
          </label>
          <label className={check}>
            <input type="checkbox" checked={doNotCall} onChange={e => setDoNotCall(e.target.checked)} />
            {t('portal.crm.contact.do_not_call')}
          </label>
          <label className={check}>
            <input type="checkbox" checked={doNotEmail} onChange={e => setDoNotEmail(e.target.checked)} />
            {t('portal.crm.contact.do_not_email')}
          </label>
          <div>
            <label className={label} htmlFor="crm-ct-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-ct-notes" rows={2} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={() => void save()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#065f46] py-3 font-bold text-white disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
