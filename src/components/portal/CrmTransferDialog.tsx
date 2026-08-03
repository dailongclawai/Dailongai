'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { getStaffPeers, transferCrmAccount } from '@/lib/portal-queries';
import type { StaffPeer } from '@/lib/portal-types';

interface Props {
  open: boolean;
  accountId: string;
  accountName: string;
  /** Người đang phụ trách — loại khỏi danh sách nhận vì DB cũng từ chối. */
  currentOwnerId: string;
  onClose: () => void;
  onDone: () => void;
}

/** Bàn giao khách cho nhân viên khác: khách, liên hệ, cơ hội đang mở và việc
 *  chưa xong đi theo người nhận; hồ sơ đã đóng giữ chủ cũ. RPC dưới DB là chốt
 *  chặn quyền thật (người phụ trách hoặc quản trị). */
export function CrmTransferDialog({ open, accountId, accountName, currentOwnerId, onClose, onDone }: Props) {
  const { t } = useI18n();
  const [peers, setPeers] = useState<StaffPeer[]>([]);
  const [toStaff, setToStaff] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToStaff('');
    setNote('');
    void getStaffPeers().then(setPeers).catch(() => setPeers([]));
  }, [open]);

  if (!open) return null;

  // Ẩn hẳn tài khoản quản trị: RPC vốn từ chối nhận admin, để trong danh sách
  // chỉ tổ dẫn người dùng vào lỗi.
  const candidates = peers.filter(p => p.role === 'staff' && p.id !== currentOwnerId);
  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff8a50]';

  const submit = async () => {
    if (!toStaff) { toast.error(t('portal.crm.transfer.to_required')); return; }
    setSaving(true);
    try {
      await transferCrmAccount(accountId, toStaff, note);
      toast.success(t('portal.crm.transfer.done'));
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--crm-s2)] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-[var(--crm-text)]">{t('portal.crm.transfer.title')}</h3>
        <p className="mb-4 text-sm text-[var(--crm-muted)]">{accountName}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="transfer-to">
              {t('portal.crm.transfer.to')}
            </label>
            <select id="transfer-to" className={field} value={toStaff} onChange={e => setToStaff(e.target.value)}>
              <option value="">—</option>
              {candidates.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}{p.staff_segment ? ` · ${t('portal.crm.segment.' + p.staff_segment)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="transfer-note">
              {t('portal.crm.account.notes')}
            </label>
            <textarea
              id="transfer-note" rows={2} className={field} value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <p className="text-xs text-[var(--crm-muted)]">{t('portal.crm.transfer.hint')}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--crm-line)] py-2.5 text-[var(--crm-text)]">
              <span className="material-symbols-outlined text-[18px]">close</span>
              {t('portal.crm.lost.cancel')}
            </button>
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e8692a] py-2.5 font-bold text-white disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              {saving ? t('portal.crm.common.saving') : t('portal.crm.transfer.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
