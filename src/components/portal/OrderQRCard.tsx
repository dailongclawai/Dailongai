'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useI18n } from '@/lib/i18n';

export function OrderQRCard({ slug }: { slug: string | null }) {
  const { t } = useI18n();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const url = slug && origin ? `${origin}/dat-don?d=${encodeURIComponent(slug)}` : '';

  useEffect(() => {
    if (!url) { setDataUrl(null); return; }
    QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: '#121416', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [url]);

  if (!slug) {
    return (
      <div className="rounded-2xl border border-[#1f2937]/40 bg-[#1a1c1e] p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625] font-bold">{t('portal.components.orderQR.title')}</p>
        <p className="mt-3 text-sm text-[#9ca3af]">{t('portal.components.orderQR.generating')}</p>
      </div>
    );
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('portal.components.orderQR.toast_copied'));
    } catch {
      toast.error(t('portal.components.orderQR.toast_copy_failed'));
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#1f2937]/40 bg-[#1a1c1e] p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#ff5625]">{t('portal.components.orderQR.title')}</p>
          <h3 className="mt-1 font-headline text-xl text-[#e7eaf0]">{t('portal.components.orderQR.subtitle')}</h3>
        </div>
        <span className="material-symbols-outlined text-[28px] text-[#ff5625]/30">qr_code_2</span>
      </div>

      <div className="mb-5 flex justify-center">
        <div className="rounded-xl bg-white p-3">
          {dataUrl ? (
            <img src={dataUrl} alt={t('portal.components.orderQR.alt')} className="block h-[220px] w-[220px]" />
          ) : (
            <div className="h-[220px] w-[220px] animate-pulse rounded bg-[#3d3f41]/20" />
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.components.orderQR.link_label')}</p>
        <code className="block break-all rounded-lg border border-[#1f2937]/40 bg-[#0a0c0f] px-3 py-2 text-[11px] font-mono text-[#e7eaf0]">{url}</code>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={copyUrl}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#1f2937]/40 bg-[#1a1f26] px-2 py-3 text-xs font-medium text-[#e7eaf0] transition-all hover:bg-[#3d3f41] active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">content_copy</span>
          {t('portal.components.orderQR.copy')}
        </button>
        <a
          href={dataUrl ?? '#'}
          download={`qr-dat-don-${slug}.png`}
          aria-disabled={!dataUrl}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg bg-[#ff5625] px-2 py-3 text-xs font-bold text-white shadow-lg  transition-all hover:bg-[#ff5625]/90 active:scale-95 ${!dataUrl ? 'pointer-events-none opacity-50' : ''}`}
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          {t('portal.components.orderQR.download')}
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#1f2937]/40 bg-[#1a1f26] px-2 py-3 text-xs font-medium text-[#e7eaf0] transition-all hover:bg-[#3d3f41] active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
          {t('portal.components.orderQR.open_form')}
        </a>
      </div>

      <p className="mt-4 border-t border-[#1f2937]/30 pt-3 text-[11px] leading-relaxed text-[#9ca3af]/70">
        {t('portal.components.orderQR.footer_note')}
      </p>
    </div>
  );
}
