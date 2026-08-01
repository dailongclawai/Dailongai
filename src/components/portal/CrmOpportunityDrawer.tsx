'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import {
  createCrmOpportunity, updateCrmOpportunity, getCrmAccounts, getActiveModels, getCrmLostReasons,
  getCrmSettings, getOrdersForAccount, linkOrderToOpportunity, suggestedUnitPrice,
} from '@/lib/portal-queries';
import type {
  CrmAccount, CrmLinkableOrder, CrmLostReason, CrmOpportunityBoardRow, CrmSettings, CrmStage,
  ProductModel,
} from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

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
  const [orders, setOrders] = useState<CrmLinkableOrder[]>([]);
  const [orderId, setOrderId] = useState('');
  const [trialDays, setTrialDays] = useState('');
  const [settings, setSettings] = useState<CrmSettings | null>(null);

  const pipelineStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const isLost = pipelineStages.find(s => s.id === stageId)?.forecast === 'lost';

  // Đại lý và bán lẻ chỉ khác giá: đại lý được gợi ý mức chiết khấu tối thiểu,
  // còn dư địa thương lượng xuống tới sàn dealer_price.
  const account = accounts.find(a => a.id === accountId);
  const model = models.find(m => m.id === modelId);
  const unitPrice = model && account ? suggestedUnitPrice(model, account.kind, settings) : 0;
  const suggested = unitPrice * quantity;
  const belowSuggested = suggested > 0 && amount > 0 && amount < suggested;
  // Hoa hồng dự kiến hiện ngay từ lúc bắt đầu theo khách, không đợi chốt deal.
  const expectedCommission = row ? Number(row.expected_commission) : 0;

  useEffect(() => {
    if (!open) return;
    void getCrmAccounts().then(setAccounts).catch(() => setAccounts([]));
    void getActiveModels().then(setModels).catch(() => setModels([]));
    void getCrmLostReasons().then(setReasons).catch(() => setReasons([]));
    void getCrmSettings().then(setSettings).catch(() => setSettings(null));
    setAccountId(row?.account_id ?? '');
    setStageId(row?.stage_id ?? pipelineStages[0]?.id ?? '');
    setName(row?.name ?? '');
    setModelId(row?.model_id ?? '');
    setQuantity(row?.quantity ?? 1);
    setAmount(row ? Number(row.amount) : 0);
    setCloseDate(row?.expected_close_date ?? '');
    setNotes(row?.notes ?? '');
    setLostReasonId(row?.lost_reason_id ?? '');
    setLostNotes(row?.lost_notes ?? '');
    setOrderId(row?.order_id ?? '');
    setTrialDays(row?.trial_days ? String(row.trial_days) : '');
  }, [open, row]);

  // Danh sách đơn phụ thuộc khách đang chọn, nạp lại mỗi khi đổi khách.
  useEffect(() => {
    if (!open || !accountId) { setOrders([]); return; }
    let cancelled = false;
    void getOrdersForAccount(accountId)
      .then(o => { if (!cancelled) setOrders(o); })
      .catch(() => { if (!cancelled) setOrders([]); });
    return () => { cancelled = true; };
  }, [open, accountId]);

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
        trialDays: trialDays ? Number(trialDays) : null,
      };
      if (row) {
        await updateCrmOpportunity(row.id, input);
        if ((row.order_id ?? '') !== orderId) {
          await linkOrderToOpportunity(row.id, orderId || null);
        }
      } else {
        await createCrmOpportunity(input);
      }
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

  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[var(--crm-muted)]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-[var(--crm-s2)] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--crm-text)]">
            {row ? t('portal.crm.opp.edit') : t('portal.crm.opp.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[var(--crm-muted)]">
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

          {suggested > 0 && (
            <p className="text-xs text-[var(--crm-muted)]">
              {account?.kind === 'dealer_prospect' && model?.dealer_price
                ? t('portal.crm.opp.price_dealer')
                : t('portal.crm.opp.price_list')}
              : <b className="text-[var(--crm-text)]">{fmtVnd(suggested)}đ</b>
              {amount !== suggested && (
                <button
                  type="button"
                  onClick={() => setAmount(suggested)}
                  className="ml-2 text-[#00daf3] underline"
                >
                  {t('portal.crm.opp.price_apply')}
                </button>
              )}
              {belowSuggested && (
                <span className="ml-2 text-[#ff5625]">
                  {t('portal.crm.opp.price_below')} {(100 - (amount / suggested) * 100).toFixed(1)}%
                </span>
              )}
            </p>
          )}

          <div>
            <label className={label} htmlFor="crm-opp-trial">{t('portal.crm.opp.trial_days')}</label>
            {/* Không phải dùng thử: khách mua đứt, đây là chương trình cam kết hoàn
                tiền theo phiếu CS-HT30 — chỉ có hai mốc 30 ngày và gia hạn 60 ngày. */}
            <select
              id="crm-opp-trial" className={field}
              value={trialDays} onChange={e => setTrialDays(e.target.value)}
            >
              <option value="">{t('portal.crm.opp.companion_none')}</option>
              <option value="30">{t('portal.crm.opp.companion_30')}</option>
              <option value="60">{t('portal.crm.opp.companion_60')}</option>
              {trialDays !== '' && trialDays !== '30' && trialDays !== '60' && (
                <option value={trialDays}>{trialDays} {t('portal.crm.opp.days')}</option>
              )}
            </select>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">{t('portal.crm.opp.trial_hint')}</p>
          </div>

          {row && expectedCommission > 0 && (
            <p className="rounded-xl bg-[var(--crm-s3)] px-3 py-2 text-sm text-[var(--crm-muted)]">
              {t('portal.crm.opp.expected_commission')}:{' '}
              <b className="text-[#00daf3]">{fmtVnd(expectedCommission)}đ</b>
              {row.trial_days && (
                <span className="ml-2 text-xs text-[#ff5625]">
                  {t('portal.crm.opp.trial_hold')} {row.trial_days} {t('portal.crm.opp.days')}
                </span>
              )}
            </p>
          )}

          {row && (
            <div>
              <label className={label} htmlFor="crm-opp-order">{t('portal.crm.opp.order')}</label>
              <select id="crm-opp-order" className={field} value={orderId} onChange={e => setOrderId(e.target.value)}>
                <option value="">{t('portal.crm.opp.order_none')}</option>
                {row.order_id && !orders.some(o => o.order_id === row.order_id) && (
                  <option value={row.order_id}>{t('portal.crm.opp.order_current')}</option>
                )}
                {orders.map(o => (
                  <option key={o.order_id} value={o.order_id}>
                    {o.phone_matches ? '★ ' : ''}{o.serial_number} · {o.customer_name} · {fmtVnd(Number(o.sale_price))}đ
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--crm-muted)]">{t('portal.crm.opp.order_hint')}</p>
            </div>
          )}
          <div>
            <label className={label} htmlFor="crm-opp-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-opp-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
