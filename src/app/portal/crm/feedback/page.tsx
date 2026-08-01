'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { createCrmFeedback, crmFeedbackSignedUrl, getCrmFeedbacks, markCrmFeedbackRead } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import type { CrmFeedback } from '@/lib/portal-types';

const IMG_EXT = /\.(jpe?g|png|webp|gif|heic)$/i;

export default function CrmFeedbackPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [items, setItems] = useState<CrmFeedback[]>([]);
  const [busy, setBusy] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // Đổi số này để remount ô chọn tệp sau khi gửi — input file không đặt lại được bằng value.
  const [fileKey, setFileKey] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});

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
      const list = await getCrmFeedbacks();
      setItems(list);
      // Link ký tên sống 10 phút — trang mở ngắn nên không cần làm mới.
      const pairs = await Promise.all(list.filter(f => f.file_path).map(async f => {
        try { return [f.id, await crmFeedbackSignedUrl(f.file_path as string)] as const; }
        catch { return [f.id, ''] as const; }
      }));
      setUrls(Object.fromEntries(pairs));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (loading || !profile) return null;

  const isAdmin = profile.role === 'admin';
  const card = 'rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-5';
  const unreadCount = items.filter(f => !f.read_at).length;

  // Admin bấm vào thư là coi như đã đọc — đổi tại chỗ, không cần tải lại trang.
  const markRead = async (f: CrmFeedback) => {
    if (!isAdmin || f.read_at) return;
    try {
      await markCrmFeedbackRead(f.id);
      setItems(prev => prev.map(x => (x.id === f.id ? { ...x, read_at: new Date().toISOString() } : x)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const field = 'w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff5625]';

  const submit = async () => {
    if (!content.trim()) {
      toast.error(t('portal.crm.feedback.required'));
      return;
    }
    setSending(true);
    try {
      await createCrmFeedback(profile.id, content, file);
      toast.success(t('portal.crm.feedback.sent'));
      setContent('');
      setFile(null);
      setFileKey(k => k + 1);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.feedback.title')}</h1>
      </div>

      {!isAdmin && (
        <section className={`${card} mb-6`}>
          <p className="mb-3 text-sm text-[var(--crm-muted)]">{t('portal.crm.feedback.hint')}</p>
          <textarea
            rows={5}
            className={field}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={t('portal.crm.feedback.placeholder')}
            aria-label={t('portal.crm.feedback.title')}
          />
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs text-[var(--crm-muted)]" htmlFor="feedback-file">
                {t('portal.crm.feedback.file')}
              </label>
              <input
                id="feedback-file" type="file"
                key={fileKey}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className={`${field} file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--crm-s3)] file:px-2 file:py-1 file:text-[var(--crm-text)]`}
              />
            </div>
            <button
              onClick={() => void submit()}
              disabled={sending}
              className="flex items-center gap-2 rounded-xl bg-[#ff5625] px-5 py-2.5 font-bold text-white disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              {sending ? t('portal.crm.feedback.sending') : t('portal.crm.feedback.send')}
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold text-[var(--crm-text)]">
          {t(isAdmin ? 'portal.crm.feedback.inbox_title' : 'portal.crm.feedback.mine_title')}
          {isAdmin && unreadCount > 0 && (
            <span className="rounded-full bg-[#ff5625] px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount} {t('portal.crm.feedback.unread')}
            </span>
          )}
        </h2>
        {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}
        {!busy && items.length === 0 && (
          <p className="text-[var(--crm-muted)]">{t('portal.crm.feedback.empty')}</p>
        )}
        <div className="space-y-3">
          {items.map(f => (
            <article
              key={f.id}
              onClick={() => void markRead(f)}
              title={isAdmin && !f.read_at ? t('portal.crm.feedback.mark_read') : undefined}
              className={`rounded-2xl border bg-[var(--crm-s1)] p-5 ${
                !f.read_at && isAdmin
                  ? 'cursor-pointer border-[#ff5625]/60 hover:border-[#ff5625]'
                  : 'border-[var(--crm-line)]'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--crm-muted)]">
                <span className="flex items-center gap-2">
                  {isAdmin && (
                    <span className="rounded-full border border-[#00daf3]/40 px-2 py-0.5 text-[#00daf3]">
                      {f.staff?.full_name ?? '—'}
                    </span>
                  )}
                  {/* Badge đọc/chưa đọc: admin thấy thư mới, nhân viên biết thư mình đã được xem */}
                  {f.read_at ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#34d399]/40 px-2 py-0.5 text-[#34d399]">
                      <span className="material-symbols-outlined text-[13px]">done_all</span>
                      {t(isAdmin ? 'portal.crm.feedback.read' : 'portal.crm.feedback.seen_by_admin')}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                      isAdmin
                        ? 'bg-[#ff5625] font-bold text-white'
                        : 'border border-[var(--crm-line)] text-[var(--crm-muted)]'
                    }`}>
                      <span className="material-symbols-outlined text-[13px]">
                        {isAdmin ? 'mark_email_unread' : 'schedule'}
                      </span>
                      {t(isAdmin ? 'portal.crm.feedback.unread' : 'portal.crm.feedback.not_seen')}
                    </span>
                  )}
                </span>
                <span>{new Date(f.created_at).toLocaleString('vi-VN')}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[var(--crm-text)]">{f.content}</p>
              {f.file_path && urls[f.id] && (
                IMG_EXT.test(f.file_path) ? (
                  <a href={urls[f.id]} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- link ký tên sống 10 phút, không đi qua next/image được */}
                    <img src={urls[f.id]} alt={t('portal.crm.feedback.title')} className="mt-2 max-h-48 rounded-lg" />
                  </a>
                ) : (
                  <a href={urls[f.id]} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[#00daf3] underline">
                    {t('portal.crm.evidence.open_file')}
                  </a>
                )
              )}
            </article>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
