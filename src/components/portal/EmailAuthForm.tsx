'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
});

export function EmailAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [ref, setRef] = useState<string | null>(null);

  // On the register page, capture the referring supervisor id from ?ref= and
  // stash it so any signup method (incl. OAuth redirect) can attach the branch.
  useEffect(() => {
    if (mode !== 'register') return;
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r) {
      setRef(r);
      localStorage.setItem('portal_ref', r);
    }
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next: typeof errors = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0] === 'email') next.email = i.message;
        if (i.path[0] === 'password') next.password = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    const client = getSupabaseClient();
    if (mode === 'login') {
      const { error } = await client.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      window.location.assign('/portal');
      return;
    }
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal/auth/callback`,
        data: ref ? { ref } : undefined,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else if (data.session) {
      // No email confirmation required → account is live, go straight home.
      window.location.assign('/portal');
    } else {
      toast.success('Kiểm tra email để xác thực tài khoản');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === 'register' && ref && (
        <p className="rounded-lg bg-[#34d399]/10 px-3 py-2 text-xs text-[#34d399]">
          Bạn đang đăng ký qua lời mời của một quản lý — tài khoản sẽ thuộc nhánh của họ.
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]"
        />
        {errors.email && <p className="mt-1 text-xs text-[#f87171]">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]"
        />
        {errors.password && <p className="mt-1 text-xs text-[#f87171]">{errors.password}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#ff5625] py-3 text-sm font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff8a5c] disabled:opacity-50"
      >
        {loading ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </button>
    </form>
  );
}
