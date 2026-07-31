'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { createCrmActivity, getCrmAccounts } from '@/lib/portal-queries';
import type { CrmAccount, CrmActivityKind } from '@/lib/portal-types';

interface Props {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

const KINDS: CrmActivityKind[] = ['task', 'call', 'meeting'];

export function CrmActivityDrawer({ open, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [kind, setKind] = useState<CrmActivityKind>('call');
  const [subject, setSubject] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void getCrmAccounts().then(setAccounts).catch(() => setAccounts([]));
    setKind('call');
    setSubject('');
    setAccountId('');
    setDueAt('');
    setNotes('');
  }, [open]);

  const save = async () => {
    if (!accountId) { toast.error(t('portal.crm.activity.account_required')); return; }
    if (!subject.trim()) { toast.error(t('portal.crm.activity.subject_required')); return; }
    setSaving(true);
    try {
      await createCrmActivity({
        kind, subject, notes,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        accountId, ownerId,
      });
      toast.success(t('portal.crm.activity.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[var(--crm-muted)]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-[var(--crm-s2)] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--crm-text)]">{t('portal.crm.activity.new')}</h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[var(--crm-muted)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-act-kind">{t('portal.crm.activity.kind')}</label>
            <select id="crm-act-kind" className={field} value={kind} onChange={e => setKind(e.target.value as CrmActivityKind)}>
              {KINDS.map(k => <option key={k} value={k}>{t('portal.crm.activity.kind_' + k)}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="crm-act-account">{t('portal.crm.opp.account')}</label>
            <select id="crm-act-account" className={field} value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="crm-act-subject">{t('portal.crm.activity.subject')}</label>
            <input id="crm-act-subject" className={field} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-act-due">{t('portal.crm.activity.due')}</label>
            <input id="crm-act-due" type="datetime-local" className={field} value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-act-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-act-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50">
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
