'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { getCrmLostReasons } from '@/lib/portal-queries';
import type { CrmLostReason, CrmPipeline } from '@/lib/portal-types';

interface Props {
  open: boolean;
  pipeline: CrmPipeline;
  stageName: string;
  onClose: () => void;
  onConfirm: (lostReasonId: string, lostNotes: string) => void;
}

/** Hỏi lý do trước khi thả một cơ hội vào cột thua trên bảng kanban. Trigger dưới
 *  DB cũng chặn, nhưng chặn ở đó chỉ ném lỗi — người dùng cần chỗ để chọn. */
export function CrmLostReasonDialog({ open, pipeline, stageName, onClose, onConfirm }: Props) {
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

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';
  const pipelineReasons = reasons.filter(r => !r.pipeline || r.pipeline === pipeline);

  const submit = () => {
    if (!reasonId) { toast.error(t('portal.crm.lost.required')); return; }
    onConfirm(reasonId, notes);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#1e2022] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-[#e2e2e5]">{t('portal.crm.lost.title')}</h3>
        <p className="mb-4 text-sm text-[#a0a0a8]">{stageName}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[#a0a0a8]" htmlFor="lost-reason">
              {t('portal.crm.lost.reason')}
            </label>
            <select id="lost-reason" className={field} value={reasonId} onChange={e => setReasonId(e.target.value)}>
              <option value="">—</option>
              {pipelineReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#a0a0a8]" htmlFor="lost-notes">
              {t('portal.crm.lost.notes')}
            </label>
            <textarea
              id="lost-notes" rows={2} className={field} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('portal.crm.lost.notes_hint')}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-[#3d3f41] py-2.5 text-[#e2e2e5]">
              {t('portal.crm.handover.cancel')}
            </button>
            <button onClick={submit} className="flex-1 rounded-xl bg-[#ff5625] py-2.5 font-bold text-white">
              {t('portal.crm.lost.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
