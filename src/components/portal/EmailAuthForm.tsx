'use client';

import { useState } from 'react';
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
    const { error } =
      mode === 'login'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/portal/auth/callback` },
          });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else if (mode === 'register') {
      toast.success('Kiểm tra email để xác thực tài khoản');
    } else {
      window.location.assign('/portal');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
        />
        {errors.email && <p className="mt-1 text-xs text-[#c46a5e]">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#0e1525]"
        />
        {errors.password && <p className="mt-1 text-xs text-[#c46a5e]">{errors.password}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#0e1525] py-3 text-sm font-medium text-[#f5f1e8] transition-colors hover:bg-[#bc7e3b] disabled:opacity-50"
      >
        {loading ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </button>
    </form>
  );
}
