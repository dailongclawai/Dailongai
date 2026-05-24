'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import {
  getInboxMessages,
  markMessageRead,
  markAllMessagesRead,
} from '@/lib/portal-queries';
import type { PortalMessage, NotificationCategory, NotificationSeverity } from '@/lib/portal-types';

function makeTimeAgo(t: (k: string) => string) {
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('portal.inbox.time.just_now');
    if (m < 60) return `${m} ${t('portal.inbox.time.minutes_ago')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t('portal.inbox.time.hours_ago')}`;
    const d = Math.floor(h / 24);
    if (d === 1) return t('portal.inbox.time.yesterday');
    if (d < 7) return `${d} ${t('portal.inbox.time.days_ago')}`;
    return new Date(iso).toLocaleDateString('vi-VN');
  };
}

type Filter = 'all' | 'unread' | NotificationCategory;

const CATEGORY_ICON: Record<NotificationCategory, string> = {
  order:      'shopping_bag',
  commission: 'payments',
  payout:     'account_balance_wallet',
  legal:      'gavel',
  policy:     'policy',
  system:     'dns',
  general:    'campaign',
};

const CATEGORY_LABEL_KEY: Record<NotificationCategory, string> = {
  order:      'portal.inbox.category.order',
  commission: 'portal.inbox.category.commission',
  payout:     'portal.inbox.category.payout',
  legal:      'portal.inbox.category.legal',
  policy:     'portal.inbox.category.policy',
  system:     'portal.inbox.category.system',
  general:    'portal.inbox.category.general',
};

const SEVERITY_META: Record<NotificationSeverity, { stripe: string; icon: string; iconBg: string; iconBorder: string }> = {
  info:     { stripe: '#01daf3', icon: 'info',         iconBg: 'bg-[#01daf3]/10',  iconBorder: 'border-[#01daf3]/30' },
  success:  { stripe: '#22c55e', icon: 'check_circle', iconBg: 'bg-emerald-500/10', iconBorder: 'border-emerald-500/30' },
  warning:  { stripe: '#ff5625', icon: 'warning',      iconBg: 'bg-[#ff5625]/10',  iconBorder: 'border-[#ff5625]/30' },
  critical: { stripe: '#ffb4ab', icon: 'error',        iconBg: 'bg-[#f87171]/10',  iconBorder: 'border-[#f87171]/30' },
};

export default function InboxPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const { t } = useI18n();
  const timeAgo = useMemo(() => makeTimeAgo(t), [t]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    getInboxMessages().then(setMessages);
  }, [loading, session, router]);

  const myMessages = useMemo(
    () => messages.filter((m) => m.recipient_id === session?.user.id),
    [messages, session?.user.id],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: myMessages.length,
      unread: myMessages.filter((m) => !m.is_read).length,
      order: 0, commission: 0, payout: 0, legal: 0, policy: 0, system: 0, general: 0,
    };
    for (const m of myMessages) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [myMessages]);

  const filtered = useMemo(() => {
    if (filter === 'all') return myMessages;
    if (filter === 'unread') return myMessages.filter((m) => !m.is_read);
    return myMessages.filter((m) => m.category === filter);
  }, [myMessages, filter]);

  if (loading || !session || !profile) return null;

  const markRead = async (id: string) => {
    await markMessageRead(id);
    setMessages((ms) => ms.map((x) => x.id === id ? { ...x, is_read: true } : x));
  };

  const onCardClick = async (m: PortalMessage) => {
    if (!m.is_read) await markRead(m.id);
    if (m.action_url) router.push(m.action_url);
  };

  const onMarkAllRead = async () => {
    setBusy(true);
    try {
      const n = await markAllMessagesRead();
      if (n > 0) {
        toast.success(`${t('portal.inbox.toast.marked_prefix')} ${n} ${t('portal.inbox.toast.marked_suffix')}`);
        setMessages(await getInboxMessages());
      } else {
        toast.info(t('portal.inbox.toast.no_unread'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.inbox.toast.error'));
    } finally { setBusy(false); }
  };

  const filterButtons: { key: Filter; label: string; icon: string }[] = [
    { key: 'all',        label: t('portal.inbox.filter.all'),                icon: 'inbox' },
    { key: 'unread',     label: t('portal.inbox.filter.unread'),             icon: 'pending_actions' },
    { key: 'order',      label: t(CATEGORY_LABEL_KEY.order),      icon: CATEGORY_ICON.order },
    { key: 'commission', label: t(CATEGORY_LABEL_KEY.commission), icon: CATEGORY_ICON.commission },
    { key: 'payout',     label: t(CATEGORY_LABEL_KEY.payout),     icon: CATEGORY_ICON.payout },
  ];

  return (
    <PortalShell variant={profile.role === 'admin' ? 'admin' : profile.role === 'supervisor' ? 'supervisor' : 'dealer'}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#9ca3af]">{t('portal.inbox.eyebrow')}</p>
          <h1 className="mt-2 font-headline text-3xl">{t('portal.inbox.title')}</h1>
        </div>
        <button
          onClick={onMarkAllRead}
          disabled={busy || counts.unread === 0}
          className="flex items-center gap-2 rounded-lg border border-[#1f2937]/40 bg-[#11151a] px-5 py-2.5 text-sm font-medium text-[#9ca3af] transition-colors hover:bg-[#1a1f26] hover:text-[#e7eaf0] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          {t('portal.inbox.btn.mark_all_read')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className="lg:sticky lg:top-24 overflow-hidden rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e]">
            <div className="border-b border-[#1f2937]/20 bg-[#1a1f26]/50 px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ff5625]">{t('portal.inbox.filter.header')}</span>
            </div>
            <div className="space-y-1 p-2">
              {filterButtons.map((b) => {
                const active = filter === b.key;
                const n = counts[b.key];
                return (
                  <button
                    key={b.key}
                    onClick={() => setFilter(b.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'border-l-2 border-[#ff5625] bg-[#ff5625]/10 text-[#ff5625]'
                        : 'text-[#9ca3af] hover:bg-[#1a1f26] hover:text-[#e7eaf0]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">{b.icon}</span>
                      <span>{b.label}</span>
                    </div>
                    {n > 0 && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-[#ff5625]/20 text-[#ff5625]' : 'bg-[#3d3f41]/40 text-[#9ca3af]'
                      }`}>
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-3 lg:col-span-9">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-[#1f2937]/30 bg-[#1a1c1e] py-16 text-center opacity-60">
              <span className="material-symbols-outlined text-[48px] text-[#9ca3af]">inbox</span>
              <p className="mt-3 text-sm text-[#9ca3af]">{t('portal.inbox.empty')}</p>
            </div>
          ) : filtered.map((m) => {
            const sev = SEVERITY_META[m.severity] ?? SEVERITY_META.info;
            const catIcon = CATEGORY_ICON[m.category] ?? CATEGORY_ICON.general;
            const catLabel = t(CATEGORY_LABEL_KEY[m.category] ?? CATEGORY_LABEL_KEY.general);
            const unread = !m.is_read;
            return (
              <div
                key={m.id}
                onClick={() => onCardClick(m)}
                className={`group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-xl border p-5 transition-all hover:bg-[#11151a] ${
                  unread ? 'border-[#1f2937]/40 bg-[#1a1c1e]' : 'border-[#1f2937]/20 bg-[#1a1c1e]/50 opacity-80'
                }`}
              >
                {unread && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: sev.stripe, boxShadow: `0 0 10px ${sev.stripe}` }}
                  />
                )}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
                  unread ? `${sev.iconBg} ${sev.iconBorder}` : 'border-[#1f2937]/30 bg-[#1a1f26]'
                }`}>
                  <span className="material-symbols-outlined text-[24px]" style={{ color: unread ? sev.stripe : '#a0a0a8' }}>
                    {sev.icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className={`truncate font-headline text-base ${unread ? 'text-[#e7eaf0]' : 'text-[#9ca3af]'}`}>{m.subject}</h3>
                    {unread && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#ff5625]" />}
                  </div>
                  <p className={`mb-3 line-clamp-3 text-sm leading-relaxed ${unread ? 'text-[#9ca3af]' : 'text-[#9ca3af]/70'}`}>{m.body}</p>
                  <div className="flex items-center gap-5 text-[11px] text-[#9ca3af]/80">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {timeAgo(m.created_at)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">{catIcon}</span>
                      {catLabel}
                    </span>
                  </div>
                </div>
                {m.action_url && m.action_label && (
                  <div className="shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={m.action_url}
                      onClick={() => { if (unread) void markRead(m.id); }}
                      className={`inline-block rounded-lg px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
                        unread
                          ? 'bg-[#ff5625] text-white shadow-lg  hover:bg-[#ff5625]/90'
                          : 'border border-[#1f2937]/40 bg-[#1a1f26] text-[#9ca3af] hover:bg-[#3d3f41]'
                      }`}
                    >
                      {m.action_label}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PortalShell>
  );
}
