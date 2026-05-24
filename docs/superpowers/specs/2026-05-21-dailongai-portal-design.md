# dailongai.com — Dealer/Supervisor Portal (v1)

**Date:** 2026-05-21
**Owner:** Boss (Đại Long Medical)
**Author:** Sen Coder
**Status:** Approved design, pending implementation plan

## 1. Problem & Goals

Đại Long Medical hiện chưa có hệ thống quản lý đại lý/supervisor cho việc bán máy laser bán dẫn (Zhi Dun và các dòng khác). Mọi tracking đang là greenfield — chưa có Excel, ERP, CRM nào đang chạy. Cần portal cho:

- Đại lý đăng ký, nhập đơn bán máy, xem doanh số và hoa hồng cá nhân.
- Supervisor quản lý nhiều đại lý dưới quyền, xem aggregate metrics, hưởng override commission.
- Admin (Boss/staff) duyệt đăng ký, duyệt đơn, set commission rate, xem báo cáo toàn hệ thống.

**Goal:** Launch v1 trong ~5 tuần, đặt nền móng cho B2B distributor management.

**Non-goals (v2+):** lead pipeline tích hợp Zalo B2C, module bảo hành, gamification, e-signing, multi-language, daily digest tích hợp Sen CEO.

## 2. Architecture

**Option chốt:** `dailongai.com/portal` SPA-only (route client-side) — không tách subdomain, không migrate SSR. Lý do:

- Marketing site đang đầu tư SEO mạnh (BlogPosting schema, sitemap, canonical) → giữ static export tránh regression.
- 1 codebase, share branding/component, deploy 1 lệnh `wrangler pages deploy out`.
- Route `/portal/**` ở sau auth → không ảnh hưởng crawl/index.

**Stack:**

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | Next.js 16 static export (giữ nguyên), route `/portal/**` với `'use client'`. |
| Auth | Supabase Auth — **OAuth Google + Facebook là chính**, fallback email + password. OTP SMS chỉ cho 2FA admin. |
| DB | Supabase Postgres — **project mới `dailongai-portal`** tách khỏi fleet_ops project. |
| Authorization | Supabase Row-Level Security (RLS) policies. |
| Storage | Supabase Storage — bucket `receipts/` (private, signed URL) + `sales-docs/` (read theo role). |
| Edge Functions | Deno (Supabase native) — notification dispatch, commission calc trigger. |
| Notifications | Zalo OA (qua `app/`), Telegram (`@SenCoder1_bot` cho admin). |
| UI components | dai-long-landing style + shadcn/ui cho table/form. |
| Charts | `recharts` hoặc `tremor` (compat React 19). |
| Mobile | Responsive mobile-first cho dealer (form 1 cột, upload camera). |

## 3. Data Model

### 3.1 Schema tổng quan

```text
profiles                       -- extends auth.users
  id (uuid PK, FK auth.users)
  full_name, phone, email
  role enum ('dealer'|'supervisor'|'admin'|null)
  status enum ('pending'|'active'|'suspended')
  supervisor_id uuid FK profiles  -- null cho supervisor/admin hoặc dealer chưa gán
  business_name, business_address, id_number
  approved_at, approved_by FK profiles
  created_at, updated_at

product_models
  id, code (unique), name, description, base_price
  active boolean default true
  created_at, updated_at

dealer_commissions             -- rule hoa hồng tầng 1
  id
  dealer_id FK profiles
  model_id FK product_models    -- nullable = áp tất cả model
  commission_type enum ('fixed'|'percent')
  rate_value numeric
  effective_from date, effective_to date nullable
  set_by FK profiles, created_at

supervisor_overrides           -- rule hoa hồng tầng 2
  id
  supervisor_id FK profiles
  dealer_id FK profiles          -- nullable = áp toàn team
  model_id FK product_models     -- nullable = áp tất cả model
  override_percent numeric
  effective_from date, effective_to date nullable
  set_by FK profiles, created_at

orders
  id
  dealer_id FK profiles
  model_id FK product_models
  serial_number text UNIQUE
  customer_name, customer_phone, customer_address
  sale_price numeric, sale_date date
  status enum ('pending'|'approved'|'rejected'|'paid'|'voided')
  receipt_image_url, contract_image_url
  notes text
  approved_at, approved_by FK profiles
  rejection_reason text
  voided_at, voided_by
  created_at, updated_at

commission_payouts             -- snapshot lúc approve
  id
  order_id FK orders
  recipient_id FK profiles
  recipient_role enum ('dealer'|'supervisor')
  amount numeric
  calculated_at
  paid_at nullable, payment_proof_url
  voided_at nullable

audit_log                      -- traceability
  id
  actor_id FK profiles
  action text                    -- 'approve_order'|'reject_order'|'set_commission'|...
  target_table text, target_id uuid
  before jsonb, after jsonb
  created_at

sales_documents
  id, title, file_url
  category enum ('catalog'|'video'|'contract_template'|'manual')
  visible_to enum ('all'|'dealer'|'supervisor')
  uploaded_by FK profiles, created_at
```

### 3.2 RLS Policies

| Bảng | Dealer | Supervisor | Admin |
|------|--------|------------|-------|
| `profiles` | SELECT own | SELECT own + dealers WHERE supervisor_id=self | ALL |
| `orders` | SELECT/INSERT own (force status=pending), UPDATE own khi status=pending | SELECT team's orders | SELECT all + UPDATE status |
| `commission_payouts` | SELECT own | SELECT own | ALL |
| `dealer_commissions` | SELECT own | — | ALL |
| `supervisor_overrides` | — | SELECT own | ALL |
| `product_models` | SELECT active | SELECT active | ALL |
| `audit_log` | — | — | SELECT |
| `sales_documents` | SELECT WHERE visible_to IN ('all','dealer') | SELECT WHERE visible_to IN ('all','supervisor') | ALL |

**Test:** pgTAP test mỗi policy — verify dealer A không SELECT được order của dealer B, supervisor không SELECT được team khác, v.v.

### 3.3 Commission calculation trigger

Postgres function `calc_commission(order_id)` chạy khi `orders.status` đổi từ `pending` → `approved`:

1. Lookup `dealer_commissions` áp cho (dealer_id, model_id, sale_date) — ưu tiên rule có `model_id` cụ thể, fallback rule `model_id IS NULL`. Pick rule có `effective_from` muộn nhất, `effective_to IS NULL OR > sale_date`.
2. Tính `dealer_amount`:
   - `commission_type='fixed'` → `rate_value`
   - `commission_type='percent'` → `rate_value/100 * sale_price`
3. INSERT `commission_payouts` (recipient=dealer, amount=dealer_amount, recipient_role='dealer').
4. Nếu `profiles.supervisor_id IS NOT NULL`:
   - Lookup `supervisor_overrides` áp cho (supervisor_id, dealer_id, model_id, sale_date) — ưu tiên rule cụ thể nhất.
   - `override_amount = override_percent/100 * sale_price`
   - INSERT `commission_payouts` (recipient=supervisor, amount=override_amount, recipient_role='supervisor').

Khi đơn `voided`: set `voided_at` trên related `commission_payouts` (không xóa, giữ audit).

## 4. Pages & Routes

```
/portal/
  login                       (public — OAuth Google/Facebook + email fallback)
  register                    (public — OAuth Google/Facebook + email fallback)
  auth/callback               (OAuth redirect handler)
  onboarding                  (post-auth lần đầu — modal hoàn tất hồ sơ doanh nghiệp)
  forgot-password
  reset-password

  (auth required)
  dashboard                   → redirect theo role

  dealer/
    page                      KPI cards + chart 6 tháng + đơn pending
    orders                    list + filter (status/tháng/model)
    orders/new                form nhập đơn (upload biên nhận + hợp đồng)
    orders/[id]               detail (edit khi pending)
    commissions               lịch sử payout
    documents                 catalog/video/hợp đồng mẫu
    profile

  supervisor/
    page                      aggregate KPI team
    team                      danh sách dealers dưới quyền
    team/[dealerId]           drill-down dealer (read-only dashboard)
    commissions               override earnings
    documents
    profile

  admin/
    page                      overview toàn hệ thống
    registrations             queue duyệt đăng ký
    users                     list + filter (role/status)
    users/[id]                detail + set role/supervisor/commission/override
    orders                    queue đơn pending + lịch sử
    orders/[id]               approve/reject + comment
    models                    CRUD product_models
    documents                 upload Supabase Storage
    audit-log                 traceability
    reports                   tổng doanh số/hoa hồng + export Excel
```

## 5. Workflow

### 5.1 Đăng ký → duyệt

**UX nguyên tắc:** thật đơn giản, hiện đại, OAuth-first. Đại lý không cần điền email/password nếu đã có Google/Facebook.

**Bước 1 — Landing đăng ký `/portal/register` (1 màn hình, 3 lựa chọn):**

```text
┌─────────────────────────────────────┐
│   Đăng ký Đại lý Đại Long           │
│                                     │
│   [G] Tiếp tục với Google           │
│   [f] Tiếp tục với Facebook         │
│   ─────── hoặc ───────              │
│   [✉] Tiếp tục với Email            │
│                                     │
│   Đã có tài khoản? Đăng nhập        │
└─────────────────────────────────────┘
```

- **Google/Facebook OAuth**: 1 click → Supabase Auth tạo user + trả về email + full_name + avatar tự động.
- **Email**: form ngắn (email + password) → magic link verify email.

**Bước 2 — Form bổ sung tối thiểu (chỉ 2 field):**

Sau khi Auth thành công (OAuth hoặc email), đại lý lần đầu vào portal sẽ thấy modal "Hoàn tất hồ sơ":

- Số điện thoại (auto-validate VN format)
- Loại tài khoản mong muốn: `dealer | supervisor` (radio buttons, mặc định `dealer`)

Loại tài khoản là declared preference — admin xác nhận khi approve. Thông tin doanh nghiệp (tên cửa hàng, địa chỉ, CMND) admin sẽ capture qua Zalo/điện thoại trước khi approve nếu cần — không bắt đại lý điền lên portal.

**Bước 3 — Pipeline duyệt:**

1. Supabase Auth tạo user; INSERT profile (role=null, status=pending, full_name + email + avatar từ OAuth provider nếu có).
2. Trigger Telegram alert Boss `@SenCoder1_bot`: `"đăng ký mới: [tên] / [SĐT] / via [Google|Facebook|Email]"`.
3. Đại lý thấy màn "đang chờ duyệt" + email confirm.
4. Admin `/portal/admin/registrations` → xem hồ sơ → gán role + supervisor_id + commission rule → approve.
5. status=active → Zalo OA + email "đã kích hoạt, bấm đây để vào dashboard".

**OAuth provider setup (infra checklist trước khi launch):**

- Google Cloud Console → OAuth 2.0 Client ID cho dailongai.com (authorized origin + redirect URI Supabase).
- Facebook Developer → app type Business, request `email` + `public_profile` scope, App Review nếu cần.
- Supabase project Auth settings → enable Google + Facebook providers, paste client ID + secret.
- Redirect URLs: `https://dailongai.com/portal/auth/callback` + `http://localhost:3000/portal/auth/callback` (dev).

### 5.2 Nhập đơn → duyệt → hoa hồng

1. Dealer `/portal/dealer/orders/new` → điền form, upload 2 ảnh → submit (status=pending).
2. Telegram alert Boss: `"đơn mới $X từ [dealer], serial ZZZ"`.
3. Zalo OA cho dealer: `"đã ghi nhận đơn, đang chờ duyệt"`.
4. Admin `/portal/admin/orders/[id]` → đối chiếu ảnh → approve / reject.
5. Khi approve → trigger `calc_commission(order_id)` → INSERT commission_payouts (2 tầng nếu có supervisor).
6. Zalo OA cho dealer: `"đơn duyệt, hoa hồng dự kiến $X"`.
7. Zalo OA cho supervisor (nếu có override): `"+$Y override từ [dealer]"`.
8. Admin chi tiền → đánh dấu `paid` + upload bằng chứng → notify dealer/supervisor.

### 5.3 State machine đơn

```
[dealer create] → pending
                    ├──→ approved → paid
                    │       └──→ voided (admin invalidate, audit log)
                    └──→ rejected (+ rejection_reason; dealer clone đơn mới)
```

## 6. Notifications

| Sự kiện | Đại lý (Zalo OA) | Supervisor | Admin (Telegram) |
|---------|------------------|------------|------------------|
| Đăng ký mới | Email "chờ duyệt" | — | ✅ alert |
| Đăng ký duyệt | ✅ Zalo + email | — | log |
| Đơn mới | ✅ ack | — | ✅ alert |
| Đơn approved | ✅ + amount | ✅ + override (nếu có) | log |
| Đơn rejected | ✅ + lý do | — | log |
| Hoa hồng paid | ✅ + proof | ✅ (override) | log |

**Dispatcher:** Postgres trigger → Supabase Edge Function `notify-dispatch` → fan-out tới Zalo bot (`app/`) và Telegram bot (`@SenCoder1_bot`, chat_id Boss=6052313595).

Code path: `dai-long-landing/supabase/functions/notify-dispatch/`.

## 7. Security & Anti-Fraud

- **Serial unique** DB constraint trên `orders.serial_number` → chống đơn trùng.
- **Rate limit** đăng ký: 3 lần/IP/ngày (Supabase Edge Function check).
- **Image upload**: Supabase Storage policy `.jpg/.png/.webp`, max 5MB, auto strip EXIF GPS.
- **Audit log immutable**: RLS deny UPDATE/DELETE, chỉ INSERT.
- **Commission rate change**: rate cũ vẫn áp cho đơn `sale_date < effective_from`. Audit log before/after.
- **Approval reject**: bắt buộc `rejection_reason` (DB CHECK constraint).
- **OAuth**: Google + Facebook làm kênh chính (giảm rủi ro phishing + lưu trữ password local). Supabase Auth quản lý refresh token.
- **Email + password fallback**: Supabase Auth default (bcrypt, min 8 char). Magic link verify email trước khi active.
- **2FA**: bắt buộc cho admin v1 (TOTP), optional cho dealer/supervisor.
- **Session**: JWT 1h, refresh 7 ngày.
- **PII**: id_number, customer_phone, customer_address chỉ admin + chính dealer thấy (RLS).

## 8. Edge Cases

1. **Supervisor đổi team** — `profiles.supervisor_id` thay đổi; đơn cũ giữ snapshot `commission_payouts`, đơn mới tính theo SV mới.
2. **Dealer suspend** — `status=suspended` → không login; đơn pending: admin chọn reject hoặc giữ.
3. **Đơn approved sai** — admin có quyền `void`; commission_payouts ghi `voided_at` (không xóa).
4. **Rule commission đổi giữa kỳ** — nhiều rule cùng dealer với `effective_from/to`; tính theo `sale_date`.
5. **Supervisor không có override rule** — chỉ xem team report, không hoa hồng (hợp lệ).
6. **Đơn trùng serial khi pending** — DB constraint reject; UI hiển thị lỗi rõ.
7. **Admin xóa product_model** — soft delete (`active=false`), giữ FK cho orders cũ.
8. **Dealer reject xong tạo lại** — clone đơn mới, serial khác (vì serial cũ đã trong DB).
9. **OAuth email trùng** — đại lý đã đăng ký bằng email rồi sau đó dùng Google OAuth cùng email: Supabase Auth tự động link 2 identity vào 1 user. Nếu mismatch → hiển thị thông báo "email đã tồn tại, đăng nhập bằng phương thức cũ rồi link account trong profile".
10. **OAuth provider không trả phone** — Google/Facebook không expose phone qua OAuth; bắt buộc dealer điền ở bước onboarding sau auth.

## 9. Out of Scope (v1)

- Lead pipeline integration với Zalo bot B2C.
- Module bảo hành cho khách cuối.
- Leaderboard / gamification.
- E-signing hợp đồng.
- Multi-language (chỉ tiếng Việt).
- Webhook public API.
- Daily digest tích hợp Sen CEO (sẽ link sau v1 launch).
- Tier hoa hồng động (auto upgrade theo KPI).
- Multi-currency.
- KYC giấy phép kinh doanh upload.

## 10. Rollout (5 tuần ước tính)

| Tuần | Milestone |
|------|-----------|
| 1 | Supabase project setup, schema migration, RLS policies, pgTAP test suite. |
| 2 | OAuth setup (Google + Facebook provider apps + Supabase Auth config) + register/login UI + onboarding modal + admin approval queue + profile management. |
| 3 | Dealer dashboard + nhập đơn + admin duyệt + commission calc trigger + pgTAP coverage. |
| 4 | Supervisor dashboard + team drill-down + override commission + reports + export Excel. |
| 5 | Notification (Zalo + Telegram) + tài liệu bán hàng + mobile polish + UAT + go-live. |

## 11. Open Questions (tracker)

Không có. Tất cả major decisions đã chốt trong brainstorming session:

- Architecture: `/portal` SPA + Supabase
- Onboarding: public + admin duyệt
- Workflow đơn: dealer tự nhập, admin duyệt
- Commission tầng 1: mỗi dealer khác nhau, admin set
- Commission tầng 2: supervisor override % từ dealer dưới quyền
- Tier B (notification, serial, mobile, audit, tài liệu) gộp vào v1
- Tier C defer v2+

## 12. Success Criteria

- Đại lý đăng ký → admin duyệt → nhập đơn → admin duyệt → commission tính đúng, payout snapshot lưu, Zalo notification gửi: end-to-end pass smoke test trên ≥3 đơn thực.
- Supervisor login → thấy aggregate team metrics, drill-down dealer read-only, override commission tính đúng.
- pgTAP RLS test suite 100% pass.
- Mobile responsive: dealer hoàn thành nhập đơn mới end-to-end trên iPhone Safari ≤ 2 phút.
- Audit log capture đủ mọi hành động admin (approve, reject, set rate, void).
- Deploy lên `dailongai.com/portal` không gây regression SEO trang chính (sitemap, canonical, BlogPosting schema vẫn intact, kiểm bằng Lighthouse + curl).
