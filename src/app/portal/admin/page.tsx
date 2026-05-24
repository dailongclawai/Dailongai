'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { AdminConsole } from '@/components/portal/AdminConsole';

export default function AdminHome() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/portal/login');
      return;
    }
    if (!profile) return;
    if (profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell
      variant="admin"
      nav={<AdminNav />}
    >
      <AdminConsole />
    </PortalShell>
  );
}
