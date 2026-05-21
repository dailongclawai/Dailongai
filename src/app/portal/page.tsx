'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function PortalIndex() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/portal/login');
    } else if (!profile || !profile.phone) {
      router.replace('/portal/onboarding');
    } else if (profile.status === 'pending' || !profile.role) {
      router.replace('/portal/pending');
    } else {
      router.replace('/portal/dashboard');
    }
  }, [loading, session, profile, router]);

  return (
    <div className="flex h-screen items-center justify-center text-[#0e1525]/50">
      Đang kiểm tra phiên đăng nhập…
    </div>
  );
}
