'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderForm } from '@/components/portal/OrderForm';

export default function NewOrderPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile && profile.role !== 'dealer') router.replace('/portal/403');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant="dealer">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.dealer.orders.eyebrow_new')}</p>
        <h1 className="mt-2 font-headline text-3xl">{t('portal.dealer.orders.title_new')}</h1>
      </div>
      <OrderForm userId={session.user.id} />
    </PortalShell>
  );
}
