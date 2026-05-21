'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.getSession();
      if (error) {
        toast.error(error.message);
        router.replace('/portal/login');
        return;
      }
      if (data.session) {
        router.replace('/portal');
        return;
      }
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error: exchErr } = await client.auth.exchangeCodeForSession(code);
        if (exchErr) {
          toast.error(exchErr.message);
          router.replace('/portal/login');
          return;
        }
        router.replace('/portal');
      } else {
        router.replace('/portal/login');
      }
    })();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-[#0e1525]/50">
      Đang hoàn tất đăng nhập…
    </div>
  );
}
