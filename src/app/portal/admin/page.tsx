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
          <Link href="/portal/admin" className="border-b-2 border-[#ff5625] pb-1 font-semibold">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Đơn hàng</Link>
          <Link href="/portal/admin/payouts" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Hoa hồng</Link>
          <Link href="/portal/admin/upgrade" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Nâng cấp</Link>
          <Link href="/portal/admin/reports" className="text-[#e2e2e5]/60 hover:text-[#ff5625]">Báo cáo</Link>
        </>
      }
    >
      <AdminConsole />
    </PortalShell>
  );
}
