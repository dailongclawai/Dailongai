'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import {
  createCrmOpportunity, updateCrmOpportunity, getCrmAccounts, getActiveModels, getCrmLostReasons,
} from '@/lib/portal-queries';
import type {
  CrmAccount, CrmLostReason, CrmOpportunityBoardRow, CrmStage, ProductModel,
} from '@/lib/portal-types';

interface Props {
  open: boolean;
  stages: CrmStage[];
  row: CrmOpportunityBoardRow | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CrmOpportunityDrawer({ open, stages, row, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [accountId, setAccountId] = useState('');
  const [stageId, setStageId] = useState('');
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(0);
  const [closeDate, setCloseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [reasons, setReasons] = useState<CrmLostReason[]>([]);
  const [lostReasonId, setLostReasonId] = useState('');
  const [lostNotes, setLostNotes] = useState('');

  const pipelineStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const isLost = pipelineStages.find(s => s.id === stageId)?.forecast === 'lost';

  useEffect(() => {
    if (!open) return;
    void getCrmAccounts().then(setAccounts).catch(() => setAccounts([]));
    void getActiveModels().then(setModels).catch(() => setModels([]));
    void getCrmLostReasons().then(setReasons).catch(() => setReasons([]));
    setAccountId(row?.account_id ?? '');
    setStageId(row?.stage_id ?? pipelineStages[0]?.id ?? '');
    setName(row?.name ?? '');
    setModelId(row?.model_id ?? '');
    setQuantity(row?.quantity ?? 1);
    setAmount(row ? Number(row.amount) : 0);
    setCloseDate(row?.expected_close_date ?? '');
    setNotes('');
    setLostReasonId(row?.lost_reason_id ?? '');
    setLostNotes(row?.lost_notes ?? '');
  }, [open, row]);

  const save = async () => {
    if (!accountId) { toast.error(t('portal.crm.opp.account_required')); return; }
    if (!name.trim()) { toast.error(t('portal.crm.opp.name_required')); return; }
    if (isLost && !lostReasonId) { toast.error(t('portal.crm.lost.required')); return; }
    setSaving(true);
    try {
      const input = {
        accountId, stageId, name,
        modelId: modelId || null, quantity, amount,
        expectedCloseDate: closeDate || null, notes, ownerId,
        lostReasonId: isLost ? lostReasonId : null,
        lostNotes: isLost ? lostNotes : null,
      };
      if (row) await updateCrmOpportunity(row.id, input);
      else await createCrmOpportunity(input);
      toast.success(t('portal.crm.opp.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[#a0a0a8]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-[#1e2022] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#e2e2e5]">
            {row ? t('portal.crm.opp.edit') : t('portal.crm.opp.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[#a0a0a8]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-opp-account">{t('portal.crm.opp.account')}</label>
            <select id="crm-opp-account" className={field} value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="crm-opp-name">{t('portal.crm.opp.name')}</label>
            <input id="crm-opp-name" className={field} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-opp-stage">{t('portal.crm.opp.stage')}</label>
            <select id="crm-opp-stage" className={field} value={stageId} onChange={e => setStageId(e.target.value)}>
              {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name} · {s.probability}%</option>)}
            </select>
          </div>
          {isLost && (
            <>
              <div>
                <label className={label} htmlFor="crm-opp-lost-reason">{t('portal.crm.lost.reason')}</label>
                <select
                  id="crm-opp-lost-reason" className={field}
                  value={lostReasonId} onChange={e => setLostReasonId(e.target.value)}
                >
                  <option value="">—</option>
                  {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="crm-opp-lost-notes">{t('portal.crm.lost.notes')}</label>
                <input
                  id="crm-opp-lost-notes" className={field}
                  value={lostNotes} onChange={e => setLostNotes(e.target.value)}
                  placeholder={t('portal.crm.lost.notes_hint')}
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-opp-model">{t('portal.crm.opp.model')}</label>
              <select id="crm-opp-model" className={field} value={modelId} onChange={e => setModelId(e.target.value)}>
                <option value="">—</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="crm-opp-qty">{t('portal.crm.opp.quantity')}</label>
              <input
                id="crm-opp-qty" type="number" min={1} className={field}
                value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-opp-amount">{t('portal.crm.opp.amount')}</label>
              <input
                id="crm-opp-amount" type="number" min={0} step={100000} className={field}
                value={amount} onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className={label} htmlFor="crm-opp-close">{t('portal.crm.opp.close_date')}</label>
              <input id="crm-opp-close" type="date" className={field} value={closeDate} onChange={e => setCloseDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="crm-opp-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-opp-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50">
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
