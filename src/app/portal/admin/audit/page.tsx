'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { PortalShell } from '@/components/portal/PortalShell';
import { AuditTimeline } from '@/components/portal/AuditTimeline';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';
import { getAuditLog } from '@/lib/portal-queries';
import type { AuditEntry } from '@/lib/portal-types';

export default function AdminAuditPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
      setRows(await getAuditLog(150));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/403');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') {
    return (
      <PortalShell variant="admin">
        <PortalSkeleton.Timeline />
      </PortalShell>
    );
  }

  return (
    <PortalShell variant="admin">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#8bd6b6]">{t('portal.admin.audit.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl">{t('portal.admin.audit.title')}</h1>
        <p className="mt-2 text-sm text-[#a8b3ac]">{t('portal.admin.audit.subtitle')}</p>
      </div>

      {fetching ? <PortalSkeleton.Timeline /> : <AuditTimeline rows={rows} />}
    </PortalShell>
  );
}
