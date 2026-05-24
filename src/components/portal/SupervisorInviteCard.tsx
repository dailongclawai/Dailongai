'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

interface Props {
  supervisorId: string;
  supervisorName: string | null;
  teamCount: number;
}

export function SupervisorInviteCard({ supervisorId, supervisorName, teamCount }: Props) {
  const { t } = useI18n();
  const [refLink, setRefLink] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!supervisorId) return;
    const base = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin;
    const link = `${base}/portal/register?ref=${supervisorId}`;
    setRefLink(link);
    QRCode.toDataURL(link, { width: 320, margin: 2, color: { dark: '#0c0e10', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [supervisorId]);

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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#ff5625]/30 bg-gradient-to-br from-[#ff5625]/[0.05] to-[#11151a]">
      <div className="flex items-center justify-between gap-3 border-b border-[#ff5625]/20 bg-[#ff5625]/[0.04] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[#ff5625]">person_add</span>
          <div>
            <p className="text-sm font-bold text-[#e7eaf0]">{t('portal.components.supervisorInviteCard.title')}</p>
            <p className="text-[10px] text-[#9ca3af]">{t('portal.components.supervisorInviteCard.subtitle')}</p>
          </div>
        </div>
        <p className="font-mono text-[11px] tabular-nums text-[#9ca3af]">
          <span className="font-semibold text-[#ff5625]">{teamCount}</span> {t('portal.components.supervisorInviteCard.invited_suffix')}
        </p>
      </div>

      <div className="flex flex-1 items-center gap-5 p-5">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl border border-[#ff5625]/20 bg-white p-2 shadow-[0_4px_18px_-6px_rgba(255,86,37,0.45)]"
          style={{ width: 132, height: 132 }}
        >
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR" className="h-full w-full rounded-md" />
          ) : (
            <span className="material-symbols-outlined text-[40px] text-[#9ca3af]/40">qr_code_2</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">
              {t('portal.components.supervisorInviteCard.link_label')}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#e7eaf0]/80" title={refLink}>
              {refLink || '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!refLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff5625]/40 bg-[#ff5625]/10 px-3 py-1.5 text-xs font-semibold text-[#ff5625] transition-colors hover:border-[#ff5625] hover:bg-[#ff5625] hover:text-white active:scale-[0.98] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              {t('portal.supervisor.qr.copy_link')}
            </button>
            <button
              type="button"
              onClick={downloadQR}
              disabled={!qr}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f2937] bg-[#0a0c0f]/60 px-3 py-1.5 text-xs font-semibold text-[#e7eaf0] transition-colors hover:border-[#ff5625]/40 hover:text-[#ff5625] active:scale-[0.98] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              {t('portal.supervisor.qr.download_qr')}
            </button>
            <Link
              href="/portal/supervisor/qr"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f2937] bg-[#0a0c0f]/60 px-3 py-1.5 text-xs font-semibold text-[#9ca3af] transition-colors hover:border-[#ff5625]/40 hover:text-[#ff5625]"
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
