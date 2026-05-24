'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { useI18n } from '@/lib/i18n';

export default function PendingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.status === 'active' && profile.role) router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  if (loading || !session) return null;

  return (
    <PortalShell variant="dealer">
      <div className="portal-glass mx-auto max-w-xl space-y-6 rounded-3xl border border-[#1f2937]/40 p-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.auth.pending.badge')}</p>
        <h1 className="font-headline text-3xl">{t('portal.auth.pending.title')}</h1>
        <p className="text-sm text-[#e7eaf0]/70">
          {t('portal.auth.pending.body')}
        </p>
        <div className="rounded-xl bg-[#11151a] p-4 text-left text-xs text-[#e7eaf0]/60">
          <p className="mb-1 font-semibold text-[#e7eaf0]">{t('portal.auth.pending.while_waiting')}</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>{t('portal.auth.pending.tip_1')}</li>
            <li>{t('portal.auth.pending.tip_2')}</li>
            <li>{t('portal.auth.pending.tip_3')}</li>
          </ul>
        </div>
      </div>
    </PortalShell>
  );
}
