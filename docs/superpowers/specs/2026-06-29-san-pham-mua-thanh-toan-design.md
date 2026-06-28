# Mua & thanh toán ngay trên `/san-pham` — Design Spec

**Ngày:** 2026-06-29 · **Repo:** `dai-long-landing` · **Supabase:** `gcjiiiijfeitomegnivd`

## Vấn đề

Trang `/san-pham` ([src/components/ProductPage.tsx](../../../src/components/ProductPage.tsx)) hiện chỉ là
trang giới thiệu — CTA duy nhất là "Tư vấn Zalo" + "Xem thông số"
([ProductPage.tsx:272-281](../../../src/components/ProductPage.tsx#L272-L281)). Khách **không có đường nào
để mua + thanh toán ngay**.

Bộ máy mua + thanh toán tự động đã tồn tại và chạy được ở `/dat-don`
([src/app/dat-don/page.tsx](../../../src/app/dat-don/page.tsx)): form đặt đơn → `submit_public_order` RPC →
`PaymentQRCard` (VietQR MBBank, Casso auto-confirm). Nhưng nó **bị khoá sau mã đại lý** `?d=<slug>`:
RPC `submit_public_order` raise `'Mã đại lý không hợp lệ'` nếu không tìm thấy dealer
([dat-don/page.tsx:108-118](../../../src/app/dat-don/page.tsx#L108-L118)).

Mục tiêu: khách vào thẳng `/san-pham` có thể mua + thanh toán + thấy xác nhận, **không rời trang**, không cần
qua đại lý nào.

## Quyết định của Boss (2026-06-29)

1. **Ghi nhận đơn mua trực tiếp** → tài khoản đại lý nội bộ "Đại Long trực tiếp" (house). **Không** trả hoa hồng
   ra ngoài.
2. **Giao diện** → nút "Mua ngay" mở **modal phủ lên** `/san-pham` (khách không rời trang).
3. **Trường nhập** → đầy đủ: tên + SĐT + địa chỉ giao + hoá đơn VAT (tuỳ chọn) — như `/dat-don`.

## Hiện trạng đã verify (bằng chứng)

| Hạng mục | Kết quả verify |
|---|---|
| Sản phẩm thật | `product_models` row `ZHIDUN-CEO`, id `9ccf9261-4f14-4714-a48d-eee5ee991f06`, `base_price=29500000`, `active=true`. Là model duy nhất đang active. |
| RPC đặt đơn | `submit_public_order(p_slug,…)` — bắt buộc dealer hợp lệ; nếu null → raise lỗi. Anon có quyền EXECUTE (đang phục vụ `/dat-don` public). |
| Bank/Casso | VietQR MBBank `89588999999`; edge function `casso-webhook` (v5) còn active. Memo `DL`+8 hex đầu của order UUID. |
| Trình tự webhook | Casso cho đơn `pending`: update `status='approved'` (set `approved_by=dealer_id`) **rồi** `status='paid'`. **CỐ Ý đi qua `approved`.** |
| Trigger hoa hồng | `orders_commission_trigger` → `orders_on_approve()` gọi `calc_commission(order_id)` khi `pending→approved`. → **Đơn Casso CÓ sinh hoa hồng.** |
| `calc_commission` | Tạo 1 row `commission_payouts` cho dealer (FIXED override trong `dealer_commissions` nếu có, không thì tier %). **Không** override tầng 2 cho supervisor trong hàm này. |
| `profiles.id` | FK → `auth.users(id)` ON DELETE CASCADE. Tạo house dealer **bắt buộc** có auth user đi kèm. |
| Enum | `order_status = {pending,approved,rejected,paid,voided}`; `profile_status = {pending,active,suspended}`. |
| **RLS `orders`** | Chỉ có policy `admin` / `dealer (dealer_id=auth.uid())` / `supervisor`. **KHÔNG có policy anon.** |
| Poll thẻ xanh | `PaymentQRCard` poll `orders.select('status')` bằng anon client. → **Khách công khai không đọc được → thẻ "đã thanh toán" KHÔNG BAO GIỜ hiện.** Đây là gap có sẵn ở `/dat-don`. |
| RPC status public | **Không tồn tại** — chỉ có `submit_public_order`. |

## Kiến trúc giải pháp — 3 lớp

### A. Dữ liệu (chạy 1 lần, SQL — Boss paste vào Studio như các migration trước)

1. Tạo 1 auth user "house" không đăng nhập (qua `auth.users` insert hoặc admin API), lấy uuid `H`.
2. Insert `profiles`: `id=H`, `role='dealer'`, `status='active'`, `full_name='Đại Long trực tiếp'`,
   `order_slug='dai-long'`, `supervisor_id=NULL`.
3. Insert `dealer_commissions`: `dealer_id=H`, `commission_type='fixed'`, `rate_value=0`, `model_id=NULL`,
   `effective_from` = ngày quá khứ, `effective_to=NULL`.
   → `calc_commission` cho đơn house tìm thấy FIXED rule → `v_dealer_amount = 0` → payout 0đ. **Không sửa hàm
   lõi**, không trả hoa hồng ra ngoài, mà đơn vẫn đi `pending→approved→paid` bình thường.

### B. RPC mới (1 migration) — vá gap thẻ xanh

```sql
create or replace function public.get_payment_status_public(p_order_id uuid)
returns table (status order_status, paid_at timestamptz)
language sql security definer set search_path = public as $$
  select o.status, o.updated_at from public.orders o where o.id = p_order_id;
$$;
grant execute on function public.get_payment_status_public(uuid) to anon, authenticated;
```

- Chỉ trả `status` + thời điểm cập nhật cho **đúng 1 order theo id** (id là uuid khó đoán, đủ kín cho mục đích
  hiển thị trạng thái). Không lộ thông tin khác.

### C. Frontend (`dai-long-landing`)

1. **Tách component dùng chung** `<QuickCheckout slug surface dealerName?>` từ thân `PublicOrderForm` hiện tại
   (form → `submitPublicOrder` → done-state + `PaymentQRCard`). `/dat-don` trở thành wrapper mỏng: vẫn resolve
   dealer slug từ URL + guard "Mã đại lý không hợp lệ", rồi render `<QuickCheckout slug={urlSlug} surface="public" dealerName={…}>`.
   - Xoá hẳn code cũ trong `dat-don/page.tsx` đã chuyển vào component (delete, không archive).
2. **`PaymentQRCard`**: khi `surface === 'public'`, poll trạng thái bằng RPC `get_payment_status_public(orderId)`
   thay cho `sb.from('orders').select('status')`. Surface portal (dealer đăng nhập) giữ select trực tiếp (RLS đã cho).
3. **`/san-pham`**: thêm nút **"Mua ngay"** trong khung giá/CTA
   ([ProductPage.tsx:272-281](../../../src/components/ProductPage.tsx#L272-L281)), bấm → mở modal chứa
   `<QuickCheckout slug="dai-long" surface="public">`. Vì chỉ 1 model active, modal khoá cứng ZhiDun CEO (ẩn product
   picker, chỉ hiện stepper số lượng).

## Luồng dữ liệu

```
/san-pham [Mua ngay] → modal <QuickCheckout slug="dai-long">
  → submit_public_order('dai-long', ZHIDUN-CEO, qty, …)   [order house, status=pending]
  → PaymentQRCard: VietQR MBBank, memo DL<8hex>
  → khách CK → Casso webhook (5–30s): pending→approved (calc_commission=0đ)→paid
  → PaymentQRCard poll get_payment_status_public(orderId) thấy 'paid' → thẻ XANH
  → casso-webhook gửi Telegram "đã thanh toán" (NV: Đại Long trực tiếp)
```

## Xử lý lỗi / biên

- Anon EXECUTE đã có cho `submit_public_order`; cấp tương tự cho `get_payment_status_public`.
- Sai/mismatch số tiền > 1.000đ → webhook `amount_mismatch`, đơn ở `pending`, thẻ vẫn quay "đang chờ" (hành vi hiện tại).
- Đơn house không được phép bị admin "approve" lại để tránh sinh payout — đã là 0đ nên kể cả có cũng vô hại.
- `get_public_active_models` chỉ trả model active → TEST-5K phải `active=false` ở prod (đang vậy).

## Ngoài phạm vi (YAGNI)

Không giỏ hàng/đa sản phẩm; không cổng thẻ quốc tế (chỉ QR chuyển khoản); không tạo tài khoản khách;
không attribution theo referral (Boss chọn thuần house); không tính phí ship động.

## Kiểm thử

1. Tạm `active=true` cho model giá thấp (TEST-5K) → đặt 1 đơn qua modal `/san-pham` → CK 5.000đ thật →
   xác nhận: thẻ chuyển xanh trong modal + Telegram báo "Đại Long trực tiếp" + `commission_payouts` của house = **0đ**.
2. `npx tsc --noEmit` + `npm run build` xanh trước khi deploy.
3. Regression: `/dat-don?d=<slug đại lý thật>` vẫn hoạt động (form + QR + thẻ xanh) sau khi tách component.
4. Deploy: `npm run build` + `wrangler pages deploy out` (workflow đã uỷ quyền), verify production.

## File dự kiến chạm

- **Mới:** `src/components/portal/QuickCheckout.tsx` (tách từ dat-don), migration RPC, SQL setup house (1 lần).
- **Sửa:** `src/app/dat-don/page.tsx` (thành wrapper), `src/components/portal/PaymentQRCard.tsx` (poll public),
  `src/components/ProductPage.tsx` (nút + modal), `src/lib/portal-queries.ts` (thêm `getPaymentStatusPublic`).
