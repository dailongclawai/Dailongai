'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import {
  getInboxMessages,
  markMessageRead,
  sendFeedback,
  adminReply,
} from '@/lib/portal-queries';
import type { PortalMessage } from '@/lib/portal-types';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const YM_CSS = `
.ymx-wrap{font-family:Tahoma,"Segoe UI",Arial,sans-serif;display:flex;justify-content:center;}
.ymx-window{width:100%;max-width:860px;overflow:hidden;border:1px solid #3d87d7;border-radius:4px;
  box-shadow:0 0 0 1px rgba(255,255,255,.55) inset,0 0 0 2px rgba(100,168,240,.42),0 8px 28px rgba(0,0,0,.5);
  background:#702070;}
.ymx-titlebar{height:26px;display:flex;align-items:center;justify-content:space-between;color:#fff;
  text-shadow:0 1px 1px rgba(0,0,0,.65);font-weight:600;font-size:12px;
  background:linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,0) 42%),linear-gradient(#cc76cc 0%,#8b2a8b 45%,#681b68 100%);
  border-bottom:1px solid #4e174e;}
.ymx-title{display:flex;align-items:center;gap:6px;padding-left:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ymx-controls{display:flex;height:18px;margin-right:3px;}
.ymx-controls span{width:21px;text-align:center;font:12px/16px Tahoma,sans-serif;color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:2px;margin-left:2px;background:rgba(255,255,255,.12);}
.ymx-controls span.x{background:linear-gradient(#db6f6f,#a82d2d);}
.ymx-menubar{height:22px;display:flex;align-items:center;gap:14px;padding:0 10px;color:#f3dff3;font-size:11px;
  background:linear-gradient(#8a218a,#6d1b6d);border-bottom:1px solid #9d519d;}
.ymx-body{display:flex;min-height:440px;}
.ymx-list{width:260px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid #4e164e;background:#fff;}
.ymx-profile{height:54px;display:flex;align-items:center;gap:8px;padding:6px 8px;color:#fff;
  background:radial-gradient(circle at 85% 28%,rgba(255,255,255,.22),transparent 25%),linear-gradient(#9e3a9e,#742074);border-bottom:1px solid #582058;}
.ymx-avatar{width:40px;height:40px;border:1px solid #d5bad5;border-radius:3px;background:linear-gradient(135deg,#ffd9b0,#ff8a5c);display:flex;align-items:center;justify-content:center;font-size:20px;}
.ymx-id{flex:1;min-width:0;}
.ymx-id strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ymx-id em{display:block;font-style:normal;font-size:10px;color:#f0dff0;}
.ymx-id em b{color:#8fff9f;}
.ymx-compose{margin:6px;padding:6px;border:1px solid #ca9b25;border-radius:3px;cursor:pointer;
  background:linear-gradient(#ffe68b,#ffc83b);color:#5b3a00;font:bold 11px Tahoma,sans-serif;}
.ymx-compose:hover{background:linear-gradient(#ffeda0,#ffce55);}
.ymx-scroll{flex:1;overflow-y:auto;}
.ymx-section{height:24px;display:flex;align-items:center;gap:6px;padding:0 9px;font-weight:700;font-size:11px;color:#4b334b;
  background:linear-gradient(#eee6ee,#cf9fcf);border-top:1px solid #f7f0f7;border-bottom:1px solid #b47cb4;}
.ymx-item{width:100%;display:flex;align-items:center;gap:7px;padding:5px 9px 5px 12px;border:0;text-align:left;cursor:pointer;
  background:#fff;border-bottom:1px solid #f0eaf0;font:11px Tahoma,sans-serif;}
.ymx-item:hover{background:#eef4fd;}
.ymx-item.sel{background:linear-gradient(#dceafe,#c4dbfb);}
.ymx-dot{width:9px;height:9px;flex-shrink:0;border-radius:50%;border:1px solid #b57900;background:#ffc033;}
.ymx-dot.read{background:#cdcdcd;border-color:#9a9a9a;}
.ymx-item-sub{flex:1;min-width:0;color:#222;}
.ymx-item.unread .ymx-item-sub{font-weight:700;}
.ymx-item-sub span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ymx-item-time{flex-shrink:0;font-size:10px;color:#888;}
.ymx-chat{flex:1;display:flex;flex-direction:column;min-width:0;background:#702070;}
.ymx-chat-head{height:24px;display:flex;align-items:center;gap:6px;padding:0 10px;color:#fff;font-size:12px;font-weight:600;
  background:linear-gradient(#9a479a,#742074);text-shadow:0 1px 1px rgba(0,0,0,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ymx-chat-head .s{width:8px;height:8px;flex-shrink:0;border-radius:50%;background:#ffc033;border:1px solid #b57900;}
.ymx-tools{height:46px;display:flex;align-items:center;gap:18px;padding:0 12px;
  background:radial-gradient(circle at 62% 25%,rgba(255,255,255,.18),transparent 18%),linear-gradient(#8b248b,#6e1d6e);}
.ymx-tools button{border:0;background:transparent;color:#fff;font:10px Tahoma,sans-serif;text-shadow:0 1px 1px rgba(0,0,0,.45);cursor:default;display:flex;flex-direction:column;align-items:center;gap:3px;}
.ymx-tool{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#b09cb0 45%,#6c546c);box-shadow:inset 0 1px rgba(255,255,255,.8),0 1px 2px rgba(0,0,0,.35);}
.ymx-tool.v{border-radius:7px;background:linear-gradient(90deg,#333,#eee 35%,#8b8b8b 60%,#333);}
.ymx-tool.p{border-radius:2px;background:linear-gradient(135deg,#d6b6d6 50%,#8d668d 50%);}
.ymx-transcript{flex:1;margin:4px;padding:7px 9px;overflow-y:auto;background:#fff;border:1px solid #a977a9;min-height:150px;}
.ymx-transcript .row{margin:0 0 9px;font-size:12px;line-height:1.4;color:#222;}
.ymx-transcript .nm{font-weight:700;}
.ymx-transcript .tm{color:#888;font-size:11px;}
.ymx-empty{flex:1;display:flex;align-items:center;justify-content:center;color:#e7cce7;font-size:12px;text-align:center;padding:20px;}
.ymx-ctools{height:26px;display:flex;align-items:center;gap:10px;padding:0 9px;color:#fff;
  background:linear-gradient(#892b89,#711c71);border-top:1px solid #a869a8;}
.ymx-ctools b,.ymx-ctools i,.ymx-ctools u{font-size:13px;width:14px;text-align:center;opacity:.85;text-shadow:0 1px rgba(0,0,0,.45);}
.ymx-subin{margin:4px 4px 0;}
.ymx-subin input{width:100%;height:24px;border:1px solid #b27ab2;padding:2px 6px;font:11px Tahoma,sans-serif;background:#fff;}
.ymx-inrow{display:flex;gap:8px;padding:4px;background:#8a258a;}
.ymx-inrow textarea{flex:1;height:46px;resize:none;border:1px solid #b27ab2;padding:4px 6px;font:12px Tahoma,sans-serif;background:#fff;}
.ymx-send{width:62px;align-self:stretch;border:1px solid #ca9b25;border-radius:3px;cursor:pointer;
  background:linear-gradient(#ffe68b,#ffc83b);color:#5b3a00;font:bold 12px Tahoma,sans-serif;}
.ymx-send:hover{background:linear-gradient(#ffeda0,#ffce55);}
.ymx-send:disabled{opacity:.5;cursor:default;}
.ymx-hint{padding:2px 6px 5px;font-size:10px;color:#e7cce7;background:#8a258a;}
@media(max-width:640px){.ymx-body{flex-direction:column;}.ymx-list{width:100%;max-height:240px;border-right:0;border-bottom:1px solid #4e164e;}}
`;

export default function InboxPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    getInboxMessages().then(setMessages);
  }, [loading, session, router]);

  if (loading || !session || !profile) return null;

  const isAdmin = profile.role === 'admin';
  const selected = messages.find((m) => m.id === openId) ?? null;
  const unread = messages.filter((m) => !m.is_read && m.recipient_id === session.user.id).length;
  const sysMsgs = messages.filter((m) => !m.sender_id);
  const convMsgs = messages.filter((m) => m.sender_id);

  const senderLabel = (m: PortalMessage) =>
    !m.sender_id ? 'Đại Long' : m.sender_id === session.user.id ? 'Bạn' : 'Quản trị viên';
  const senderColor = (m: PortalMessage) =>
    !m.sender_id ? '#2a2872' : m.sender_id === session.user.id ? '#0e7a2e' : '#8b2a8b';

  const open = async (msg: PortalMessage) => {
    setComposing(false);
    setOpenId(msg.id);
    if (!msg.is_read && msg.recipient_id === session.user.id) {
      await markMessageRead(msg.id);
      setMessages((ms) => ms.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
    }
  };

  const submitReply = async () => {
    if (!selected) return;
    const b = reply.trim();
    if (!b) { toast.error('Nhập nội dung trả lời'); return; }
    setReplying(true);
    try {
      await adminReply(selected.id, b);
      toast.success('Đã gửi trả lời');
      setReply('');
      setMessages(await getInboxMessages());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi trả lời');
    } finally {
      setReplying(false);
    }
  };

  const submitFeedback = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Nhập tiêu đề và nội dung'); return; }
    setSending(true);
    try {
      await sendFeedback(subject.trim(), body.trim());
      toast.success('Đã gửi góp ý đến ban quản trị');
      setSubject(''); setBody(''); setComposing(false);
      setMessages(await getInboxMessages());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi góp ý');
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); }
  };

  const firstName = profile.full_name?.split(' ').slice(-1)[0] ?? profile.email?.split('@')[0] ?? 'Tài khoản';
  const dashHref = profile.role === 'supervisor' ? '/portal/supervisor' : '/portal/dashboard';
  const nav = isAdmin
    ? <AdminNav />
    : <Link href={dashHref} className="text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]">← Bảng điều khiển</Link>;

  const Item = (m: PortalMessage) => {
    const isUnread = !m.is_read && m.recipient_id === session.user.id;
    return (
      <button key={m.id} className={`ymx-item ${m.id === openId ? 'sel' : ''} ${isUnread ? 'unread' : ''}`} onClick={() => open(m)}>
        <span className={`ymx-dot ${isUnread ? '' : 'read'}`} />
        <span className="ymx-item-sub"><span>{m.subject}</span></span>
        <span className="ymx-item-time">{timeAgo(m.created_at)}</span>
      </button>
    );
  };

  return (
    <PortalShell variant={isAdmin ? 'admin' : profile.role === 'supervisor' ? 'supervisor' : 'dealer'} nav={nav}>
      <style>{YM_CSS}</style>
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#e2e2e5]/50">{unread > 0 ? `${unread} chưa đọc` : 'Tất cả đã đọc'}</p>
        <h1 className="mt-2 font-headline text-3xl">Hộp thư</h1>
      </div>

      <div className="ymx-wrap">
        <div className="ymx-window">
          <div className="ymx-titlebar">
            <span className="ymx-title">💬 Đại Long Messenger</span>
            <span className="ymx-controls"><span>—</span><span>▢</span><span className="x">✕</span></span>
          </div>
          <div className="ymx-menubar"><span>Hộp thư</span><span>Hành động</span><span>Trợ giúp</span></div>

          <div className="ymx-body">
            {/* Buddy-list = message list */}
            <aside className="ymx-list">
              <div className="ymx-profile">
                <div className="ymx-avatar">😺</div>
                <div className="ymx-id">
                  <strong>{firstName}</strong>
                  <em><b>●</b> Trực tuyến</em>
                </div>
              </div>
              {!isAdmin && (
                <button className="ymx-compose" onClick={() => { setComposing(true); setOpenId(null); }}>✎ Soạn góp ý mới</button>
              )}
              <div className="ymx-scroll">
                {messages.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 11 }}>Hộp thư trống</div>}
                {sysMsgs.length > 0 && <div className="ymx-section">📢 Thông báo ({sysMsgs.length})</div>}
                {sysMsgs.map(Item)}
                {convMsgs.length > 0 && <div className="ymx-section">💬 Tin nhắn ({convMsgs.length})</div>}
                {convMsgs.map(Item)}
              </div>
            </aside>

            {/* Chat window */}
            <main className="ymx-chat">
              {composing ? (
                <>
                  <div className="ymx-chat-head"><span className="s" /> Soạn góp ý đến ban quản trị</div>
                  <div className="ymx-transcript">
                    <p className="row" style={{ color: '#888' }}>Góp ý của bạn sẽ được gửi tới toàn bộ quản trị viên. Họ có thể trả lời ngay trong hộp thư này.</p>
                  </div>
                  <div className="ymx-subin">
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Tiêu đề…" />
                  </div>
                  <div className="ymx-ctools"><b>B</b><i>I</i><u>U</u></div>
                  <div className="ymx-inrow">
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => onKey(e, submitFeedback)} placeholder="Nội dung… (Enter để gửi, Shift+Enter xuống dòng)" />
                    <button className="ymx-send" disabled={sending} onClick={submitFeedback}>{sending ? '…' : 'Gửi'}</button>
                  </div>
                  <div className="ymx-hint">Enter để gửi · Shift+Enter xuống dòng</div>
                </>
              ) : selected ? (
                <>
                  <div className="ymx-chat-head"><span className="s" /> {selected.subject}</div>
                  <div className="ymx-tools">
                    <button type="button"><span className="ymx-tool v" />Cuộc gọi</button>
                    <button type="button"><span className="ymx-tool" />Hồ sơ</button>
                    <button type="button"><span className="ymx-tool p" />Ảnh</button>
                  </div>
                  <div className="ymx-transcript">
                    <p className="row">
                      <span className="nm" style={{ color: senderColor(selected) }}>({fmtTime(selected.created_at)}) {senderLabel(selected)}:</span>{' '}
                      <span style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</span>
                    </p>
                  </div>
                  {isAdmin && selected.sender_id ? (
                    <>
                      <div className="ymx-ctools"><b>B</b><i>I</i><u>U</u></div>
                      <div className="ymx-inrow">
                        <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => onKey(e, submitReply)} placeholder="Trả lời… (Enter để gửi)" />
                        <button className="ymx-send" disabled={replying} onClick={submitReply}>{replying ? '…' : 'Gửi'}</button>
                      </div>
                      <div className="ymx-hint">Trả lời sẽ xuất hiện trong hộp thư của người gửi.</div>
                    </>
                  ) : (
                    <div className="ymx-hint" style={{ padding: '8px 9px' }}>Tin nhắn hệ thống — không thể trả lời.</div>
                  )}
                </>
              ) : (
                <div className="ymx-empty">Chọn một tin nhắn bên trái để xem nội dung.<br />{!isAdmin && 'Hoặc bấm “Soạn góp ý mới”.'}</div>
              )}
            </main>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
