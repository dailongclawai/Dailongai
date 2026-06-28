'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster } from 'sonner';
import { getPublicDealerInfo } from '@/lib/portal-queries';
import { QuickCheckout } from '@/components/portal/QuickCheckout';

export default function PublicOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#121416] text-[#a0a0a8]">Đang tải…</div>}>
      <PublicOrderForm />
    </Suspense>
  );
}

function PublicOrderForm() {
  const params = useSearchParams();
  const slug = params.get('d') ?? '';

  const [dealerName, setDealerName] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const p = slug ? getPublicDealerInfo(slug) : Promise.resolve(null);
    p.then((info) => {
      setDealerName(info?.dealer_name ?? null);
      setDealerId(info?.dealer_id ?? null);
    }).finally(() => { setLoading(false); setResolved(true); });
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#121416] text-[#a0a0a8]">Đang tải…</div>;
  }

  if (resolved && (!slug || !dealerName)) {
    return (
      <div className="min-h-screen bg-[#121416] text-[#e2e2e5] flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl border border-[#ffb4ab]/30 bg-[#1a1c1e] p-8">
          <span className="material-symbols-outlined text-[#ffb4ab] text-[48px]">error</span>
          <h1 className="font-headline text-2xl mt-3">Mã đại lý không hợp lệ</h1>
          <p className="text-sm text-[#a0a0a8] mt-2">Đường dẫn QR không tìm thấy đại lý. Vui lòng quét lại mã QR chính xác từ đại lý của Đại Long.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" theme="dark" richColors />
      <QuickCheckout slug={slug} surface="public" dealerName={dealerName} dealerId={dealerId} />
    </>
  );
}
