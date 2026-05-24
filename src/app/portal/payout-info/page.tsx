'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import jsQR from 'jsqr';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';
import { Spinner } from '@/components/portal/Spinner';
import { BankPicker, type BankInfo } from '@/components/portal/BankPicker';
import { parseVietQR } from '@/lib/vietqr-parse';

const LOGO = (code?: string | null) => (code ? `https://cdn.vietqr.io/img/${code}.png` : '');
const MAX_QR_BYTES = 2 * 1024 * 1024;

type WizardStep = 'upload' | 'form' | 'otp';

async function decodeQrFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_load_failed'));
      el.src = url;
    });
    const max = 1024;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const result = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
    return result?.data ?? null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PayoutInfoPage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const { t } = useI18n();

  const [step, setStep] = useState<WizardStep>('upload');

  // Form state (filled from QR or manual)
  const [bankCode, setBankCode] = useState('');
  const [bankShort, setBankShort] = useState('');
  const [bankBin, setBankBin] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [zaloPhone, setZaloPhone] = useState('');

  // QR / OTP state
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string>('');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [delivered, setDelivered] = useState<'zalo' | 'telegram_fallback' | null>(null);

  const [banks, setBanks] = useState<BankInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/data/vn-banks.json').then((r) => r.json()).then(setBanks).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role === 'admin') { router.replace('/portal/403'); return; }
  }, [loading, session, profile, router]);

  // Reset preview URL on file change
  useEffect(() => {
    if (!qrFile) { setQrPreview(''); return; }
    const url = URL.createObjectURL(qrFile);
    setQrPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  const handleBank = (b: BankInfo) => {
    setBankCode(b.code);
    setBankShort(b.shortName);
    setBankBin(b.bin);
  };

  const resetWizard = () => {
    setStep('upload');
    setQrFile(null);
    setDecodeError('');
    setOtpId(null);
    setOtpCode('');
    setDelivered(null);
  };

  const onPickQr = async (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > MAX_QR_BYTES) {
      toast.error(t('portal.payout.toast.qr_too_large'));
      return;
    }
    setQrFile(file);
    setDecoding(true);
    setDecodeError('');
    try {
      const payload = await decodeQrFromFile(file);
      if (!payload) {
        setDecodeError(t('portal.payout.step1_failed'));
        return;
      }
      const parsed = parseVietQR(payload);
      if (!parsed) {
        setDecodeError(t('portal.payout.step1_not_vietqr'));
        return;
      }
      // Match BIN to bank list
      const match = banks.find((b) => b.bin === parsed.bin);
      if (match) {
        setBankCode(match.code);
        setBankShort(match.shortName);
        setBankBin(match.bin);
      } else {
        setBankCode('');
        setBankShort('');
        setBankBin(parsed.bin);
        setDecodeError(t('portal.payout.step1_bin_unknown').replace('{bin}', parsed.bin));
      }
      setBankNumber(parsed.accountNumber);
      // QR does NOT contain holder name → always clear stale value, dealer types it fresh.
      setBankHolder('');
      if (!zaloPhone && profile?.zalo_phone) setZaloPhone(profile.zalo_phone);
      setStep('form');
    } catch {
      setDecodeError(t('portal.payout.step1_failed'));
    } finally {
      setDecoding(false);
    }
  };

  const requestOtp = async () => {
    if (!bankShort) { toast.error(t('portal.payout.toast.choose_bank')); return; }
    if (!bankHolder.trim()) { toast.error(t('portal.payout.toast.holder_required')); return; }
    if (!/^\d{6,20}$/.test(bankNumber.trim())) { toast.error(t('portal.payout.toast.account_invalid')); return; }
    if (!/^0\d{9}$/.test(zaloPhone.trim())) { toast.error(t('portal.payout.toast.zalo_phone_invalid')); return; }

    setBusy(true);
    const sb = getSupabaseClient();

    // 1. Upload QR to Storage (user-id-scoped folder)
    let qrPath: string | null = null;
    if (qrFile) {
      const ext = qrFile.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `${session!.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('dealer-payout-qr').upload(path, qrFile, {
        cacheControl: '3600', upsert: false, contentType: qrFile.type,
      });
      if (upErr) {
        setBusy(false);
        toast.error(upErr.message);
        return;
      }
      qrPath = path;
    }

    // 2. Request OTP via RPC
    const { data: otpUuid, error: rpcErr } = await sb.rpc('request_payout_otp', {
      p_phone: zaloPhone.trim(),
      p_bank_short: bankShort,
      p_bank_account: bankNumber.trim(),
      p_bank_holder: bankHolder.trim().toUpperCase(),
      p_qr_path: qrPath,
    });
    if (rpcErr) {
      setBusy(false);
      const msg = rpcErr.message ?? '';
      if (msg.includes('rate_limited')) toast.error(t('portal.payout.toast.rate_limited'));
      else if (msg.includes('phone_invalid')) toast.error(t('portal.payout.toast.zalo_phone_invalid'));
      else if (msg.includes('account_invalid')) toast.error(t('portal.payout.toast.account_invalid'));
      else if (msg.includes('holder_required')) toast.error(t('portal.payout.toast.holder_required'));
      else if (msg.includes('bank_required')) toast.error(t('portal.payout.toast.choose_bank'));
      else toast.error(msg);
      return;
    }

    // 3. Trigger edge function to deliver OTP via Zalo
    const { data: sendRes, error: sendErr } = await sb.functions.invoke('send-payout-otp', {
      body: { otp_id: otpUuid },
    });
    setBusy(false);
    if (sendErr) {
      toast.error(sendErr.message);
      return;
    }
    setDelivered((sendRes as { delivered?: 'zalo' | 'telegram_fallback' })?.delivered ?? null);
    setOtpId(otpUuid as string);
    setStep('otp');
    toast.success(t('portal.payout.toast.otp_sent'));
  };

  const verifyOtp = async () => {
    if (!otpId || !/^\d{6}$/.test(otpCode.trim())) {
      toast.error(t('portal.payout.toast.otp_mismatch'));
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('verify_payout_otp', {
      p_otp_id: otpId, p_code: otpCode.trim(),
    });
    setBusy(false);
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('otp_mismatch')) toast.error(t('portal.payout.toast.otp_mismatch'));
      else if (msg.includes('otp_expired')) toast.error(t('portal.payout.toast.otp_expired'));
      else if (msg.includes('otp_locked')) toast.error(t('portal.payout.toast.otp_locked'));
      else toast.error(msg);
      return;
    }
    toast.success(t('portal.payout.toast.otp_verified'));
    await refresh();
    resetWizard();
  };

  if (loading || !session || !profile) {
    return (
      <PortalShell variant={profile?.role === 'supervisor' ? 'supervisor' : 'dealer'}>
        <PortalSkeleton.Dashboard />
      </PortalShell>
    );
  }

  const verified = !!profile.payout_verified_at
    || !!(profile.bank_name && profile.bank_account_name && profile.bank_account_number);
  const variant = profile.role === 'supervisor' ? 'supervisor' : 'dealer';
  const currentBankCode = bankCode || (banks.find((b) => b.shortName === profile.bank_name)?.code ?? '');
  const currentBankBin = bankBin || (banks.find((b) => b.shortName === profile.bank_name)?.bin ?? '');

  return (
    <PortalShell variant={variant}>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.payout.eyebrow')}</p>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl">{t('portal.payout.title')}</h1>
        <p className="mt-2 text-sm text-[#9ca3af]">{t('portal.payout.subtitle_v2')}</p>
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
                    <p className="text-sm font-semibold text-emerald-400">{t('portal.payout.status.verified_title')}</p>
                    <p className="text-[11px] text-emerald-400/70">{t('portal.payout.status.verified_desc')}</p>
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
                    <p className="text-sm font-semibold text-amber-400">{t('portal.payout.status.pending_title')}</p>
                    <p className="text-[11px] text-amber-400/70">{t('portal.payout.status.pending_desc')}</p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-500/60">PENDING</span>
              </div>
            )}

            <div className="space-y-5 p-6 md:p-7">
                {/* Step indicator */}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#9ca3af]/70">
                  {(['upload', 'form', 'otp'] as WizardStep[]).map((s, i) => {
                    const active = s === step;
                    const done = (['upload', 'form', 'otp'] as WizardStep[]).indexOf(step) > i;
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          active ? 'bg-[#ff5625] text-white'
                          : done ? 'bg-emerald-500/20 text-emerald-400'
                          : 'border border-[#1f2937] text-[#9ca3af]/50'
                        }`}>{done ? '✓' : i + 1}</span>
                        <span className={active ? 'text-[#e7eaf0]' : ''}>
                          {s === 'upload' ? 'QR' : s === 'form' ? 'Info' : 'OTP'}
                        </span>
                        {i < 2 && <span className="w-6 h-px bg-[#1f2937]" />}
                      </div>
                    );
                  })}
                  {step !== 'upload' && (
                    <button
                      type="button"
                      onClick={resetWizard}
                      className="ml-auto text-[#9ca3af] underline-offset-4 hover:text-[#ff5625] hover:underline"
                    >
                      {t('portal.payout.upgrade_cancel')}
                    </button>
                  )}
                </div>

                {step === 'upload' && (
                  <div>
                    <h3 className="text-base font-semibold text-[#e7eaf0]">{t('portal.payout.step1_title')}</h3>
                    <p className="mt-1 text-sm text-[#9ca3af]">{t('portal.payout.step1_desc')}</p>
                    <label
                      htmlFor="qr-upload"
                      className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#1f2937] bg-[#0a0c0f]/60 px-6 py-8 transition-colors hover:border-[#ff5625]/40 hover:bg-[#ff5625]/[0.04]"
                    >
                      {qrPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrPreview} alt="" className="h-32 w-32 rounded-lg object-contain" />
                      ) : (
                        <span className="material-symbols-outlined text-[40px] text-[#9ca3af]/50">qr_code_2</span>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#e7eaf0]">{t('portal.payout.step1_choose')}</p>
                        <p className="text-[11px] text-[#9ca3af]">{t('portal.payout.step1_drag')}</p>
                        <p className="mt-1 text-[10px] text-[#9ca3af]/60">{t('portal.payout.step1_format')}</p>
                      </div>
                      <input
                        id="qr-upload"
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => onPickQr(e.target.files?.[0])}
                      />
                    </label>
                    {decoding && (
                      <p className="mt-3 flex items-center gap-2 text-sm text-[#ff5625]">
                        <Spinner size={14} /> {t('portal.payout.step1_decoding')}
                      </p>
                    )}
                    {decodeError && !decoding && (
                      <p className="mt-3 flex items-start gap-2 text-sm text-amber-400">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        <span>{decodeError}</span>
                      </p>
                    )}
                  </div>
                )}

                {step === 'form' && (
                  <div className="space-y-5">
                    <h3 className="text-base font-semibold text-[#e7eaf0]">{t('portal.payout.step2_title')}</h3>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                        {t('portal.payout.label.bank')}
                      </label>
                      <BankPicker value={bankShort} onChange={handleBank} required />
                      {bankCode && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#9ca3af]">
                          <span className="material-symbols-outlined text-[12px] text-[#10b981]">verified</span>
                          BIN: <span className="font-mono tabular-nums text-[#e7eaf0]">{bankBin}</span>
                          <span className="mx-1">·</span>
                          {t('portal.payout.label.code')}: <span className="font-mono tabular-nums text-[#e7eaf0]">{bankCode}</span>
                        </p>
                      )}
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                          {t('portal.payout.label.account_number')}
                        </label>
                        <input
                          value={bankNumber}
                          onChange={(e) => setBankNumber(e.target.value.replace(/\s+/g, ''))}
                          inputMode="numeric"
                          pattern="\d{6,20}"
                          required
                          placeholder={t('portal.payout.placeholder.account_number')}
                          className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 font-mono text-sm tabular-nums tracking-wider text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                          {t('portal.payout.label.account_holder')}
                        </label>
                        <input
                          value={bankHolder}
                          onChange={(e) => setBankHolder(e.target.value.toUpperCase())}
                          required
                          placeholder="NGUYEN VAN A"
                          className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 text-sm uppercase tracking-wide text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
                        />
                        <p className="mt-1 text-[10px] text-[#9ca3af]">{t('portal.payout.hint.holder_format')}</p>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                        {t('portal.payout.step2_zalo_label')}
                      </label>
                      <input
                        value={zaloPhone}
                        onChange={(e) => setZaloPhone(e.target.value.replace(/\D+/g, '').slice(0, 10))}
                        inputMode="numeric"
                        pattern="0\d{9}"
                        required
                        placeholder={t('portal.payout.step2_zalo_placeholder')}
                        className="w-full rounded-lg border border-[#1f2937] bg-[#0a0c0f] px-3 py-2.5 font-mono text-sm tabular-nums tracking-wider text-[#e7eaf0] placeholder:text-[#9ca3af] outline-none focus:border-[#ff5625]"
                      />
                      <p className="mt-1 text-[10px] text-[#9ca3af]">{t('portal.payout.step2_zalo_hint')}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setStep('upload')}
                        className="text-sm text-[#9ca3af] underline-offset-4 hover:text-[#ff5625] hover:underline"
                      >
                        ← {t('portal.payout.step1_title')}
                      </button>
                      <button
                        type="button"
                        onClick={requestOtp}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff5625] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#ff5625]/90 active:scale-[0.98] disabled:opacity-50"
                      >
                        {busy ? <Spinner size={14} /> : <span className="material-symbols-outlined text-[16px]">sms</span>}
                        {busy ? t('portal.payout.step2_sending') : t('portal.payout.step2_send_otp')}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'otp' && (
                  <div className="space-y-5">
                    <h3 className="text-base font-semibold text-[#e7eaf0]">{t('portal.payout.step3_title')}</h3>
                    <p className="text-sm text-[#9ca3af]">
                      {t('portal.payout.step3_desc').replace('{phone}', zaloPhone)}
                    </p>
                    {delivered === 'telegram_fallback' && (
                      <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        <span>{t('portal.payout.step3_fallback_note')}</span>
                      </p>
                    )}
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoFocus
                      placeholder={t('portal.payout.step3_placeholder')}
                      className="w-full rounded-xl border border-[#1f2937] bg-[#0a0c0f] px-4 py-4 text-center font-mono text-3xl font-bold tabular-nums tracking-[0.5em] text-[#e7eaf0] placeholder:text-[#9ca3af]/40 outline-none focus:border-[#ff5625]"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep('form')}
                        className="text-sm text-[#9ca3af] underline-offset-4 hover:text-[#ff5625] hover:underline"
                      >
                        {t('portal.payout.step3_back')}
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={requestOtp}
                          disabled={busy}
                          className="text-sm text-[#9ca3af] underline-offset-4 hover:text-[#ff5625] hover:underline disabled:opacity-40"
                        >
                          {t('portal.payout.step3_resend')}
                        </button>
                        <button
                          type="button"
                          onClick={verifyOtp}
                          disabled={busy || otpCode.length !== 6}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500/90 active:scale-[0.98] disabled:opacity-50"
                        >
                          {busy ? <Spinner size={14} /> : <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                          {busy ? t('portal.payout.step3_verifying') : t('portal.payout.step3_confirm')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-1">
          {verified && currentBankCode && (
            <div className="overflow-hidden rounded-2xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.06] to-[#11151a]">
              <div className="border-b border-[#10b981]/20 bg-[#10b981]/[0.04] px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#10b981]">
                  {t('portal.payout.verify_card.title')}
                </p>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={LOGO(currentBankCode)}
                    alt={profile.bank_name ?? ''}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg bg-white object-contain p-1"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#e7eaf0]">{profile.bank_name}</p>
                    {currentBankBin && <p className="font-mono text-[10px] tabular-nums text-[#9ca3af]">BIN {currentBankBin}</p>}
                  </div>
                </div>
                <div className="rounded-lg border border-[#1f2937] bg-[#0a0c0f] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.payout.label.account_number')}</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-wider text-[#e7eaf0]">
                    {profile.bank_account_number}
                  </p>
                </div>
                <div className="rounded-lg border border-[#1f2937] bg-[#0a0c0f] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.payout.label.account_holder')}</p>
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
