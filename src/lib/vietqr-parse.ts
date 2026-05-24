// Parse a VietQR (NAPAS 247 / EMVCo TLV) payload into bank BIN + account number.
//
// Format (relevant slices):
//   38 = Merchant Account Information (TLV container)
//     00 = GUID  "A000000727"
//     01 = Member info (TLV container)
//       00 = Acquirer BIN  (e.g. "970416" = ACB)
//       01 = Merchant account number
//
// Returns null if the payload is not a recognisable VietQR.

export interface ParsedVietQR {
  bin: string;
  accountNumber: string;
  rawPayload: string;
}

function parseTLV(payload: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < payload.length - 4) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len) || len < 0) break;
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length < len) break;
    out.set(tag, value);
    i += 4 + len;
  }
  return out;
}

export function parseVietQR(payload: string): ParsedVietQR | null {
  if (!payload || !payload.startsWith('00020')) return null;
  const top = parseTLV(payload);
  const merchant = top.get('38');
  if (!merchant) return null;
  const merchantTLV = parseTLV(merchant);
  if (merchantTLV.get('00') !== 'A000000727') return null;
  const memberInfo = merchantTLV.get('01');
  if (!memberInfo) return null;
  const member = parseTLV(memberInfo);
  const bin = member.get('00');
  const accountNumber = member.get('01');
  if (!bin || !accountNumber) return null;
  return { bin, accountNumber, rawPayload: payload };
}
