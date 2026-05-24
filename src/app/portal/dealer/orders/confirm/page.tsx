'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();
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
    else if (profile && profile.role !== 'dealer') router.replace('/portal/403');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant="dealer">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#10b981]/15">
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
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">{t('portal.dealer.orders.confirm_eyebrow')}</p>
          <h1 className="mt-2 font-headline text-3xl">
            {t('portal.dealer.orders.confirm_title')}
          </h1>
          <p className="mt-2 text-sm text-[#e7eaf0]/60">
            {count} {t('portal.dealer.orders.units_word')} · {t('portal.dealer.orders.total_word')}{' '}
            <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">
              {fmtVnd(total)} đ
            </span>
          </p>
        </div>

        {/* 2-col: instructions + QR */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: payment details */}
          <div className="rounded-2xl border border-[#ff5625]/30 bg-[#ff5625]/5 p-6">
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">
              {t('portal.dealer.orders.pay_now')}
            </p>
            <p className="mb-5 text-sm text-[#e7eaf0]/60">
              {t('portal.dealer.orders.pay_instructions')}
            </p>
            <div className="space-y-0 divide-y divide-[#3d3f41]/30 text-sm">
              <div className="flex justify-between py-3">
                <span className="text-[#e7eaf0]/50">{t('portal.dealer.orders.bank')}</span>
                <span className="font-medium">{BANK_NAME}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[#e7eaf0]/50">{t('portal.dealer.orders.account_number')}</span>
                <span className="font-mono font-semibold tracking-wider tabular-nums">
                  {BANK_ACCOUNT}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <span className="shrink-0 text-[#e7eaf0]/50">{t('portal.dealer.orders.account_holder')}</span>
                <span className="text-right text-xs font-medium leading-relaxed">{BANK_OWNER}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[#e7eaf0]/50">{t('portal.dealer.orders.amount')}</span>
                <span className="font-mono font-semibold tabular-nums text-[#ff5625]">
                  {fmtVnd(total)} đ
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#1a1f26]/40 px-3 py-3">
                <span className="text-[#e7eaf0]/50">{t('portal.dealer.orders.transfer_memo')}</span>
                <span className="font-mono font-bold tracking-widest tabular-nums text-[#e7eaf0]">
                  {note}
                </span>
              </div>
            </div>
            <Link
              href="/portal/dashboard"
              className="mt-6 block text-center text-xs text-[#e7eaf0]/40 hover:text-[#ff5625]"
            >
              {t('portal.dealer.orders.back_to_dashboard')}
            </Link>
          </div>

          {/* Right: VietQR */}
          <div className="flex flex-col items-center rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6">
            <p className="mb-5 text-[11px] uppercase tracking-[0.3em] text-[#e7eaf0]/50">
              {t('portal.dealer.orders.bank_qr_title')}
            </p>
            {total > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vietqrUrl(total, note)}
                alt={t('portal.dealer.orders.qr_alt')}
                className="w-full max-w-[300px] rounded-xl"
              />
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-xl bg-[#1a1f26]/40" />
            )}
            <p className="mt-5 text-center text-xs text-[#e7eaf0]/40">
              {t('portal.dealer.orders.qr_steps')}
            </p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
