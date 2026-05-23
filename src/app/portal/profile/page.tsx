'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { getDealerLedger } from '@/lib/portal-queries';
import type { LedgerRow } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { AdminNav } from '@/components/portal/AdminNav';
import { toast } from 'sonner';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [province, setProvince] = useState('');
  const [bizName, setBizName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setBankName(profile.bank_name ?? '');
      setBankHolder(profile.bank_account_name ?? '');
      setBankNumber(profile.bank_account_number ?? '');
      setProvince(profile.province ?? '');
      setBizName(profile.business_name ?? '');
      setIdNumber(profile.id_number ?? '');
      setBizAddress(profile.business_address ?? '');
      if (profile.role === 'dealer') getDealerLedger(profile.id).then(setLedger);
    }
  }, [loading, session, profile, router]);

  const payout = useMemo(() => {
    let pending = 0, paid = 0, last: string | null = null;
    for (const r of ledger) {
      const c = r.commission;
      if (!c || c.voided_at) continue;
      const amt = Number(c.amount);
      if (c.paid_at) {
        paid += amt;
        if (!last || c.paid_at > last) last = c.paid_at;
      } else {
        pending += amt;
      }
    }
    return { pending, paid, last };
  }, [ledger]);

  const saveCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ business_name: bizName, id_number: idNumber, business_address: bizAddress })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success('Đã lưu hồ sơ doanh nghiệp'); await refresh(); }
  };

  const savePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ bank_name: bankName, bank_account_name: bankHolder, bank_account_number: bankNumber, province })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success('Đã lưu thông tin nhận hoa hồng'); await refresh(); }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã cập nhật');
      await refresh();
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã đổi mật khẩu');
      setNewPassword('');
    }
  };

  if (loading || !session || !profile) return null;

  const payoutComplete = !!(profile.bank_name && profile.bank_account_name && profile.bank_account_number);
  const dashHref = profile.role === 'supervisor' ? '/portal/supervisor' : '/portal/dashboard';
  const nav = profile.role === 'admin'
    ? <AdminNav />
    : <Link href={dashHref} className="text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]">← Bảng điều khiển</Link>;

  return (
    <PortalShell variant={profile.role ?? 'dealer'} nav={nav}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Hồ sơ</p>
        <h1 className="mt-2 font-headline text-3xl">Thông tin tài khoản</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Thông tin</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Email</label>
            <input
              value={profile.email ?? ''}
              disabled
              className="w-full rounded-lg border border-[#3d3f41]/40 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5]/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Họ tên</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Số điện thoại</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            Lưu
          </button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022] p-6 backdrop-blur">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff5625]/90 disabled:opacity-50"
          >
            Đổi mật khẩu
          </button>
        </form>
        <section className="grid gap-6 md:col-span-2 lg:grid-cols-12">
          {/* Main payout form card */}
          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022] shadow-2xl">
              {payoutComplete ? (
                <div className="flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <span className="material-symbols-outlined fill text-[20px]">check_circle</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">Đã xác minh</p>
                      <p className="text-[11px] text-emerald-400/70">Tài khoản đã sẵn sàng nhận thanh toán hoa hồng.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/50">Verified</span>
                </div>
              ) : (
                <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                      <span className="material-symbols-outlined text-[20px]">error</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-400">Chưa hoàn tất</p>
                      <p className="text-[11px] text-amber-400/70">Bổ sung đủ ngân hàng, chủ tài khoản và số tài khoản để nhận hoa hồng.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/50">Pending</span>
                </div>
              )}
              <form onSubmit={savePayout} className="space-y-6 p-8">
                <h3 className="border-l-4 border-[#ff5625] pl-4 text-base font-semibold">Thông tin nhận hoa hồng</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-[#e2e2e5]/60">Ngân hàng</label>
                    <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="VD: Vietcombank" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1a1c1e] px-4 py-3 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-[#e2e2e5]/60">Chủ tài khoản</label>
                    <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} placeholder="NGUYEN VAN A" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1a1c1e] px-4 py-3 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-[#e2e2e5]/60">Số tài khoản</label>
                    <input value={bankNumber} onChange={(e) => setBankNumber(e.target.value)} placeholder="Nhập số tài khoản" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1a1c1e] px-4 py-3 font-mono text-sm tabular-nums tracking-wider text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-[#e2e2e5]/60">Khu vực / Tỉnh thành <span className="italic text-[#e2e2e5]/30">(Tùy chọn)</span></label>
                    <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="VD: Hà Nội" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1a1c1e] px-4 py-3 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 outline-none focus:border-[#ff5625]" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#ff5625] px-8 py-3 text-sm font-bold text-white glow-primary-hover transition-all hover:bg-[#ff5625]/90 active:scale-[0.98] disabled:opacity-50">
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Lưu thông tin
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Side panels */}
          <div className="space-y-6 lg:col-span-4">
            <div className="group relative overflow-hidden rounded-2xl border border-[#3d3f41]/40 bg-[#282a2c] p-6">
              <div className="absolute -right-4 -top-4 opacity-5 transition-opacity group-hover:opacity-10">
                <span className="material-symbols-outlined text-[120px]">verified_user</span>
              </div>
              <div className="flex gap-4">
                <span className="material-symbols-outlined text-[24px] text-[#ff5625]">info</span>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Quy định chi trả</h4>
                  <p className="text-sm leading-relaxed text-[#a0a0a8]">
                    Hoa hồng chỉ được chi trả về tài khoản đã <span className="font-bold text-[#ff5625]">xác minh</span> chính chủ. Việc thay đổi thông tin có thể mất 24h để phê duyệt lại.
                  </p>
                </div>
              </div>
            </div>

            {profile.role === 'dealer' && (
              <div className="rounded-2xl border border-[#3d3f41]/30 bg-[#1e2022] p-6">
                <h4 className="mb-4 text-sm font-semibold">Tổng quan thanh toán</h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between border-b border-[#3d3f41]/20 py-2">
                    <span className="text-xs text-[#e2e2e5]/60">Số dư chờ chi</span>
                    <span className="font-mono text-sm font-bold text-[#00daf3] tabular-nums">{fmtVnd(payout.pending)} ₫</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#3d3f41]/20 py-2">
                    <span className="text-xs text-[#e2e2e5]/60">Tổng đã nhận</span>
                    <span className="font-mono text-sm text-emerald-400 tabular-nums">{fmtVnd(payout.paid)} ₫</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-[#e2e2e5]/60">Lần thanh toán cuối</span>
                    <span className="text-xs text-[#e2e2e5]">{payout.last ? new Date(payout.last).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                </div>
                <Link href="/portal/dealer/commission" className="mt-6 block w-full rounded-lg border border-[#00daf3] py-2 text-center text-xs font-bold uppercase tracking-wider text-[#00daf3] transition-all hover:bg-[#00daf3]/5">
                  Xem sổ hoa hồng
                </Link>
              </div>
            )}
          </div>
        </section>
        <form onSubmit={saveCompliance} className="space-y-4 rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022] p-6 backdrop-blur md:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Hồ sơ doanh nghiệp</h2>
            <span className="text-[11px] text-[#e2e2e5]/40">Phục vụ hợp đồng &amp; pháp lý</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Tên doanh nghiệp / hộ kinh doanh</label>
              <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="VD: Hộ KD Trần Thị A" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Mã số thuế / CCCD</label>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Mã số thuế hoặc CCCD" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none font-mono tabular-nums" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#e2e2e5]/60">Địa chỉ kinh doanh</label>
              <input value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="Địa chỉ" className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] placeholder:text-[#e2e2e5]/40 focus:border-[#ff5625] outline-none" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff5625]/90 disabled:opacity-50">
            Lưu hồ sơ doanh nghiệp
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
