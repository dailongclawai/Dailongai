'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';

export default function PendingPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.status === 'active' && profile.role) router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  if (loading || !session) return null;

  return (
    <PortalShell variant="dealer">
      <div className="portal-glass mx-auto max-w-xl space-y-6 rounded-3xl border border-[#3d3f41]/40 p-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Tình trạng</p>
        <h1 className="font-headline text-3xl">Đang chờ admin duyệt</h1>
        <p className="text-sm text-[#e2e2e5]/70">
          Hồ sơ đăng ký đã được gửi tới đội Đại Long. Admin sẽ duyệt trong giờ làm việc và thông báo qua email + Zalo OA.
        </p>
        <div className="rounded-xl bg-[#1e2022] p-4 text-left text-xs text-[#e2e2e5]/60">
          <p className="mb-1 font-semibold text-[#e2e2e5]">Trong khi chờ:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Đảm bảo SĐT/email mở để admin liên hệ xác minh hồ sơ doanh nghiệp.</li>
            <li>Chuẩn bị giấy phép kinh doanh + CMND (admin có thể yêu cầu).</li>
            <li>Có thắc mắc? Liên hệ Zalo OA Đại Long.</li>
          </ul>
        </div>
      </div>
    </PortalShell>
  );
}
