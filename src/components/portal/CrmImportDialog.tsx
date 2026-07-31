'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { createCrmAccountsBulk, lookupCrmPhones } from '@/lib/portal-queries';
import type { CrmAccountKind, CrmSource } from '@/lib/portal-types';

const SOURCES: CrmSource[] = ['website', 'zalo', 'facebook', 'google_ads', 'tiktok', 'referral', 'hotline', 'event', 'other'];

type FieldKey = 'name' | 'phone' | 'email' | 'zalo' | 'province' | 'address' | 'source' | 'notes';

const FIELDS: FieldKey[] = ['name', 'phone', 'email', 'zalo', 'province', 'address', 'source', 'notes'];

// Từ khoá đoán cột theo tiêu đề file. Đội sales xuất Excel bằng tiếng Việt là chính
// nên tiếng Việt đứng trước, tiếng Anh để dự phòng.
const GUESS: Record<FieldKey, string[]> = {
  name:     ['tên khách', 'ten khach', 'khách hàng', 'khach hang', 'họ tên', 'ho ten', 'tên', 'name', 'customer'],
  phone:    ['điện thoại', 'dien thoai', 'sđt', 'sdt', 'số đt', 'phone', 'mobile'],
  email:    ['email', 'thư điện tử'],
  zalo:     ['zalo'],
  province: ['tỉnh', 'tinh', 'thành phố', 'thanh pho', 'province', 'city'],
  address:  ['địa chỉ', 'dia chi', 'address'],
  source:   ['nguồn', 'nguon', 'source'],
  notes:    ['ghi chú', 'ghi chu', 'note', 'remark'],
};

/** Chuẩn hoá cùng quy tắc với crm_normalize_phone dưới DB để đếm trùng khớp nhau.
 *  Lệch quy tắc là bảng thống kê trùng nói sai — xem tests/unit/portal/crm-import.test.ts. */
export function normPhone(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.startsWith('840') && d.length === 12) return '0' + d.slice(3);
  if (d.startsWith('84') && d.length === 11) return '0' + d.slice(2);
  return d;
}

function guessColumn(headers: string[], key: FieldKey): number {
  const lower = headers.map(h => h.trim().toLowerCase());
  for (const needle of GUESS[key]) {
    const i = lower.findIndex(h => h.includes(needle));
    if (i >= 0) return i;
  }
  return -1;
}

interface Props {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onDone: () => void;
}

export function CrmImportDialog({ open, ownerId, onClose, onDone }: Props) {
  const { t } = useI18n();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<FieldKey, number>>({} as Record<FieldKey, number>);
  const [kind, setKind] = useState<CrmAccountKind>('customer');
  const [taken, setTaken] = useState<Map<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setHeaders([]); setRows([]); setTaken(null); };

  const pickFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false }) as unknown[][];
      if (grid.length < 2) { toast.error(t('portal.crm.import.empty_file')); return; }
      const head = (grid[0] ?? []).map(c => String(c ?? ''));
      const body = grid.slice(1).map(r => head.map((_, i) => String(r[i] ?? '').trim()));
      setHeaders(head);
      setRows(body);
      setTaken(null);
      setMap(Object.fromEntries(FIELDS.map(f => [f, guessColumn(head, f)])) as Record<FieldKey, number>);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const cell = (row: string[], key: FieldKey): string => {
    const i = map[key];
    return i >= 0 ? (row[i] ?? '') : '';
  };

  // Phân loại từng dòng. Trùng trong chính file cũng phải loại, nếu không lô insert
  // sẽ chết ở dòng thứ hai vì trigger dưới DB.
  const seen = new Set<string>();
  const classified = rows.map(row => {
    const name = cell(row, 'name').trim();
    const phone = normPhone(cell(row, 'phone'));
    if (!name) return { row, status: 'no_name' as const, phone };
    if (phone && taken?.has(phone)) return { row, status: 'taken' as const, phone };
    if (phone && seen.has(phone)) return { row, status: 'dup_in_file' as const, phone };
    if (phone) seen.add(phone);
    return { row, status: 'ok' as const, phone };
  });

  const count = (s: string) => classified.filter(c => c.status === s).length;
  const importable = classified.filter(c => c.status === 'ok');

  const check = async () => {
    setBusy(true);
    try {
      const phones = rows.map(r => cell(r, 'phone')).filter(Boolean);
      const hits = await lookupCrmPhones(phones);
      setTaken(new Map(hits.map(h => [h.phone_norm, h.owner_name || h.name])));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const payload = importable.map(({ row }) => {
        const raw = cell(row, 'source').trim().toLowerCase().replace(/\s+/g, '_');
        return {
          name: cell(row, 'name'),
          kind,
          phone: cell(row, 'phone') || null,
          email: cell(row, 'email') || null,
          zaloPhone: cell(row, 'zalo') || null,
          province: cell(row, 'province') || null,
          address: cell(row, 'address') || null,
          source: (SOURCES as string[]).includes(raw) ? (raw as CrmSource) : null,
          notes: cell(row, 'notes') || null,
          ownerId,
        };
      });
      for (let i = 0; i < payload.length; i += 100) {
        await createCrmAccountsBulk(payload.slice(i, i + 100));
      }
      toast.success(`${t('portal.crm.import.done')}: ${payload.length}`);
      reset();
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff5625]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--crm-s2)] p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-bold text-[var(--crm-text)]">{t('portal.crm.import.title')}</h3>
        <p className="mb-4 text-sm text-[var(--crm-muted)]">{t('portal.crm.import.hint')}</p>

        {rows.length === 0 ? (
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label={t('portal.crm.import.pick')}
            className={field}
            onChange={e => { const f = e.target.files?.[0]; if (f) void pickFile(f); }}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FIELDS.map(f => (
                <div key={f}>
                  <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor={`imp-${f}`}>
                    {t('portal.crm.import.field.' + f)}
                  </label>
                  <select
                    id={`imp-${f}`} className={field} value={map[f]}
                    onChange={e => { setMap({ ...map, [f]: Number(e.target.value) }); setTaken(null); }}
                  >
                    <option value={-1}>—</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="imp-kind">
                {t('portal.crm.account.kind')}
              </label>
              <select id="imp-kind" className={field} value={kind} onChange={e => setKind(e.target.value as CrmAccountKind)}>
                <option value="customer">{t('portal.crm.account.kind_customer')}</option>
                <option value="dealer_prospect">{t('portal.crm.account.kind_prospect')}</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-xl bg-[var(--crm-s3)] px-3 py-1.5 text-[var(--crm-muted)]">
                {t('portal.crm.import.total')}: <b className="text-[var(--crm-text)]">{rows.length}</b>
              </span>
              <span className="rounded-xl bg-[var(--crm-s3)] px-3 py-1.5 text-[var(--crm-muted)]">
                {t('portal.crm.import.ok')}: <b className="text-[#00daf3]">{importable.length}</b>
              </span>
              <span className="rounded-xl bg-[var(--crm-s3)] px-3 py-1.5 text-[var(--crm-muted)]">
                {t('portal.crm.import.no_name')}: <b className="text-[var(--crm-text)]">{count('no_name')}</b>
              </span>
              <span className="rounded-xl bg-[var(--crm-s3)] px-3 py-1.5 text-[var(--crm-muted)]">
                {t('portal.crm.import.dup_in_file')}: <b className="text-[var(--crm-text)]">{count('dup_in_file')}</b>
              </span>
              {taken && (
                <span className="rounded-xl bg-[var(--crm-s3)] px-3 py-1.5 text-[var(--crm-muted)]">
                  {t('portal.crm.import.taken')}: <b className="text-[#ff5625]">{count('taken')}</b>
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--crm-line)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
                  <tr>
                    <th className="px-3 py-2">{t('portal.crm.account.name')}</th>
                    <th className="px-3 py-2">{t('portal.crm.account.phone')}</th>
                    <th className="px-3 py-2">{t('portal.crm.account.province')}</th>
                    <th className="px-3 py-2">{t('portal.crm.import.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {classified.slice(0, 12).map((c, i) => (
                    <tr key={i} className="border-t border-[var(--crm-line)]">
                      <td className="px-3 py-2 text-[var(--crm-text)]">{cell(c.row, 'name') || '—'}</td>
                      <td className="px-3 py-2 text-[var(--crm-muted)]">{cell(c.row, 'phone') || '—'}</td>
                      <td className="px-3 py-2 text-[var(--crm-muted)]">{cell(c.row, 'province') || '—'}</td>
                      <td className={`px-3 py-2 ${c.status === 'ok' ? 'text-[#00daf3]' : 'text-[#ff5625]'}`}>
                        {t('portal.crm.import.status.' + c.status)}
                        {c.status === 'taken' && taken?.get(c.phone) ? ` · ${taken.get(c.phone)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {classified.length > 12 && (
                <p className="px-3 py-2 text-xs text-[var(--crm-muted)]">
                  {t('portal.crm.import.more')}: {classified.length - 12}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={reset} className="rounded-xl border border-[var(--crm-line)] px-4 py-2.5 text-[var(--crm-text)]">
                {t('portal.crm.import.other_file')}
              </button>
              <button
                onClick={check} disabled={busy}
                className="rounded-xl border border-[#00daf3] px-4 py-2.5 text-[#00daf3] disabled:opacity-50"
              >
                {t('portal.crm.import.check')}
              </button>
              <button
                onClick={run}
                disabled={busy || taken === null || importable.length === 0}
                className="ml-auto rounded-xl bg-[#ff5625] px-4 py-2.5 font-bold text-white disabled:opacity-50"
              >
                {busy ? t('portal.crm.common.saving') : `${t('portal.crm.import.run')} (${importable.length})`}
              </button>
            </div>
            {taken === null && (
              <p className="text-xs text-[var(--crm-muted)]">{t('portal.crm.import.check_first')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
