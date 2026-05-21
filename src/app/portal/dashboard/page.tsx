'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { DealerDashboard } from '@/components/portal/DealerDashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/portal/login');
      return;
    }
    if (!profile) return;
    if (!profile.phone) {
      router.replace('/portal/onboarding');
      return;
    }
    if (profile.status !== 'active' || !profile.role) {
      router.replace('/portal/pending');
      return;
    }
    if (profile.role === 'admin') router.replace('/portal/admin');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.status !== 'active' || !profile.role) return null;

  if (profile.role === 'admin') return null;

  return (
    <PortalShell variant={profile.role}>
      <DealerDashboard profile={profile} />
    </PortalShell>
  );
}
