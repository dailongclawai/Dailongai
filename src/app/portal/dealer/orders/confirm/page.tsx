'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

const BANK_BIN = '970407';
const BANK_ACCOUNT = '6889989898';
const BANK_OWNER = 'CTY TNHH CONG NGHE VA Y TE DAI LONG';
const BANK_NAME = 'Techcombank';

function vietqrUrl(amount: number, info: string) {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: info,
    accountName: BANK_OWNER,
  });
  return `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-compact2.png?${params}`;
}

export default function OrderConfirmPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setCount(Number(p.get('count') ?? 0));
    setTotal(Number(p.get('total') ?? 0));
    const date = p.get('date') ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setNote(`DAILONG ${date}`);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile && profile.role !== 'dealer') router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant="dealer">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#34d399]/15">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#34d399]">Đặt hàng thành công</p>
          <h1 className="mt-2 font-headline text-3xl">
            Chờ admin duyệt đơn
          </h1>
          <p className="mt-2 text-sm text-[#fadcd5]/60">
            {count} máy · tổng giá trị{' '}
            <span className="font-mono font-semibold tabular-nums text-[#fadcd5]">
              {fmtVnd(total)} đ
            </span>
          </p>
        </div>

        {/* 2-col: instructions + QR */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: payment details */}
          <div className="rounded-2xl border border-[#ffb5a1]/30 bg-[#ff5626]/5 p-6">
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">
              Thanh toán ngay
            </p>
            <p className="mb-5 text-sm text-[#fadcd5]/60">
              Chuyển khoản đúng số tiền và ghi rõ nội dung để đơn được xử lý nhanh nhất.
            </p>
            <div className="space-y-0 divide-y divide-[#5b4039]/30 text-sm">
              <div className="flex justify-between py-3">
                <span className="text-[#fadcd5]/50">Ngân hàng</span>
                <span className="font-medium">{BANK_NAME}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[#fadcd5]/50">Số tài khoản</span>
                <span className="font-mono font-semibold tracking-wider tabular-nums">
                  {BANK_ACCOUNT}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <span className="shrink-0 text-[#fadcd5]/50">Chủ tài khoản</span>
                <span className="text-right text-xs font-medium leading-relaxed">{BANK_OWNER}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[#fadcd5]/50">Số tiền</span>
                <span className="font-mono font-semibold tabular-nums text-[#ffb5a1]">
                  {fmtVnd(total)} đ
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#372621]/40 px-3 py-3">
                <span className="text-[#fadcd5]/50">Nội dung CK</span>
                <span className="font-mono font-bold tracking-widest tabular-nums text-[#fadcd5]">
                  {note}
                </span>
              </div>
            </div>
            <Link
              href="/portal/dashboard"
              className="mt-6 block text-center text-xs text-[#fadcd5]/40 hover:text-[#ffb5a1]"
            >
              ← Về dashboard
            </Link>
          </div>

          {/* Right: VietQR */}
          <div className="flex flex-col items-center rounded-2xl border border-[#5b4039]/40 bg-[#2c1c17] p-6">
            <p className="mb-5 text-[11px] uppercase tracking-[0.3em] text-[#fadcd5]/50">
              Đại Long Bank QR
            </p>
            {total > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vietqrUrl(total, note)}
                alt="QR thanh toán Đại Long"
                className="w-full max-w-[300px] rounded-xl"
              />
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-xl bg-[#372621]/40" />
            )}
            <p className="mt-5 text-center text-xs text-[#fadcd5]/40">
              Mở app ngân hàng → Quét mã → Kiểm tra thông tin → Thanh toán
            </p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
