'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { getCrmLostReasons } from '@/lib/portal-queries';
import type { CrmLostReason } from '@/lib/portal-types';

interface Props {
  open: boolean;
  stageName: string;
  onClose: () => void;
  onConfirm: (lostReasonId: string, lostNotes: string) => void;
}

/** Hỏi lý do trước khi thả một cơ hội vào cột thua trên bảng kanban. Trigger dưới
 *  DB cũng chặn, nhưng chặn ở đó chỉ ném lỗi — người dùng cần chỗ để chọn. */
export function CrmLostReasonDialog({ open, stageName, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [reasons, setReasons] = useState<CrmLostReason[]>([]);
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');

  // Không reset state trong effect — trang kanban gắn `key` theo cơ hội đang thả nên
  // mỗi lần mở là một instance mới, ô chọn tự sạch.
  useEffect(() => {
    void getCrmLostReasons().then(setReasons).catch(() => setReasons([]));
  }, []);

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff8a50]';

  const submit = () => {
    if (!reasonId) { toast.error(t('portal.crm.lost.required')); return; }
    onConfirm(reasonId, notes);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--crm-s2)] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-[var(--crm-text)]">{t('portal.crm.lost.title')}</h3>
        <p className="mb-4 text-sm text-[var(--crm-muted)]">{stageName}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="lost-reason">
              {t('portal.crm.lost.reason')}
            </label>
            <select id="lost-reason" className={field} value={reasonId} onChange={e => setReasonId(e.target.value)}>
              <option value="">—</option>
              {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="lost-notes">
              {t('portal.crm.lost.notes')}
            </label>
            <textarea
              id="lost-notes" rows={2} className={field} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('portal.crm.lost.notes_hint')}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--crm-line)] py-2.5 text-[var(--crm-text)]">
              <span className="material-symbols-outlined text-[18px]">close</span>
              {t('portal.crm.lost.cancel')}
            </button>
            <button onClick={submit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e8692a] py-2.5 font-bold text-white">
              <span className="material-symbols-outlined text-[18px]">check</span>
              {t('portal.crm.lost.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
