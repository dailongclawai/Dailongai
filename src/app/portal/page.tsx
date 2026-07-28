'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

export default function PortalIndex() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading, refresh } = useAuth();
  const claiming = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/portal/login');
      return;
    }
    if (!profile) return;

    // Attach a referral captured at signup (e.g. via supervisor QR through OAuth)
    // before routing. Runs once for an unattached dealer.
    const pendingRef = typeof window !== 'undefined' ? localStorage.getItem('portal_ref') : null;
    if (pendingRef && profile.role === 'dealer' && !profile.supervisor_id && !claiming.current) {
      claiming.current = true;
      localStorage.removeItem('portal_ref');
      (async () => {
        await getSupabaseClient().rpc('claim_referral', { p_ref: pendingRef });
        await refresh();
      })();
      return;
    }

    if (profile.status === 'suspended') {
      router.replace('/portal/pending');
      return;
    }
    if (profile.role === 'admin') {
      router.replace('/portal/admin');
      return;
    }
    if (profile.role === 'supervisor') {
      router.replace('/portal/supervisor');
      return;
    }
    // staff (nhân viên kinh doanh) không có trang tổng quan đại lý — vào thẳng CRM.
    // Thiếu nhánh này thì staff bị đẩy về /portal/dashboard và trang đó render null
    // → màn hình đen (Boss gặp 28/07/2026).
    if (profile.role === 'staff') {
      router.replace('/portal/crm/accounts');
      return;
    }
    router.replace('/portal/dashboard');
  }, [loading, session, profile, router, refresh]);

  return (
    <div className="flex h-screen items-center justify-center text-[#e7eaf0]/50">
      {t('portal.auth.index.checking_session')}
    </div>
  );
}
