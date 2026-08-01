'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmBoard, getCrmStages, moveOpportunityStage, requestAccountCompletion } from '@/lib/portal-queries';
import { groupByStage, sumAmount, weightedForecast } from '@/lib/crm-board';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmOpportunityDrawer } from '@/components/portal/CrmOpportunityDrawer';
import { CrmLostReasonDialog } from '@/components/portal/CrmLostReasonDialog';
import type { CrmOpportunityBoardRow, CrmStage } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

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
  const [losing, setLosing] = useState<{ id: string; stage: CrmStage } | null>(null);

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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.pipeline.title')}</h1>
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="rounded-xl bg-[#ff5625] px-4 py-2 font-bold text-white"
        >
          {t('portal.crm.opp.new')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="rounded-xl bg-[var(--crm-s3)] px-4 py-2 text-[var(--crm-muted)]">
          {t('portal.crm.pipeline.open_count')}: <b className="text-[var(--crm-text)]">{openRows.length}</b>
        </span>
        <span className="rounded-xl bg-[var(--crm-s3)] px-4 py-2 text-[var(--crm-muted)]">
          {t('portal.crm.pipeline.open_value')}: <b className="text-[var(--crm-text)]">{fmtVnd(sumAmount(openRows))}đ</b>
        </span>
        <span className="rounded-xl bg-[var(--crm-s3)] px-4 py-2 text-[var(--crm-muted)]">
          {t('portal.crm.pipeline.forecast')}: <b className="text-[#00daf3]">{fmtVnd(weightedForecast(openRows))}đ</b>
        </span>
      </div>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}

      {/* items-start: không có nó thì flex kéo mọi cột cao bằng cột nhiều thẻ
          nhất, tạo ra những hộp rỗng dài thượt. Mỗi cột tự cuộn trong phần
          thẻ, tiêu đề và số đếm đứng yên nên không bị trôi mất khi cuộn. */}
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div
            key={col.stage.id}
            onDragOver={e => e.preventDefault()}
            onDrop={() => void drop(col.stage)}
            className="flex max-h-[calc(100vh-300px)] min-h-[200px] w-[280px] flex-shrink-0 flex-col rounded-2xl bg-[var(--crm-s1)] p-3"
          >
            <div className="mb-3 flex flex-shrink-0 items-center justify-between">
              <span className="text-sm font-bold text-[var(--crm-text)]">{col.stage.name}</span>
              <span className="rounded-full bg-[var(--crm-s3)] px-2 py-0.5 text-xs text-[var(--crm-muted)]">
                {col.rows.length} · {col.stage.probability}%
              </span>
            </div>
            <div className="portal-scroll flex-1 space-y-2 overflow-y-auto pr-1">
              {col.rows.map(r => (
                // Thẻ đã thắng/thua là sổ đã gấp: nhân viên không kéo lại được,
                // quản trị kéo được để sửa thao tác nhầm (DB cũng chặn tầng dưới).
                <article
                  key={r.id}
                  draggable={r.forecast === 'open' || isAdmin}
                  title={r.forecast !== 'open' && !isAdmin ? t('portal.crm.pipeline.closed_card') : undefined}
                  onDragStart={() => { if (r.forecast === 'open' || isAdmin) setDragId(r.id); }}
                  onClick={() => { setEditing(r); setDrawerOpen(true); }}
                  className={`rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s2)] p-3 hover:border-[#ff5625] ${r.forecast === 'open' || isAdmin ? 'cursor-grab' : 'cursor-pointer'}`}
                >
                  <p className="text-sm font-semibold text-[var(--crm-text)]">{r.name}</p>
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">{r.account_name}</p>
                  <p className="mt-2 text-sm font-bold text-[#ff5625]">
                    {fmtVnd(Number(r.amount))}đ
                    <span className="ml-1 text-xs font-normal text-[var(--crm-muted)]">
                      · {r.quantity} {t('portal.crm.opp.machines')}
                    </span>
                  </p>
                  {Number(r.expected_commission) > 0 && (
                    <p className="mt-1 text-xs text-[#00daf3]">
                      {t('portal.crm.opp.expected_commission')}: {fmtVnd(Number(r.expected_commission))}đ
                    </p>
                  )}
                  {r.trial_days && (
                    <p className="mt-1 inline-block rounded-full bg-[#ff5625]/15 px-2 py-0.5 text-xs text-[#ff5625]">
                      {t('portal.crm.opp.trial_badge')} {r.trial_days} {t('portal.crm.opp.days')}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">{r.expected_close_date}</p>
                  {r.lost_reason_name && (
                    <p className="mt-1 inline-block rounded-full bg-[var(--crm-s3)] px-2 py-0.5 text-xs text-[#ff5625]">
                      {r.lost_reason_name}
                    </p>
                  )}
                  {r.owner_name && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#00daf3]">
                      <span className="material-symbols-outlined text-[14px]">person</span>
                      {r.owner_name}
                    </p>
                  )}
                </article>
              ))}
              {col.rows.length === 0 && (
                <p className="py-6 text-center text-xs text-[var(--crm-muted)]">{t('portal.crm.pipeline.empty_stage')}</p>
              )}
            </div>
          </div>
        ))}
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
