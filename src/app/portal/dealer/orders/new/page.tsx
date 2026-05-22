'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderForm } from '@/components/portal/OrderForm';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function NewOrderPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile && profile.role !== 'dealer') router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant="dealer">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Đơn mới</p>
        <h1 style={display} className="mt-2 text-3xl font-light italic">Ghi nhận đơn bán máy</h1>
      </div>
      <OrderForm userId={session.user.id} />
    </PortalShell>
  );
}
