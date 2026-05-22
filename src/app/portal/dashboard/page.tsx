'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    if (profile.status === 'suspended') {
      router.replace('/portal/pending');
      return;
    }
    if (profile.role === 'admin') { router.replace('/portal/admin'); return; }
    if (profile.role === 'supervisor') { router.replace('/portal/supervisor'); return; }
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant={profile.role} nav={<Link href="/portal/documents" className="text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]">Tài liệu</Link>}>
      <DealerDashboard profile={profile} />
    </PortalShell>
  );
}
