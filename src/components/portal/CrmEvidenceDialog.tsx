'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { crmEvidenceSignedUrl, getCrmEvidences, uploadCrmEvidence } from '@/lib/portal-queries';
import type { CrmEvidence, CrmEvidenceKind } from '@/lib/portal-types';

interface Props {
  open: boolean;
  accountId: string | null;
  accountName: string;
  uploaderId: string;
  onClose: () => void;
  /** Gọi sau mỗi lần lưu thành công — trang khách hàng cập nhật huy hiệu đếm. */
  onSaved?: () => void;
}

const KINDS: CrmEvidenceKind[] = ['giao_dich', 'co_so', 'khac'];
const IMG_EXT = /\.(jpe?g|png|webp|gif|heic)$/i;

/** Chứng cứ khách hàng thật: màn hình giao dịch với khách, ảnh chụp tại cơ sở
 *  khách tổ chức. Trang khách hàng gắn `key` theo khách đang mở nên mỗi lần mở
 *  là một instance mới, form tự sạch. */
export function CrmEvidenceDialog({ open, accountId, accountName, uploaderId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<CrmEvidence[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<CrmEvidenceKind>('giao_dich');
  const [note, setNote] = useState('');
  // Đổi số này để remount ô chọn tệp sau khi lưu — input file không đặt lại được bằng value.
  const [fileKey, setFileKey] = useState(0);

  const load = useCallback(async () => {
    if (!accountId) return;
    const list = await getCrmEvidences(accountId);
    setItems(list);
    // Link ký tên hết hạn sau 10 phút — hộp thoại mở ngắn nên không cần làm mới.
    const pairs = await Promise.all(list.map(async e => {
      try { return [e.id, await crmEvidenceSignedUrl(e.file_path)] as const; }
      catch { return [e.id, ''] as const; }
    }));
    setUrls(Object.fromEntries(pairs));
  }, [accountId]);

  useEffect(() => {
    void load().catch(() => setItems([]));
  }, [load]);

  if (!open || !accountId) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff5625]';

  const submit = async () => {
    if (!file) { toast.error(t('portal.crm.evidence.file_required')); return; }
    setBusy(true);
    try {
      await uploadCrmEvidence(uploaderId, accountId, file, kind, note);
      toast.success(t('portal.crm.evidence.saved'));
      setFile(null);
      setNote('');
      setFileKey(k => k + 1);
      await load();
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--crm-s2)] p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-bold text-[var(--crm-text)]">{t('portal.crm.evidence.title')}</h3>
        <p className="mb-4 text-sm text-[var(--crm-muted)]">{accountName} — {t('portal.crm.evidence.hint')}</p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="evidence-kind">
                {t('portal.crm.evidence.kind')}
              </label>
              <select
                id="evidence-kind" className={field} value={kind}
                onChange={e => setKind(e.target.value as CrmEvidenceKind)}
              >
                {KINDS.map(k => <option key={k} value={k}>{t('portal.crm.evidence.kind_' + k)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="evidence-file">
                {t('portal.crm.evidence.file')}
              </label>
              <input
                id="evidence-file" type="file" accept="image/*,.pdf"
                key={fileKey}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className={`${field} file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--crm-s3)] file:px-2 file:py-1 file:text-[var(--crm-text)]`}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="evidence-note">
              {t('portal.crm.evidence.note')}
            </label>
            <input
              id="evidence-note" className={field} value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--crm-line)] py-2.5 text-[var(--crm-text)]">
              {t('portal.crm.common.close')}
            </button>
            <button
              onClick={() => void submit()} disabled={busy}
              className="flex-1 rounded-xl bg-[#ff5625] py-2.5 font-bold text-white disabled:opacity-50"
            >
              {busy ? t('portal.crm.evidence.uploading') : t('portal.crm.evidence.upload')}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-[var(--crm-line)] pt-4">
          {items.length === 0 && (
            <p className="text-sm text-[var(--crm-muted)]">{t('portal.crm.evidence.empty')}</p>
          )}
          {items.map(e => (
            <div key={e.id} className="rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--crm-muted)]">
                <span className="rounded-full border border-[#00daf3]/40 px-2 py-0.5 text-[#00daf3]">
                  {t('portal.crm.evidence.kind_' + e.kind)}
                </span>
                <span>{new Date(e.created_at).toLocaleString('vi-VN')}</span>
              </div>
              {urls[e.id] && IMG_EXT.test(e.file_path) ? (
                <a href={urls[e.id]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- link ký tên sống 10 phút, không đi qua next/image được */}
                  <img src={urls[e.id]} alt={e.note ?? t('portal.crm.evidence.title')} className="max-h-48 rounded-lg" />
                </a>
              ) : urls[e.id] ? (
                <a href={urls[e.id]} target="_blank" rel="noreferrer" className="text-sm text-[#00daf3] underline">
                  {t('portal.crm.evidence.open_file')}
                </a>
              ) : null}
              {e.note && <p className="mt-2 text-sm text-[var(--crm-text)]">{e.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
