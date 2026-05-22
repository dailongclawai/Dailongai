'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import {
  getInboxMessages,
  markMessageRead,
  sendFeedback,
  adminReply,
} from '@/lib/portal-queries';
import type { PortalMessage } from '@/lib/portal-types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export default function InboxPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    getInboxMessages().then(setMessages);
  }, [loading, session, router]);

  if (loading || !session || !profile) return null;

  const open = async (msg: PortalMessage) => {
    setOpenId(openId === msg.id ? null : msg.id);
    if (!msg.is_read) {
      await markMessageRead(msg.id);
      setMessages((ms) => ms.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
    }
  };

  const submitReply = async (msg: PortalMessage) => {
    const replyBody = replyBodies[msg.id]?.trim() ?? '';
    if (!replyBody) { toast.error('Nhập nội dung trả lời'); return; }
    setReplying(msg.id);
    try {
      await adminReply(msg.id, replyBody);
      toast.success('Đã gửi trả lời đến đại lý');
      setReplyBodies((b) => ({ ...b, [msg.id]: '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi trả lời');
    } finally {
      setReplying(null);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { toast.error('Nhập đầy đủ tiêu đề và nội dung'); return; }
    setSending(true);
    try {
      await sendFeedback(subject.trim(), body.trim());
      toast.success('Đã gửi góp ý đến ban quản trị');
      setSubject('');
      setBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi góp ý');
    } finally {
      setSending(false);
    }
  };

  const isAdmin = profile.role === 'admin';
  const unread = messages.filter((m) => !m.is_read && m.recipient_id === session.user.id).length;

  const variantFor = (): 'dealer' | 'supervisor' | 'admin' => {
    if (profile.role === 'admin') return 'admin';
    if (profile.role === 'supervisor') return 'supervisor';
    return 'dealer';
  };

  return (
    <PortalShell variant={variantFor()}>
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#e2e2e5]/50">
          {unread > 0 ? `${unread} chưa đọc` : 'Tất cả đã đọc'}
        </p>
        <h1 className="mt-2 font-headline text-3xl">Hộp thư</h1>
      </div>

      {/* Message list */}
      <div className="mb-10 overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
        {messages.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[#e2e2e5]/40">Hộp thư trống</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id}>
              {idx > 0 && <div className="border-t border-white/12" />}
              <button
                type="button"
                onClick={() => open(msg)}
                className="w-full px-5 py-4 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      msg.is_read ? 'bg-transparent' : 'bg-[#ff5625]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className={`truncate text-sm ${
                        msg.is_read ? 'font-normal text-[#e2e2e5]/60' : 'font-semibold text-[#e2e2e5]'
                      }`}>
                        {msg.subject}
                      </p>
                      <span className="shrink-0 text-[11px] text-[#e2e2e5]/40">
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>

                    {/* Expanded: body + admin reply form */}
                    {openId === msg.id && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#e2e2e5]/70">
                          {msg.body}
                        </p>

                        {/* Admin reply form — only for feedback messages (sender_id != null) */}
                        {isAdmin && msg.sender_id && (
                          <div className="mt-4 space-y-2 border-t border-white/12 pt-4">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-[#34d399]">Trả lời</p>
                            <textarea
                              value={replyBodies[msg.id] ?? ''}
                              onChange={(e) =>
                                setReplyBodies((b) => ({ ...b, [msg.id]: e.target.value }))
                              }
                              placeholder="Nội dung trả lời…"
                              rows={3}
                              className="w-full resize-none rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]"
                            />
                            <button
                              type="button"
                              disabled={replying === msg.id}
                              onClick={() => submitReply(msg)}
                              className="rounded-full bg-[#34d399] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#34d399]/80 disabled:opacity-50"
                            >
                              {replying === msg.id ? 'Đang gửi…' : 'Gửi trả lời'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Compose feedback — only for non-admin */}
      {!isAdmin && (
        <section>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#34d399]">
            Gửi góp ý đến ban quản trị
          </p>
          <form
            onSubmit={submitFeedback}
            className="space-y-4 rounded-2xl border border-[#34d399]/30 bg-[#34d399]/5 p-6"
          >
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/50">Tiêu đề</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Vấn đề hoặc ý kiến…"
                className="w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/50">Nội dung</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Mô tả chi tiết…"
                rows={4}
                className="w-full resize-none rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="rounded-full bg-[#ff5625] px-6 py-2.5 text-sm font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff8a5c] disabled:opacity-50"
            >
              {sending ? 'Đang gửi…' : 'Gửi góp ý'}
            </button>
          </form>
        </section>
      )}
    </PortalShell>
  );
}
