'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

interface Props {
  supervisorId: string;
  supervisorName: string | null;
  teamCount: number;
}

// origin chỉ có ở trình duyệt — đọc qua useSyncExternalStore để khỏi lệch hydrate
// và khỏi phải setState trong effect.
const subscribeNever = () => () => {};
const readOrigin = () => window.location.origin;
const readOriginOnServer = () => '';

export function SupervisorInviteCard({ supervisorId, supervisorName, teamCount }: Props) {
  const { t } = useI18n();
  const [qr, setQr] = useState('');
  const origin = useSyncExternalStore(subscribeNever, readOrigin, readOriginOnServer);

  const base = process.env.NEXT_PUBLIC_PORTAL_URL || origin;
  const refLink = supervisorId && base ? `${base}/portal/register?ref=${supervisorId}` : '';

  useEffect(() => {
    if (!refLink) return;
    let cancelled = false;
    QRCode.toDataURL(refLink, { width: 320, margin: 2, color: { dark: '#0c0e10', light: '#ffffff' } })
      .then(d => { if (!cancelled) setQr(d); })
      .catch(() => { if (!cancelled) setQr(''); });
    return () => { cancelled = true; };
  }, [refLink]);

  const copyLink = async () => {
    if (!refLink) return;
    await navigator.clipboard.writeText(refLink);
    toast.success(t('portal.supervisor.qr.toast.copied'));
  };

  const downloadQR = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `dai-long-moi-dai-ly-${(supervisorName || 'supervisor').toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t('portal.supervisor.qr.toast.downloaded'));
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#ff8a50]/30 bg-gradient-to-br from-[#ff8a50]/[0.05] to-[#1a1c1f]">
      <div className="flex items-center justify-between gap-3 border-b border-[#ff8a50]/20 bg-[#ff8a50]/[0.04] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[#ff8a50]">person_add</span>
          <div>
            <p className="text-sm font-bold text-[#e2e2e6]">{t('portal.components.supervisorInviteCard.title')}</p>
            <p className="text-[10px] text-[#b3aca8]">{t('portal.components.supervisorInviteCard.subtitle')}</p>
          </div>
        </div>
        <p className="font-mono text-[11px] tabular-nums text-[#b3aca8]">
          <span className="font-semibold text-[#ff8a50]">{teamCount}</span> {t('portal.components.supervisorInviteCard.invited_suffix')}
        </p>
      </div>

      <div className="flex flex-1 items-center gap-5 p-5">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl border border-[#ff8a50]/20 bg-white p-2 shadow-[0_4px_18px_-6px_rgba(255,138,80,0.45)]"
          style={{ width: 132, height: 132 }}
        >
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR" className="h-full w-full rounded-md" />
          ) : (
            <span className="material-symbols-outlined text-[40px] text-[#b3aca8]/40">qr_code_2</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#b3aca8]">
              {t('portal.components.supervisorInviteCard.link_label')}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#e2e2e6]/80" title={refLink}>
              {refLink || '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!refLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff8a50]/40 bg-[#ff8a50]/10 px-3 py-1.5 text-xs font-semibold text-[#ff8a50] transition-colors hover:border-[#ff8a50] hover:bg-[#e8692a] hover:text-white active:scale-[0.98] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              {t('portal.supervisor.qr.copy_link')}
            </button>
            <button
              type="button"
              onClick={downloadQR}
              disabled={!qr}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#49443f] bg-[#0c0e11]/60 px-3 py-1.5 text-xs font-semibold text-[#e2e2e6] transition-colors hover:border-[#ff8a50]/40 hover:text-[#ff8a50] active:scale-[0.98] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              {t('portal.supervisor.qr.download_qr')}
            </button>
            <Link
              href="/portal/supervisor/qr"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#49443f] bg-[#0c0e11]/60 px-3 py-1.5 text-xs font-semibold text-[#b3aca8] transition-colors hover:border-[#ff8a50]/40 hover:text-[#ff8a50]"
            >
              {t('portal.components.supervisorInviteCard.full_page')}
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
