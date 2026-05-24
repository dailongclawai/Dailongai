'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';
import { Spinner } from '@/components/portal/Spinner';
import { BankPicker, type BankInfo } from '@/components/portal/BankPicker';

const LOGO = (code?: string | null) => (code ? `https://cdn.vietqr.io/img/${code}.png` : '');

export default function PayoutInfoPage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();

  const [bankCode, setBankCode] = useState<string>('');
  const [bankName, setBankName] = useState('');
  const [bankShort, setBankShort] = useState('');
  const [bankBin, setBankBin] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role === 'admin') { router.replace('/portal/403'); return; }
    if (profile) {
      setBankName(profile.bank_name ?? '');
      setBankHolder(profile.bank_account_name ?? '');
      setBankNumber(profile.bank_account_number ?? '');
      // Try to derive bankCode + bankShort from stored bank_name (post-migration: stored as shortName)
      fetch('/data/vn-banks.json').then((r) => r.json()).then((list: BankInfo[]) => {
        const found = list.find((b) => b.shortName === profile.bank_name || b.name === profile.bank_name);
        if (found) {
          setBankCode(found.code);
          setBankShort(found.shortName);
          setBankBin(found.bin);
        }
      }).catch(() => undefined);
    }
  }, [loading, session, profile, router]);

  const handleBank = (b: BankInfo) => {
    setBankCode(b.code);
    setBankShort(b.shortName);
    setBankName(b.shortName);
    setBankBin(b.bin);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankShort) { toast.error('Vui lòng chọn ngân hàng'); return; }
    if (!bankHolder.trim()) { toast.error('Vui lòng nhập chủ tài khoản'); return; }
    if (!/^\d{6,20}$/.test(bankNumber.trim())) { toast.error('Số tài khoản không hợp lệ (6–20 chữ số)'); return; }
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({
        bank_name: bankShort,
        bank_account_name: bankHolder.trim().toUpperCase(),
        bank_account_number: bankNumber.trim(),
      })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã lưu thông tin nhận hoa hồng');
    await refresh();
  };

  if (loading || !session || !profile) {
    return (
      <PortalShell variant={profile?.role === 'supervisor' ? 'supervisor' : 'dealer'}>
        <PortalSkeleton.Dashboard />
      </PortalShell>
    );
  }

  const verified = !!(profile.bank_name && profile.bank_account_name && profile.bank_account_number);
  const variant = profile.role === 'supervisor' ? 'supervisor' : 'dealer';

  return (
    <PortalShell variant={variant}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Thanh toán</p>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl">Tài khoản nhận hoa hồng</h1>
        <p className="mt-2 text-sm text-[#9ca3af]">
          Hoa hồng sẽ được chuyển vào tài khoản đã xác minh chính chủ. Đổi thông tin có thể mất 24h duyệt lại.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-[#1f2937] bg-[#11151a] shadow-2xl">
            {verified ? (
              <div className="flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <span className="material-symbols-outlined fill text-[18px]">check_circle</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">Đã xác minh</p>
                    <p className="text-[11px] text-emerald-400/70">Tài khoản sẵn sàng nhận thanh toán hoa hồng.</p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">VERIFIED</span>
              </div>
            ) : (
              <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-400">Chưa hoàn tất</p>
                    <p className="text-[11px] text-amber-400/70">Bổ sung đủ ngân hàng + chủ tài khoản + số tài khoản để nhận hoa hồng.</p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-500/60">PENDING</span>
              </div>
            )}

            <form onSubmit={save} className="space-y-5 p-6 md:p-7">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                  Ngân hàng
                </label>
                <BankPicker value={bankShort} onChange={handleBank} required />
                {bankCode && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#9ca3af]">
                    <span className="material-symbols-outlined text-[12px] text-[#10b981]">verified</span>
                    BIN: <span className="font-mono tabular-nums text-[#e7eaf0]">{bankBin}</span>
                    <span className="mx-1">·</span>
                    Mã: <span className="font-mono tabular-nums text-[#e7eaf0]">{bankCode}</span>
                  </p>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                    Số tài khoản
                  </label>
                  <input
                    value={bankNumber}
                    onChange={(e) => setBankNumber(e.target.value.replace(/\s+/g, ''))}
                    inputMode="numeric"
                    pattern="\d{6,20}"
                    required
                    placeholder="Nhập số tài khoản"
                    className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 font-mono text-sm tabular-nums tracking-wider text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                    Chủ tài khoản
                  </label>
                  <input
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value.toUpperCase())}
                    required
                    placeholder="NGUYEN VAN A"
                    className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 text-sm uppercase tracking-wide text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
                  />
                  <p className="mt-1 text-[10px] text-[#9ca3af]">In hoa, không dấu (như trên thẻ ngân hàng)</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff5625] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#ff5625]/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? <Spinner size={14} /> : <span className="material-symbols-outlined text-[16px]">save</span>}
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-1">
          {verified && bankCode && (
            <div className="overflow-hidden rounded-2xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.06] to-[#11151a]">
              <div className="border-b border-[#10b981]/20 bg-[#10b981]/[0.04] px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#10b981]">
                  Thẻ xác minh
                </p>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={LOGO(bankCode)}
                    alt={bankShort}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg bg-white object-contain p-1"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#e7eaf0]">{bankShort}</p>
                    <p className="font-mono text-[10px] tabular-nums text-[#9ca3af]">BIN {bankBin}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-[#1f2937] bg-[#0a0c0f] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Số tài khoản</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-wider text-[#e7eaf0]">
                    {profile.bank_account_number}
                  </p>
                </div>
                <div className="rounded-lg border border-[#1f2937] bg-[#0a0c0f] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Chủ tài khoản</p>
                  <p className="mt-0.5 text-sm font-semibold uppercase tracking-wide text-[#e7eaf0]">
                    {profile.bank_account_name}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </PortalShell>
  );
}
