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
    if (profile.status === 'suspended') {
      router.replace('/portal/pending');
      return;
    }
    if (profile.role === 'admin') { router.replace('/portal/admin'); return; }
    if (profile.role === 'supervisor') { router.replace('/portal/supervisor'); return; }
    // Trang này chỉ dành cho đại lý; vai trò khác mà rơi vào đây thì phải đẩy đi,
    // vì dòng `return null` bên dưới sẽ cho ra màn hình trống.
    if (profile.role === 'staff') { router.replace('/portal/crm/accounts'); return; }
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant={profile.role}>
      <DealerDashboard profile={profile} />
    </PortalShell>
  );
}
