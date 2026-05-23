'use client';

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';

const config = {
  google: {
    label: 'Tiếp tục với Google',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M16.51 8.18c0-.59-.05-1.16-.15-1.7H8.66v3.21h4.4a3.76 3.76 0 01-1.63 2.47v2.06h2.64c1.54-1.42 2.44-3.51 2.44-6.04z"/>
        <path fill="#34A853" d="M8.66 16.5c2.2 0 4.05-.73 5.4-1.97l-2.64-2.06c-.73.5-1.67.79-2.76.79-2.13 0-3.93-1.44-4.57-3.37H1.36v2.12A8.16 8.16 0 008.66 16.5z"/>
        <path fill="#FBBC05" d="M4.09 9.89a4.83 4.83 0 010-3.13V4.64H1.36a8.16 8.16 0 000 7.37l2.73-2.12z"/>
        <path fill="#EA4335" d="M8.66 3.4c1.2 0 2.27.41 3.12 1.22l2.34-2.34A8.13 8.13 0 008.66.5 8.16 8.16 0 001.36 4.64L4.09 6.76C4.73 4.83 6.53 3.4 8.66 3.4z"/>
      </svg>
    ),
  },
  facebook: {
    label: 'Tiếp tục với Facebook',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#1877F2" d="M18 9a9 9 0 10-10.41 8.89V11.6H5.31V9h2.28V7.02c0-2.26 1.34-3.5 3.4-3.5.98 0 2 .17 2 .17v2.2h-1.13c-1.11 0-1.46.69-1.46 1.4V9h2.49l-.4 2.6h-2.09v6.29A9 9 0 0018 9z"/>
      </svg>
    ),
  },
};

export function OAuthButton({ provider }: { provider: 'google' | 'facebook' }) {
  const [busy, setBusy] = useState(false);
  const { label, icon } = config[provider];

  const handle = async () => {
    setBusy(true);
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/portal/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-[#3d3f41]/60 bg-[#1e2022] px-6 py-3 text-sm font-medium text-[#e2e2e5] transition-colors hover:border-[#ff5625] hover:text-[#ff5625] disabled:opacity-50"
    >
      {icon}
      {busy ? 'Đang chuyển hướng…' : label}
    </button>
  );
}
