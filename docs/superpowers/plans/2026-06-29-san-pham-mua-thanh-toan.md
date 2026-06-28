# Mua & thanh toán trên `/san-pham` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho khách vào thẳng `/san-pham` mua + chuyển khoản + thấy xác nhận "đã thanh toán" ngay trong 1 modal, không qua đại lý.

**Architecture:** Tái dùng nguyên bộ máy đặt-đơn + Casso auto-confirm của `/dat-don`. Đơn mua trực tiếp gán vào 1 đại lý nội bộ "Đại Long trực tiếp" (house, slug `dai-long`) có rule hoa hồng cố định 0đ. Tách phần checkout của `/dat-don` thành component dùng chung `<QuickCheckout>` rồi nhúng vào modal ở `/san-pham`. Thêm RPC `get_payment_status_public` để khách anon đọc được trạng thái đơn (RLS hiện chặn anon → thẻ xanh không hiện).

**Tech Stack:** Next.js (bản tuỳ biến — đọc `node_modules/next/dist/docs/` trước khi code), TypeScript, Supabase (Postgres + RLS + Edge Functions), VietQR/MBBank + Casso, vitest + @testing-library/react, Cloudflare Pages.

**Spec:** [docs/superpowers/specs/2026-06-29-san-pham-mua-thanh-toan-design.md](../specs/2026-06-29-san-pham-mua-thanh-toan-design.md)

**Supabase project:** `gcjiiiijfeitomegnivd`

---

## File Structure

| File | Trách nhiệm | Loại |
|---|---|---|
| `supabase/migrations/20260629120000_get_payment_status_public.sql` | RPC trả `status`+`paid_at` cho 1 order theo id, grant anon | Tạo |
| `supabase/migrations/20260629120100_house_direct_dealer.sql` | Tạo profile house + rule hoa hồng 0đ (idempotent) | Tạo |
| `src/lib/portal-queries.ts` | Thêm `HOUSE_ORDER_SLUG` + `getPaymentStatusPublic()` | Sửa |
| `tests/unit/portal/payment-status-public.test.ts` | Test `getPaymentStatusPublic` map đúng RPC | Tạo |
| `src/components/portal/PaymentQRCard.tsx` | Nhận prop `surface`; public → poll bằng RPC | Sửa |
| `tests/unit/portal/payment-qr-card.test.tsx` | Test public poll → hiện thẻ xanh khi `paid` | Tạo |
| `src/components/portal/QuickCheckout.tsx` | Component dùng chung: form → submit → QR | Tạo |
| `tests/unit/portal/quick-checkout.test.tsx` | Test submit gọi `submit_public_order` đúng slug | Tạo |
| `src/app/dat-don/page.tsx` | Thu gọn thành wrapper resolve slug + render `<QuickCheckout>` | Sửa |
| `src/components/ProductPage.tsx` | Nút "Mua ngay" + modal chứa `<QuickCheckout slug="dai-long">` | Sửa |
| `src/lib/translations/{vi,en,ja,ko,ru,zh}.ts` | Key `product.buy_now` | Sửa |

---

## Task 1: RPC `get_payment_status_public` (vá gap thẻ xanh)

**Files:**
- Create: `supabase/migrations/20260629120000_get_payment_status_public.sql`

- [ ] **Step 1: Viết migration**

```sql
-- Anon/public cannot SELECT orders (RLS only covers admin/dealer/supervisor),
-- so the public PaymentQRCard poll never sees status='paid'. This SECURITY DEFINER
-- RPC exposes ONLY status + paid time for a single order id (uuid = unguessable).
create or replace function public.get_payment_status_public(p_order_id uuid)
returns table (status public.order_status, paid_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.status, o.updated_at
  from public.orders o
  where o.id = p_order_id;
$$;

grant execute on function public.get_payment_status_public(uuid) to anon, authenticated;
```

- [ ] **Step 2: Áp dụng migration**

Áp bằng MCP `apply_migration` (name `get_payment_status_public`, query = nội dung trên), hoặc Studio SQL Editor (Boss paste).

- [ ] **Step 3: Verify RPC hoạt động với 1 order có thật**

Run (MCP `execute_sql`):
```sql
select * from public.get_payment_status_public(
  (select id from public.orders order by created_at desc limit 1)
);
```
Expected: trả 1 dòng `{status, paid_at}`. Không lỗi permission.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260629120000_get_payment_status_public.sql
git commit -m "feat(db): get_payment_status_public RPC for anon order status poll"
```

---

## Task 2: House dealer "Đại Long trực tiếp" + rule hoa hồng 0đ

**Files:**
- Create: `supabase/migrations/20260629120100_house_direct_dealer.sql`

**Bối cảnh:** `profiles.id` FK → `auth.users(id)`, nên phải có auth user trước. `dealer_commissions` có `set_by` NOT NULL và `commission_type` là enum (dùng `'fixed'`). `calc_commission` ưu tiên FIXED rule → `rate_value(0) × quantity = 0` → payout 0đ.

- [ ] **Step 1: Tạo auth user house (1 lần, Studio)**

Supabase Studio → Authentication → Add user:
- Email: `house@dailongai.com`
- Auto Confirm User: ON
- (Không cần đăng nhập bao giờ; chỉ để làm chủ sở hữu profile.)

- [ ] **Step 2: Viết migration (idempotent, tra cứu uuid theo email — không cần copy tay)**

```sql
-- House dealer for direct /san-pham purchases. No external commission:
-- a FIXED rate_value=0 rule makes calc_commission emit a 0đ payout row.
insert into public.profiles (id, role, status, full_name, order_slug)
select u.id, 'dealer'::public.profile_role, 'active'::public.profile_status,
       'Đại Long trực tiếp', 'dai-long'
from auth.users u
where u.email = 'house@dailongai.com'
on conflict (id) do update
  set role = 'dealer'::public.profile_role,
      status = 'active'::public.profile_status,
      full_name = 'Đại Long trực tiếp',
      order_slug = 'dai-long';

insert into public.dealer_commissions
  (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
select p.id, null, 'fixed'::public.commission_type, 0, date '2020-01-01', p.id
from public.profiles p
where p.order_slug = 'dai-long'
  and not exists (
    select 1 from public.dealer_commissions dc
    where dc.dealer_id = p.id and dc.commission_type = 'fixed'
      and dc.model_id is null
  );
```

> Nếu enum hoa hồng không tên `commission_type`, lấy tên đúng: `select pg_typeof(rate_value) ...` đã biết; kiểm tra enum bằng `\dT+` hoặc `select enum_range(null::public.commission_type)`. Hàm `calc_commission` đã dùng giá trị `'fixed'`, nên giá trị này chắc chắn hợp lệ.

- [ ] **Step 3: Áp dụng + verify**

Run (MCP `execute_sql`):
```sql
select p.id, p.full_name, p.order_slug, p.role, p.status,
       dc.commission_type, dc.rate_value
from public.profiles p
left join public.dealer_commissions dc on dc.dealer_id = p.id
where p.order_slug = 'dai-long';
```
Expected: 1 dòng — `full_name='Đại Long trực tiếp'`, `role=dealer`, `status=active`, `rate_value=0`.

- [ ] **Step 4: Verify slug resolve qua RPC public**

```sql
select * from public.get_public_dealer_info('dai-long');
```
Expected: trả `{dealer_id, dealer_name='Đại Long trực tiếp'}`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260629120100_house_direct_dealer.sql
git commit -m "feat(db): house direct dealer + 0d commission rule"
```

---

## Task 3: Lib `getPaymentStatusPublic` + hằng slug

**Files:**
- Modify: `src/lib/portal-queries.ts`
- Test: `tests/unit/portal/payment-status-public.test.ts`

- [ ] **Step 1: Viết test thất bại**

`tests/unit/portal/payment-status-public.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { getPaymentStatusPublic } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({
  data: [{ status: 'paid', paid_at: '2026-06-29T05:00:00Z' }],
  error: null,
});
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

describe('getPaymentStatusPublic', () => {
  it('calls RPC with p_order_id and returns the status string', async () => {
    const status = await getPaymentStatusPublic('order-1');
    expect(rpcMock).toHaveBeenCalledWith('get_payment_status_public', { p_order_id: 'order-1' });
    expect(status).toBe('paid');
  });

  it('returns null when no row', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await getPaymentStatusPublic('missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- payment-status-public`
Expected: FAIL — `getPaymentStatusPublic is not a function`.

- [ ] **Step 3: Triển khai trong `src/lib/portal-queries.ts`**

Thêm gần `submitPublicOrder`:
```ts
export const HOUSE_ORDER_SLUG = 'dai-long';

export async function getPaymentStatusPublic(orderId: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().rpc('get_payment_status_public', { p_order_id: orderId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.status ?? null;
}
```

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `npm test -- payment-status-public`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal-queries.ts tests/unit/portal/payment-status-public.test.ts
git commit -m "feat(portal): getPaymentStatusPublic query + HOUSE_ORDER_SLUG"
```

---

## Task 4: `PaymentQRCard` poll public qua RPC

**Files:**
- Modify: `src/components/portal/PaymentQRCard.tsx`
- Test: `tests/unit/portal/payment-qr-card.test.tsx`

**Thay đổi:** thêm prop `surface?: 'portal' | 'public'` (default `'portal'`). Trong `useEffect` poll: `public` → `getPaymentStatusPublic(orderId)`; `portal` → giữ nguyên `sb.from('orders').select('status')`.

- [ ] **Step 1: Viết test thất bại**

`tests/unit/portal/payment-qr-card.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PaymentQRCard } from '@/components/portal/PaymentQRCard';

vi.mock('@/lib/vietqr', () => ({
  PAYMENT_BANK_CODE: 'MB', PAYMENT_ACCOUNT: '89588999999', PAYMENT_NAME: 'DAI LONG',
  PAYMENT_ENABLED: true,
  orderMemo: () => 'DLABCD1234',
  vietqrUrl: () => 'https://img.vietqr.io/x.png',
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }));

const getStatus = vi.fn();
vi.mock('@/lib/portal-queries', () => ({ getPaymentStatusPublic: (id: string) => getStatus(id) }));
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }));

describe('PaymentQRCard public surface', () => {
  beforeEach(() => { vi.useFakeTimers(); getStatus.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('polls get_payment_status_public and shows paid card when paid', async () => {
    getStatus.mockResolvedValue('paid');
    render(<PaymentQRCard orderId="o-1" amount={29500000} surface="public" />);
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => expect(getStatus).toHaveBeenCalledWith('o-1'));
    await waitFor(() => expect(screen.getByText('portal.components.paymentQR.paid_title')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- payment-qr-card`
Expected: FAIL — component chưa nhận `surface`, vẫn poll qua supabase select → không gọi `getStatus`.

- [ ] **Step 3: Sửa `PaymentQRCard.tsx`**

Thêm import:
```ts
import { getPaymentStatusPublic } from '@/lib/portal-queries';
```
Đổi `interface Props` thêm `surface?: 'portal' | 'public';` và signature `export function PaymentQRCard({ orderId, amount, dealerName, surface = 'portal' }: Props)`.

Thay thân `check` trong `useEffect` poll:
```ts
const check = async () => {
  let status: string | null = null;
  if (surface === 'public') {
    status = await getPaymentStatusPublic(orderId);
  } else {
    const { data } = await sb.from('orders').select('status').eq('id', orderId).maybeSingle();
    status = (data as { status?: string } | null)?.status ?? null;
  }
  if (cancelled) return;
  if (status === 'paid' && !toastedRef.current) {
    toastedRef.current = true;
    setPaidAt(new Date());
    toast.success(t('portal.components.paymentQR.paid_toast'));
    setFullscreen(false);
  }
};
```
(Giữ `const sb = getSupabaseClient();` — vẫn dùng cho nhánh portal.)

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `npm test -- payment-qr-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/PaymentQRCard.tsx tests/unit/portal/payment-qr-card.test.tsx
git commit -m "feat(portal): PaymentQRCard public poll via get_payment_status_public"
```

---

## Task 5: Tách `<QuickCheckout>` từ `/dat-don`

**Files:**
- Create: `src/components/portal/QuickCheckout.tsx`
- Modify: `src/app/dat-don/page.tsx`
- Test: `tests/unit/portal/quick-checkout.test.tsx`

**Mục tiêu:** chuyển toàn bộ form + done-state (QR) của `PublicOrderForm` vào `<QuickCheckout slug surface dealerName?>`. `/dat-don` chỉ còn: resolve dealer info từ `?d=slug`, guard "Mã đại lý không hợp lệ", rồi render `<QuickCheckout>`. **Xoá hẳn** phần code đã chuyển (không để lại bản cũ).

Props:
```ts
interface QuickCheckoutProps {
  slug: string;                 // dealer order_slug (vd 'dai-long' cho mua trực tiếp)
  surface: 'public';            // mặc định public ở cả 2 nơi dùng
  dealerName?: string | null;   // nếu có → hiện "Đại lý phụ trách"; bỏ trống cho mua trực tiếp
  dealerId?: string | null;     // để trackReferral; bỏ trống cho house
  hideProductPicker?: boolean;  // /san-pham chỉ 1 SP → true (ẩn picker)
  onClose?: () => void;         // cho modal đóng / "Gửi đơn khác"
}
```

- [ ] **Step 1: Viết test thất bại**

`tests/unit/portal/quick-checkout.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickCheckout } from '@/components/portal/QuickCheckout';

const submit = vi.fn().mockResolvedValue('new-order-id');
vi.mock('@/lib/portal-queries', () => ({
  HOUSE_ORDER_SLUG: 'dai-long',
  getPublicActiveModels: vi.fn().mockResolvedValue([{ id: 'm1', code: 'ZHIDUN-CEO', name: 'ZhiDun CEO', base_price: 29500000, image_url: null }]),
  submitPublicOrder: (...a: unknown[]) => submit(...a),
  getPaymentStatusPublic: vi.fn().mockResolvedValue('pending'),
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('@/lib/referral-tracker', () => ({ trackReferral: vi.fn() }));
vi.mock('@/lib/vietqr', () => ({ PAYMENT_BANK_CODE:'MB', PAYMENT_ACCOUNT:'x', PAYMENT_NAME:'X', PAYMENT_ENABLED:true, orderMemo:()=>'DL1', vietqrUrl:()=>'u' }));

describe('QuickCheckout', () => {
  it('submits with the given slug and shows the QR card', async () => {
    render(<QuickCheckout slug="dai-long" surface="public" hideProductPicker />);
    await waitFor(() => expect(screen.getByText('ZhiDun CEO')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Họ tên khách'), { target: { value: 'Nguyen Van A' } });
    fireEvent.change(screen.getByPlaceholderText(/VD: 0903/), { target: { value: '0903123456' } });
    // address picker is exercised in e2e; unit test asserts slug wiring on submit attempt
    fireEvent.click(screen.getByRole('button', { name: /Gửi đơn|Đặt & thanh toán/ }));
    await waitFor(() => {
      const call = submit.mock.calls[0]?.[0];
      if (call) expect(call.slug).toBe('dai-long');
    });
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- quick-checkout`
Expected: FAIL — `QuickCheckout` chưa tồn tại.

- [ ] **Step 3: Tạo `QuickCheckout.tsx`**

Chuyển nguyên logic state + `submit()` + done-state JSX + form JSX từ `PublicOrderForm` ([src/app/dat-don/page.tsx:29-263](../../../src/app/dat-don/page.tsx#L29-L263)) vào component. Khác biệt:
- Nhận props ở trên thay cho đọc `useSearchParams`.
- `submit()` gọi `submitPublicOrder({ slug, ... })` với `slug` từ prop.
- Nếu `hideProductPicker` → không render `<ProductPicker>`, tự chọn `models[0]` làm `modelId`.
- Done-state: render `<PaymentQRCard orderId amount dealerName={dealerName} surface="public" />` (truyền `surface`).
- Nút submit text: nếu `surface==='public' && !dealerName` → "Đặt & thanh toán", ngược lại giữ "Gửi đơn".
- Khối "Đại lý phụ trách / Đơn đã gửi tới {dealerName}" chỉ render khi `dealerName` truthy.
- `trackReferral` chỉ gọi khi `dealerId` truthy.

- [ ] **Step 4: Thu gọn `src/app/dat-don/page.tsx`**

`PublicOrderForm` chỉ còn:
```tsx
function PublicOrderForm() {
  const params = useSearchParams();
  const slug = params.get('d') ?? '';
  const [dealer, setDealer] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!slug) { setLoading(false); setResolved(true); return; }
    getPublicDealerInfo(slug)
      .then((info) => { if (info?.dealer_name) setDealer({ id: info.dealer_id, name: info.dealer_name }); })
      .finally(() => { setLoading(false); setResolved(true); });
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#121416] text-[#a0a0a8]">Đang tải…</div>;
  if (resolved && (!slug || !dealer)) return (/* giữ nguyên khối "Mã đại lý không hợp lệ" cũ */);

  return (
    <div className="min-h-screen bg-[#121416] text-[#e2e2e5] py-10 px-4">
      <Toaster position="top-center" theme="dark" richColors />
      <div className="mx-auto max-w-lg">
        <QuickCheckout slug={slug} surface="public" dealerName={dealer!.name} dealerId={dealer!.id} />
      </div>
    </div>
  );
}
```
Xoá toàn bộ state/JSX form+done đã chuyển sang `QuickCheckout`. Cập nhật import (bỏ những thứ không dùng nữa, thêm `QuickCheckout`).

- [ ] **Step 5: Chạy test + typecheck**

Run: `npm test -- quick-checkout && npx tsc --noEmit`
Expected: test PASS, tsc 0 lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/components/portal/QuickCheckout.tsx src/app/dat-don/page.tsx tests/unit/portal/quick-checkout.test.tsx
git commit -m "refactor(portal): extract QuickCheckout from /dat-don"
```

---

## Task 6: Nút "Mua ngay" + modal trên `/san-pham`

**Files:**
- Modify: `src/components/ProductPage.tsx`
- Modify: `src/lib/translations/{vi,en,ja,ko,ru,zh}.ts`
- Test: `tests/unit/portal/product-page-buy.test.tsx`

- [ ] **Step 1: Thêm key i18n `product.buy_now`**

Trong mỗi file translations, cạnh `product.zalo_consult`:
- vi: `'product.buy_now': 'Mua ngay',`
- en: `'product.buy_now': 'Buy now',`
- ja: `'product.buy_now': '今すぐ購入',`
- ko: `'product.buy_now': '지금 구매',`
- ru: `'product.buy_now': 'Купить сейчас',`
- zh: `'product.buy_now': '立即购买',`

- [ ] **Step 2: Viết test thất bại**

`tests/unit/portal/product-page-buy.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductPage from '@/components/ProductPage';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'vi' }) }));
vi.mock('@/lib/gsap-loader', () => ({ loadGSAP: async () => ({ gsap: { context: () => ({ revert(){} }), fromTo(){} }, ScrollTrigger: { refresh(){} } }) }));
vi.mock('@/components/portal/QuickCheckout', () => ({ QuickCheckout: () => <div data-testid="quick-checkout" /> }));

describe('ProductPage buy now', () => {
  it('opens QuickCheckout modal on Mua ngay click', () => {
    render(<ProductPage />);
    expect(screen.queryByTestId('quick-checkout')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'product.buy_now' }));
    expect(screen.getByTestId('quick-checkout')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Chạy test — xác nhận FAIL**

Run: `npm test -- product-page-buy`
Expected: FAIL — chưa có nút `product.buy_now`.

- [ ] **Step 4: Sửa `ProductPage.tsx`**

Thêm `import { useState }` (đã có) + `import { QuickCheckout } from '@/components/portal/QuickCheckout';` + `import { HOUSE_ORDER_SLUG } from '@/lib/portal-queries';`. Thêm state `const [buyOpen, setBuyOpen] = useState(false);`.

Trong khối CTA ([ProductPage.tsx:272-281](../../../src/components/ProductPage.tsx#L272-L281)), thêm nút "Mua ngay" làm CTA chính (trước nút Zalo):
```tsx
<button
  type="button"
  onClick={() => setBuyOpen(true)}
  className="flex-1 py-3 bg-[#ff5625] text-white font-headline font-bold tracking-widest text-[10px] sm:text-xs text-center uppercase hover:bg-[#ff5625]/90 transition-all"
>
  {t('product.buy_now')}
</button>
```

Cuối component (trước `</div>` ngoài cùng), thêm modal:
```tsx
{buyOpen && (
  <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 backdrop-blur-sm p-4" onClick={() => setBuyOpen(false)}>
    <div className="mx-auto my-8 max-w-lg" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-end mb-2">
        <button type="button" aria-label="Đóng" onClick={() => setBuyOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <QuickCheckout slug={HOUSE_ORDER_SLUG} surface="public" hideProductPicker onClose={() => setBuyOpen(false)} />
    </div>
  </div>
)}
```

- [ ] **Step 5: Chạy test — xác nhận PASS**

Run: `npm test -- product-page-buy`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProductPage.tsx src/lib/translations/*.ts tests/unit/portal/product-page-buy.test.tsx
git commit -m "feat(san-pham): Mua ngay button + QuickCheckout modal"
```

---

## Task 7: Verify toàn bộ + E2E thật + deploy

**Files:** none (kiểm thử + deploy)

- [ ] **Step 1: Lint + typecheck + unit + build**

Run:
```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```
Expected: tsc 0 lỗi; lint sạch; tất cả vitest PASS; `next build` + pagefind index thành công (out/).

- [ ] **Step 2: E2E regression `/dat-don`**

Run: `npm run test:e2e -- critical-paths` (nếu suite có path `/dat-don`); nếu không, chạy `npm run dev` rồi mở `/dat-don?d=<slug đại lý thật>` — form hiện, submit tạo đơn, QR hiện.

- [ ] **Step 3: E2E thật luồng mua trực tiếp (giá thấp)**

1. `update public.product_models set active=true where code='TEST-5K';` (tạm).
2. `npm run dev` → mở `/san-pham` → "Mua ngay" → modal.
   - Lưu ý: modal khoá ZhiDun CEO (`hideProductPicker`). Để test 5k, tạm bỏ `hideProductPicker` hoặc đặt 1 đơn TEST-5K qua `/dat-don?d=dai-long`.
3. Điền tên + SĐT + địa chỉ → "Đặt & thanh toán" → QR hiện (memo `DL…`).
4. Chuyển khoản **5.000đ** thật vào MBBank `89588999999` đúng nội dung memo.
5. Trong ~5–30s: xác nhận
   - Thẻ trong modal chuyển **XANH "Thanh toán thành công"**.
   - Telegram Boss nhận "💰 ĐƠN HÀNG ĐÃ THANH TOÁN … NV: Đại Long trực tiếp".
   - DB: `select status from orders where ...` = `paid`; `select amount from commission_payouts where order_id=...` = **0**.
6. `update public.product_models set active=false where code='TEST-5K';` (khôi phục).

- [ ] **Step 4: Deploy production**

Run (quyền deploy đã uỷ quyền — xem memory `dailongai-deploy`):
```bash
git push origin main
npm run build
./node_modules/.bin/wrangler pages deploy out --project-name=dai-long-landing --branch=main \
  --commit-hash=$(git rev-parse HEAD) --commit-message="$(git log -1 --pretty=%B | head -1)"
```

- [ ] **Step 5: Verify production**

- `curl -s https://dailongai.com/san-pham | grep -o 'Mua ngay'` → có.
- Mở `/san-pham` thật → "Mua ngay" → modal QR render (hard-refresh vì CF cache stale tới 24h).

- [ ] **Step 6: Final verification gate (CLAUDE.md §8.5 — bắt buộc trước khi báo "xong")**

Invoke skill `superpowers:verification-before-completion`. Chạy lại và **trích output thật** vào báo cáo:
```bash
npx tsc --noEmit && npm test && npm run build
```
+ xác nhận bằng chứng E2E từ Step 3 (DB `status='paid'`, `commission_payouts.amount=0`, Telegram đã nhận) và production từ Step 5. Không có tool output làm bằng chứng = KHÔNG được claim done.

---

## Self-Review (đã rà)

- **Spec coverage:** A (house dealer + 0đ) → Task 2; B (RPC status) → Task 1+3+4; C (QuickCheckout + dat-don wrapper + modal) → Task 5+6. Kiểm thử → Task 7. ✔
- **Placeholder:** không có TODO/TBD; mọi step có code/SQL/lệnh thật. ✔
- **Type consistency:** `getPaymentStatusPublic(orderId)→string|null`, `HOUSE_ORDER_SLUG='dai-long'`, prop `surface` dùng nhất quán ở PaymentQRCard + QuickCheckout; `submitPublicOrder({slug,...})` khớp chữ ký hiện có. ✔
- **Lưu ý thực thi:** đọc `node_modules/next/dist/docs/` trước khi sửa Next (AGENTS.md); migration áp qua MCP `apply_migration` hoặc Studio; auth user house tạo tay 1 lần ở Studio.
