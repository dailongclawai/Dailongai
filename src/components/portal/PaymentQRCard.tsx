'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import {
  PAYMENT_BANK_CODE,
  PAYMENT_ACCOUNT,
  PAYMENT_NAME,
  PAYMENT_ENABLED,
  orderMemo,
  vietqrUrl,
} from '@/lib/vietqr';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

interface Props {
  orderId: string;
  amount: number;
  dealerName?: string | null;
}

async function downloadQR(url: string, filename: string, labels: { shareTitle: string; toastSuccess: string; toastFallback: string }) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });

    // Mobile: Web Share API → opens system share sheet → user picks "Save to Photos"
    // (the only reliable way to save into iOS Camera Roll / Android Gallery from web)
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: labels.shareTitle, text: filename });
        return;
      } catch (e) {
        // User cancelled OR share failed — fall through to download
        if ((e as Error).name === 'AbortError') return;
      }
    }

    // Desktop / unsupported: classic download to Downloads folder
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    toast.success(labels.toastSuccess);
  } catch {
    // Last-resort fallback: open in new tab so user can long-press / right-click save
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.info(labels.toastFallback);
  }
}

export function PaymentQRCard({ orderId, amount, dealerName }: Props) {
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);

  // Close modal on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (!PAYMENT_ENABLED) {
    return (
      <div className="rounded-2xl border border-[#1f2937] bg-[#11151a] p-5 text-center text-sm text-[#9ca3af]">
        {t('portal.components.paymentQR.payment_disabled')}
      </div>
    );
  }

  const memo = orderMemo(orderId);
  const qrSrc = vietqrUrl(amount, memo);
  const copyMemo = () => { void navigator.clipboard.writeText(memo); toast.success(t('portal.components.paymentQR.toast_memo_copied')); };

  return (
    <>
      <div className="rounded-2xl border-2 border-[#ff5625]/40 bg-[#11151a] p-6">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-[#ff5625]">
          {t('portal.components.paymentQR.transfer_title')}
        </p>
        <p className="mt-1 text-center text-xs text-[#9ca3af]">
          {t('portal.components.paymentQR.scan_hint')}
        </p>

        <button
          type="button"
          onClick={() => setFullscreen(true)}
          aria-label={t('portal.components.paymentQR.aria_zoom')}
          className="group mx-auto mt-5 block w-full max-w-[280px] cursor-zoom-in rounded-xl bg-white p-3 transition-transform hover:scale-[1.02]"
          style={{ aspectRatio: '540 / 630' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`VietQR ${PAYMENT_BANK_CODE} ${PAYMENT_ACCOUNT}`}
            width={540}
            height={630}
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-contain"
          />
        </button>
        <p className="mt-1 text-center text-[10px] text-[#9ca3af]">{t('portal.components.paymentQR.tap_to_zoom')}</p>

        <div className="mt-5 space-y-2 rounded-lg border border-[#1f2937] bg-[#0a0c0f] p-4 text-sm">
          <div className="flex justify-between"><span className="text-[#9ca3af]">{t('portal.components.paymentQR.bank')}</span><span className="font-semibold">{PAYMENT_BANK_CODE}</span></div>
          <div className="flex justify-between"><span className="text-[#9ca3af]">{t('portal.components.paymentQR.account_no')}</span><span className="font-mono tabular-nums font-bold text-[#ff5625]">{PAYMENT_ACCOUNT}</span></div>
          <div className="flex justify-between"><span className="text-[#9ca3af]">{t('portal.components.paymentQR.account_name')}</span><span className="text-right text-xs font-semibold">{PAYMENT_NAME}</span></div>
          <div className="flex justify-between border-t border-[#1f2937] pt-2 mt-1"><span className="text-[#9ca3af]">{t('portal.components.paymentQR.amount')}</span><span className="font-mono tabular-nums font-bold text-[#ff5625]">{fmtVnd(amount)} ₫</span></div>
          <div className="flex justify-between"><span className="text-[#9ca3af]">{t('portal.components.paymentQR.memo')}</span><span className="font-mono tabular-nums font-bold">{memo}</span></div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#ff5625] py-2.5 text-xs font-bold uppercase text-white hover:bg-[#ff6a3d] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
            {t('portal.components.paymentQR.zoom_button')}
          </button>
          <button
            type="button"
            onClick={() => void downloadQR(qrSrc, `${memo}-thanh-toan.png`, {
              shareTitle: t('portal.components.paymentQR.share_title'),
              toastSuccess: t('portal.components.paymentQR.toast_download_success'),
              toastFallback: t('portal.components.paymentQR.toast_download_fallback'),
            })}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 py-2.5 text-xs font-bold uppercase text-[#10b981] hover:bg-[#10b981] hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">photo_library</span>
            {t('portal.components.paymentQR.save_to_photos')}
          </button>
          <button
            type="button"
            onClick={copyMemo}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1f2937] bg-[#0a0c0f] py-2.5 text-xs font-bold uppercase text-[#e7eaf0] hover:bg-[#1a1f26]"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            {t('portal.components.paymentQR.copy_memo')}
          </button>
        </div>

        {dealerName && (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-[#9ca3af]">
            {t('portal.components.paymentQR.after_transfer_prefix')}{' '}
            <span className="font-semibold text-[#e7eaf0]">{dealerName}</span>.
          </p>
        )}
      </div>

      {/* Fullscreen QR modal — for showing on customer's phone */}
      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label={t('portal.components.paymentQR.aria_close')}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <div className="mb-3 text-center text-white">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.paymentQR.transfer_label')}</p>
            <p className="mt-1 font-headline text-3xl tabular-nums">{fmtVnd(amount)} ₫</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-[#9ca3af]">{t('portal.components.paymentQR.memo')}: {memo}</p>
          </div>

          <div
            className="rounded-2xl bg-white p-4 shadow-2xl"
            style={{ width: 'min(85vw, 480px)', aspectRatio: '540 / 630' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt={`VietQR ${PAYMENT_BANK_CODE} ${PAYMENT_ACCOUNT}`}
              width={540}
              height={630}
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>

          <p className="mt-4 max-w-xs text-center text-xs text-white/70">
            {t('portal.components.paymentQR.fullscreen_hint')}
          </p>
        </div>
      )}
    </>
  );
}
