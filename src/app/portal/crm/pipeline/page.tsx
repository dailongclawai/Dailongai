'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  getActiveModels, getCrmBoard, getCrmSettings, getCrmStages, moveOpportunityStage,
  requestAccountCompletion, suggestedUnitPrice,
} from '@/lib/portal-queries';
import { groupByStage, sumAmount, weightedForecast } from '@/lib/crm-board';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmOpportunityDrawer } from '@/components/portal/CrmOpportunityDrawer';
import { CrmLostReasonDialog } from '@/components/portal/CrmLostReasonDialog';
import type { CrmOpportunityBoardRow, CrmSettings, CrmStage, ProductModel } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

// Chấm màu đầu cột theo bảng Stitch: thắng = emerald, thua = đỏ mờ,
// các giai đoạn mở xoay vòng 4 màu để phân biệt nhanh bằng mắt.
const OPEN_DOTS = ['#e2e2e6', '#60a5fa', '#c084fc', '#ffb77d'];
const stageDotColor = (forecast: string, openIndex: number) =>
  forecast === 'won' ? '#8bd6b6' : forecast === 'lost' ? '#f87171' : OPEN_DOTS[openIndex % OPEN_DOTS.length];

// "Nguyễn Văn A" → "VA" — avatar chữ cái cho người phụ trách, không có ảnh thật.
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(-2).map(w => w[0]?.toUpperCase() ?? '').join('');

export default function CrmPipelinePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [rows, setRows] = useState<CrmOpportunityBoardRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CrmOpportunityBoardRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Chỉ phục vụ hiệu ứng kéo-thả (viền dashed cột đích), không dính logic dữ liệu.
  const [overStage, setOverStage] = useState<string | null>(null);
  const [losing, setLosing] = useState<{ id: string; stage: CrmStage } | null>(null);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  // Boss chốt 28/07/2026: CRM chỉ mở cho staff và admin
  useEffect(() => {
    if (!loading && profile && profile.role !== 'staff' && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [s, r] = await Promise.all([getCrmStages(), getCrmBoard()]);
      setStages(s);
      setRows(r);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  useEffect(() => {
    if (!session) return;
    void getActiveModels().then(setModels).catch(() => setModels([]));
    void getCrmSettings().then(setSettings).catch(() => setSettings(null));
  }, [session]);

  // Chip % giảm so với giá đề nghị (niêm yết / giá đại lý) — admin lướt bảng là
  // biết deal nào đang chiết khấu. Hoa hồng vẫn tính trên giá đơn sau giảm.
  const discountPct = (r: CrmOpportunityBoardRow): number | null => {
    if (!r.model_id || !r.account_kind || Number(r.amount) <= 0) return null;
    const model = models.find(m => m.id === r.model_id);
    if (!model) return null;
    const suggested = suggestedUnitPrice(model, r.account_kind, settings) * r.quantity;
    if (suggested <= 0 || Number(r.amount) >= suggested) return null;
    const pct = Math.round((1 - Number(r.amount) / suggested) * 100);
    return pct >= 1 ? pct : null;
  };

  const columns = useMemo(() => groupByStage(stages, rows), [stages, rows]);
  const openRows = rows.filter(r => r.forecast === 'open');
  const isAdmin = profile?.role === 'admin';

  const move = async (id: string, stageId: string, reasonId?: string, notes?: string) => {
    try {
      await moveOpportunityStage(id, stageId, reasonId, notes);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const drop = async (stage: CrmStage) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    // Boss chốt 02/08/2026: nhân viên thả vào cột thắng chỉ gửi yêu cầu xác nhận
    // — quản trị duyệt mới vào bước thắng, DB cũng chặn nếu lách qua đây.
    if (stage.forecast === 'won' && profile && profile.role !== 'admin') {
      const row = rows.find(r => r.id === id);
      if (!row) return;
      if (!window.confirm(t('portal.crm.accounts.request_confirm'))) return;
      try {
        await requestAccountCompletion(row.account_id, profile.id);
        toast.success(t('portal.crm.accounts.request_sent'));
        await load();
      } catch (e) {
        toast.error((e as Error).message);
      }
      return;
    }
    // Thả vào cột thua thì phải hỏi lý do trước, nếu không DB sẽ từ chối.
    if (stage.forecast === 'lost') {
      setLosing({ id, stage });
      return;
    }
    await move(id, stage.id);
  };

  if (loading || !profile) return null;

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--crm-text)]">{t('portal.crm.pipeline.title')}</h1>
          <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex w-fit items-center gap-2 rounded-xl bg-[#065f46] px-4 py-2 font-bold text-white"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            {t('portal.crm.opp.new')}
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--crm-muted)]">
            {t('portal.crm.pipeline.total_value')}
          </p>
          <p className="crm-display mt-1 text-4xl font-bold tracking-tight text-[#8bd6b6] tabular-nums">
            {fmtVnd(sumAmount(openRows))}₫
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="rounded-xl bg-[var(--crm-s3)] px-4 py-2 text-[var(--crm-muted)]">
          {t('portal.crm.pipeline.open_count')}: <b className="text-[var(--crm-text)]">{openRows.length}</b>
        </span>
        <span className="rounded-xl bg-[var(--crm-s3)] px-4 py-2 text-[var(--crm-muted)]">
          {t('portal.crm.pipeline.open_value')}: <b className="text-[var(--crm-text)]">{fmtVnd(sumAmount(openRows))}đ</b>
        </span>
        <span className="rounded-xl bg-[var(--crm-s3)] px-4 py-2 text-[var(--crm-muted)]">
          {t('portal.crm.pipeline.forecast')}: <b className="text-[#ffb77d]">{fmtVnd(weightedForecast(openRows))}đ</b>
        </span>
      </div>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}

      {/* items-start: không có nó thì flex kéo mọi cột cao bằng cột nhiều thẻ
          nhất, tạo ra những hộp rỗng dài thượt. Mỗi cột tự cuộn trong phần
          thẻ, tiêu đề và số đếm đứng yên nên không bị trôi mất khi cuộn. */}
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {columns.map((col, colIdx) => {
          const dot = stageDotColor(col.stage.forecast, colIdx);
          const isDropTarget = dragId !== null && overStage === col.stage.id;
          return (
            <div
              key={col.stage.id}
              onDragOver={e => { e.preventDefault(); setOverStage(col.stage.id); }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
              }}
              onDrop={() => { setOverStage(null); void drop(col.stage); }}
              className="flex max-h-[calc(100vh-300px)] min-h-[200px] w-[280px] flex-shrink-0 flex-col"
            >
              <div className="mb-3 flex flex-shrink-0 items-center gap-2 px-1">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: dot, boxShadow: `0 0 8px ${dot}99` }}
                />
                <span className="crm-display text-sm font-bold text-[var(--crm-text)]">
                  {col.stage.name} <span className="font-normal text-[var(--crm-muted)]">({col.rows.length})</span>
                </span>
              </div>
              {/* Nền cột trong hơn thẻ; kéo tới đâu viền dashed emerald sáng tới đó. */}
              <div
                className={`portal-scroll flex-1 space-y-2 overflow-y-auto rounded-xl border p-2 transition-colors ${
                  isDropTarget
                    ? 'border-dashed border-[#8bd6b6]/70 bg-[#8bd6b6]/10'
                    : 'border-white/10 bg-[rgba(30,32,35,0.5)]'
                }`}
              >
                {col.rows.map(r => (
                  // Thẻ đã thắng/thua là sổ đã gấp: nhân viên không kéo lại được,
                  // quản trị kéo được để sửa thao tác nhầm (DB cũng chặn tầng dưới).
                  <article
                    key={r.id}
                    draggable={r.forecast === 'open' || isAdmin}
                    title={r.forecast !== 'open' && !isAdmin ? t('portal.crm.pipeline.closed_card') : undefined}
                    onDragStart={() => { if (r.forecast === 'open' || isAdmin) setDragId(r.id); }}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    onClick={() => { setEditing(r); setDrawerOpen(true); }}
                    className={`rounded-lg border bg-[var(--crm-s2)] p-3 transition-colors hover:bg-[var(--crm-s3)] ${
                      dragId === r.id
                        ? 'border-transparent ring-2 ring-[#8bd6b6] shadow-[0_0_16px_rgba(139,214,182,0.35)]'
                        : 'border-white/5 hover:border-[#8bd6b6]/60'
                    } ${r.forecast === 'won' ? 'border-l-[3px] border-l-[#8bd6b6]' : ''} ${
                      r.forecast === 'lost' ? 'opacity-55' : ''
                    } ${r.forecast === 'open' || isAdmin ? 'cursor-grab' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--crm-text)]">{r.account_name ?? r.name}</p>
                      {r.forecast === 'won' && (
                        <span className="material-symbols-outlined flex-shrink-0 text-[16px] text-[#8bd6b6]">check_circle</span>
                      )}
                    </div>
                    {r.account_name && <p className="mt-0.5 text-xs text-[var(--crm-muted)]">{r.name}</p>}
                    {r.account_phone && (
                      <a
                        href={`tel:${r.account_phone}`}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--crm-muted)] tabular-nums hover:text-[#ffb77d]"
                      >
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        {r.account_phone}
                      </a>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className={`text-sm font-bold tabular-nums ${
                        r.forecast === 'lost' ? 'text-[var(--crm-muted)] line-through' : 'text-[#8bd6b6]'
                      }`}>
                        {fmtVnd(Number(r.amount))}đ
                        <span className="ml-1 text-xs font-normal text-[var(--crm-muted)] no-underline">
                          · {r.quantity} {t('portal.crm.opp.machines')}
                        </span>
                        {(() => {
                          const pct = discountPct(r);
                          return pct !== null ? (
                            <span
                              className="ml-1.5 rounded-full border border-[#fbbf24]/40 px-1.5 py-0.5 text-[10px] font-normal text-[#fbbf24]"
                              title={t('portal.crm.opp.discount_hint')}
                            >
                              -{pct}%
                            </span>
                          ) : null;
                        })()}
                      </p>
                      {r.owner_name && (
                        <span
                          title={r.owner_name}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#065f46] text-[10px] font-bold text-white"
                        >
                          {initials(r.owner_name)}
                        </span>
                      )}
                    </div>
                    {Number(r.expected_commission) > 0 && (
                      <p className="mt-1 text-xs text-[#ffb77d] tabular-nums">
                        {t('portal.crm.opp.expected_commission')}: {fmtVnd(Number(r.expected_commission))}đ
                      </p>
                    )}
                    {r.trial_days && (
                      <p className="mt-1 inline-block rounded-full bg-[#8bd6b6]/15 px-2 py-0.5 text-xs text-[#8bd6b6]">
                        {t('portal.crm.opp.trial_badge')} {r.trial_days} {t('portal.crm.opp.days')}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--crm-muted)] tabular-nums">{r.expected_close_date}</p>
                    {r.lost_reason_name && (
                      <p className="mt-1 inline-block rounded-full bg-[var(--crm-s3)] px-2 py-0.5 text-xs text-[#8bd6b6]">
                        {r.lost_reason_name}
                      </p>
                    )}
                  </article>
                ))}
                {col.rows.length === 0 && (
                  <p className="py-6 text-center text-xs text-[var(--crm-muted)]">{t('portal.crm.pipeline.empty_stage')}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CrmOpportunityDrawer
        open={drawerOpen}
        stages={stages}
        row={editing}
        ownerId={profile.id}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void load()}
      />

      <CrmLostReasonDialog
        key={losing?.id ?? 'none'}
        open={losing !== null}
        stageName={losing?.stage.name ?? ''}
        onClose={() => setLosing(null)}
        onConfirm={(reasonId, notes) => {
          const target = losing;
          setLosing(null);
          if (target) void move(target.id, target.stage.id, reasonId, notes);
        }}
      />
    </PortalShell>
  );
}
