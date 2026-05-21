'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import Link from 'next/link';
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
      router.replace('/portal/dashboard');
    }
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell
      variant="admin"
      nav={
        <>
          <Link href="/portal/admin" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Tổng quan</Link>
          <Link href="/portal/admin/registrations" className="text-[#0e1525]/60 hover:text-[#0e1525]">Đăng ký</Link>
        </>
      }
    >
      <AdminConsole />
    </PortalShell>
  );
}
