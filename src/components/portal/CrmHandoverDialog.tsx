'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { getStaffPeers, handoverAccount, getCrmSettings } from '@/lib/portal-queries';
import type { StaffPeer, StaffSegment } from '@/lib/portal-types';

interface Props {
  open: boolean;
  accountId: string;
  mySegment: StaffSegment;
  onClose: () => void;
  onDone: () => void;
}

export function CrmHandoverDialog({ open, accountId, mySegment, onClose, onDone }: Props) {
  const { t } = useI18n();
  const target: StaffSegment = mySegment === 'b2c' ? 'b2b' : 'b2c';
  const [peers, setPeers] = useState<StaffPeer[]>([]);
  const [toStaff, setToStaff] = useState('');
  const [note, setNote] = useState('');
  const [bonus, setBonus] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToStaff('');
    setNote('');
    void getStaffPeers(target).then(setPeers).catch(() => setPeers([]));
    void getCrmSettings()
      .then(s => setBonus(s ? (Number(s.base_price) * Number(s.crossover_bonus_rate)) / 2 : null))
      .catch(() => setBonus(null));
  }, [open, target]);

  const submit = async () => {
    if (!toStaff) { toast.error(t('portal.crm.handover.pick_staff')); return; }
    setSaving(true);
    try {
      await handoverAccount(accountId, toStaff, note);
      toast.success(t('portal.crm.handover.done'));
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#1e2022] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-[#e2e2e5]">{t('portal.crm.handover.title')}</h3>
        <p className="mb-4 text-sm text-[#a0a0a8]">
          {t(target === 'b2b' ? 'portal.crm.handover.to_b2b' : 'portal.crm.handover.to_b2c')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[#a0a0a8]" htmlFor="handover-staff">
              {t('portal.crm.handover.staff')}
            </label>
            <select id="handover-staff" className={field} value={toStaff} onChange={e => setToStaff(e.target.value)}>
              <option value="">—</option>
              {peers.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#a0a0a8]" htmlFor="handover-note">
              {t('portal.crm.handover.note')}
            </label>
            <textarea id="handover-note" rows={2} className={field} value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {bonus !== null && (
            <p className="rounded-xl bg-[#282a2c] px-3 py-2 text-xs text-[#00daf3]">
              {t('portal.crm.handover.bonus_hint')}: {new Intl.NumberFormat('vi-VN').format(bonus)}đ
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-[#3d3f41] py-2.5 text-[#e2e2e5]">
              {t('portal.crm.handover.cancel')}
            </button>
            <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-[#ff5625] py-2.5 font-bold text-white disabled:opacity-50">
              {saving ? t('portal.crm.common.saving') : t('portal.crm.handover.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
