// Đại Long company bank — set via Cloudflare Pages env (production scope).
// Three vars must be set for VietQR payment widget to render:
//   NEXT_PUBLIC_PAYMENT_BANK_CODE  e.g. TCB, MB, VCB, ACB, BIDV
//   NEXT_PUBLIC_PAYMENT_ACCOUNT    bank account number
//   NEXT_PUBLIC_PAYMENT_NAME       holder name (UPPERCASE, no diacritics)

export const PAYMENT_BANK_CODE = process.env.NEXT_PUBLIC_PAYMENT_BANK_CODE ?? '';
export const PAYMENT_ACCOUNT = process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT ?? '';
export const PAYMENT_NAME = process.env.NEXT_PUBLIC_PAYMENT_NAME ?? '';
export const PAYMENT_ENABLED = !!(PAYMENT_BANK_CODE && PAYMENT_ACCOUNT && PAYMENT_NAME);

export function orderMemo(orderId: string): string {
  return `DL${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function vietqrUrl(amount: number, memo: string): string {
  return `https://img.vietqr.io/image/${PAYMENT_BANK_CODE}-${PAYMENT_ACCOUNT}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(PAYMENT_NAME)}`;
}
