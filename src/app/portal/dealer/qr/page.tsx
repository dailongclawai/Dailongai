'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderQRCard } from '@/components/portal/OrderQRCard';
import { DealerQrFunnelCard } from '@/components/portal/FunnelChart';

export default function DealerQRPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role && profile.role !== 'dealer') router.replace('/portal/403');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile) return null;

  return (
    <PortalShell variant="dealer">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#9ca3af]">Đại lý / Mã QR</p>
        <h1 className="mt-2 font-headline text-3xl">Mã QR đặt đơn</h1>
        <p className="mt-2 max-w-xl text-sm text-[#9ca3af]">
          Mỗi đại lý có một mã QR riêng. Khách hàng quét mã sẽ vào form đặt đơn rút gọn,
          đơn sẽ được tự động ghi nhận cho đại lý.
        </p>
      </div>

      <OrderQRCard slug={profile.order_slug} />

      <div className="mt-6">
        <DealerQrFunnelCard dealerId={profile.id} />
      </div>
    </PortalShell>
  );
}
