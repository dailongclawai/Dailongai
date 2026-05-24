'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

export function OrderQRCard({ slug }: { slug: string | null }) {
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
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625] font-bold">Mã QR đặt đơn</p>
        <p className="mt-3 text-sm text-[#9ca3af]">Hệ thống đang tạo mã QR cho tài khoản đại lý. Vui lòng tải lại trang sau ít phút.</p>
      </div>
    );
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã sao chép link');
    } catch {
      toast.error('Không sao chép được');
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#1f2937]/40 bg-[#1a1c1e] p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#ff5625]">Mã QR đặt đơn</p>
          <h3 className="mt-1 font-headline text-xl text-[#e7eaf0]">Đơn về thẳng đại lý</h3>
        </div>
        <span className="material-symbols-outlined text-[28px] text-[#ff5625]/30">qr_code_2</span>
      </div>

      <div className="mb-5 flex justify-center">
        <div className="rounded-xl bg-white p-3">
          {dataUrl ? (
            <img src={dataUrl} alt="QR đặt đơn" className="block h-[220px] w-[220px]" />
          ) : (
            <div className="h-[220px] w-[220px] animate-pulse rounded bg-[#3d3f41]/20" />
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#9ca3af]">Đường dẫn</p>
        <code className="block break-all rounded-lg border border-[#1f2937]/40 bg-[#0a0c0f] px-3 py-2 text-[11px] font-mono text-[#e7eaf0]">{url}</code>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={copyUrl}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#1f2937]/40 bg-[#1a1f26] px-2 py-3 text-xs font-medium text-[#e7eaf0] transition-all hover:bg-[#3d3f41] active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">content_copy</span>
          Sao chép
        </button>
        <a
          href={dataUrl ?? '#'}
          download={`qr-dat-don-${slug}.png`}
          aria-disabled={!dataUrl}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg bg-[#ff5625] px-2 py-3 text-xs font-bold text-white shadow-lg  transition-all hover:bg-[#ff5625]/90 active:scale-95 ${!dataUrl ? 'pointer-events-none opacity-50' : ''}`}
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          Tải QR
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#1f2937]/40 bg-[#1a1f26] px-2 py-3 text-xs font-medium text-[#e7eaf0] transition-all hover:bg-[#3d3f41] active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
          Mở form
        </a>
      </div>

      <p className="mt-4 border-t border-[#1f2937]/30 pt-3 text-[11px] leading-relaxed text-[#9ca3af]/70">
        In QR dán tại showroom hoặc gửi cho khách qua Zalo/Messenger. Mọi đơn submit qua link này đều được ghi nhận cho đại lý và chờ Đại Long duyệt.
      </p>
    </div>
  );
}
