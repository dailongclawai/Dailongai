'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';

export default function SupervisorQRPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [refLink, setRefLink] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role !== 'supervisor') { router.replace('/portal/403'); return; }
  }, [loading, session, profile, router]);

  useEffect(() => {
    if (!session) return;
    const base = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin;
    const link = `${base}/portal/register?ref=${session.user.id}`;
    setRefLink(link);
    QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: '#0c0e10', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [session]);

  if (loading || profile?.role !== 'supervisor') {
    return (
      <PortalShell variant="supervisor">
        <PortalSkeleton.Dashboard />
      </PortalShell>
    );
  }

  const copyLink = async () => {
    if (!refLink) return;
    await navigator.clipboard.writeText(refLink);
    toast.success('Đã copy link mời đại lý');
  };

  const downloadQR = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `dai-long-moi-dai-ly-${(profile?.full_name || 'supervisor').toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Đã tải QR');
  };

  return (
    <PortalShell variant="supervisor">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">Mời đại lý vào nhánh</p>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl">QR riêng của bạn</h1>
        <p className="mt-2 text-sm text-[#9ca3af]">
          Khi đại lý đăng ký qua QR/link này, tài khoản tự động thuộc nhánh của bạn — bạn xem được toàn bộ số liệu kinh doanh.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.08] via-[#11151a] to-[#11151a] p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#10b981]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#ff5625]/5 blur-3xl" />

        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex w-full max-w-[260px] flex-col items-center sm:w-auto sm:max-w-none sm:shrink-0">
            <div
              className="relative rounded-2xl border border-[#10b981]/30 bg-gradient-to-br from-white to-[#f5fdf8] shadow-[0_8px_32px_-8px_rgba(52,211,153,0.4)]"
              style={{ width: 'min(220px, 60vw)', aspectRatio: '1 / 1' }}
            >
              {qr ? (
                <span className="absolute inset-3 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR mời đại lý" className="h-full w-full rounded-lg" />
                </span>
              ) : (
                <div className="absolute inset-3 animate-pulse rounded-lg bg-[#11151a]/10" />
              )}
            </div>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#10b981]/70">
              {profile?.full_name || 'Supervisor'}
            </p>
          </div>

          <div className="w-full flex-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#10b981]">share</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#10b981]">
                Link mời riêng
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5">
              <span className="material-symbols-outlined text-[16px] text-[#9ca3af]">link</span>
              <input
                readOnly
                value={refLink}
                className="min-w-0 flex-1 truncate bg-transparent text-xs text-[#e7eaf0] outline-none"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 rounded-full bg-[#ff5625] px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#ff5625]/90 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Copy link
              </button>
              <button
                onClick={downloadQR}
                disabled={!qr}
                className="flex items-center justify-center gap-2 rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-5 py-2.5 text-xs font-semibold text-[#10b981] transition-all hover:bg-[#10b981]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Tải QR
              </button>
            </div>

            <p className="mt-4 flex items-start gap-1.5 text-[11px] text-[#9ca3af]">
              <span className="material-symbols-outlined text-[14px] text-[#9ca3af]">tips_and_updates</span>
              In QR ra dán tại điểm bán, hoặc gửi Zalo/email cho đại lý mới.
            </p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
