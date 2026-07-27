# Portal CRM Plan 1 — Khách hàng, Liên hệ, Cơ hội, Hoạt động

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm lớp CRM vào portal dailongai.com: quản lý khách hàng + liên hệ, cơ hội bán hàng trên bảng kanban hai pipeline (B2C bán máy cho khách cuối, B2B tuyển & chăm đại lý), và hoạt động chăm sóc (nhiệm vụ/cuộc gọi/lịch hẹn).

**Architecture:** 5 bảng mới `crm_stages`, `crm_accounts`, `crm_contacts`, `crm_opportunities`, `crm_activities` trong Supabase project `gcjiiiijfeitomegnivd`, tất cả RLS theo đúng mô hình phân quyền sẵn có của portal: dealer thấy bản ghi mình sở hữu, supervisor thấy thêm bản ghi của dealer trong nhánh (`profiles.supervisor_id = auth.uid()`), admin thấy tất cả — gói trong một helper `public.crm_owner_visible(uuid)` để không lặp policy. Frontend là 3 trang client-side mới dưới `/portal/crm/**` trong repo static-export hiện tại, dùng lại `PortalShell`, `useAuth`, `useI18n`, palette kinetic. Không có API route mới, không SSR: mọi truy vấn đi trực tiếp qua supabase-js như các trang portal khác.

**Tech Stack:** Next.js 15 static export · React 19 client components · Supabase Postgres 17.6 + RLS + pgTAP · TypeScript · Tailwind · vitest + jsdom · sonner (toast) · Material Symbols icons.

---

## Prerequisites (làm trước Task 1)

- [ ] **Docker phải chạy** (Supabase local đang tắt — đã kiểm tra ngày 27/07/2026, `docker ps` trả lỗi "Cannot connect to the Docker daemon").

```bash
open -a Docker
# đợi tới khi lệnh sau in ra danh sách container rỗng, không lỗi:
docker ps
```

- [ ] **Khởi động Supabase local + verify migration cũ chạy sạch**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
supabase start
supabase db reset
supabase test db
```

Expected: `supabase test db` in ra 16 file test, tất cả `Result: PASS`. Nếu FAIL ở đây thì dừng, đó là lỗi có sẵn không phải do plan này.

- [ ] **Tạo nhánh làm việc**

```bash
git checkout main && git pull
git checkout -b portal-crm
```

---

## File Structure

**Migrations mới** (`supabase/migrations/`, chạy theo thứ tự lexicographic):

| File | Trách nhiệm |
|---|---|
| `20260727120000_crm_stages.sql` | Bảng giai đoạn + seed 2 pipeline (6 giai đoạn mỗi pipeline) |
| `20260727120100_crm_accounts_contacts.sql` | Helper `crm_owner_visible`, bảng `crm_accounts` + `crm_contacts` + RLS + auto-code |
| `20260727120200_crm_opportunities.sql` | Bảng `crm_opportunities` + trigger khớp pipeline/đóng cơ hội + audit + RLS |
| `20260727120300_crm_activities.sql` | Bảng `crm_activities` + RLS |
| `20260727120400_crm_views.sql` | 2 view `security_invoker`: `crm_opportunity_board`, `crm_activity_inbox` |

**pgTAP mới** (`supabase/tests/`): `17_crm_stages.sql`, `18_crm_accounts.sql`, `19_crm_opportunities.sql`, `20_crm_activities.sql`, `21_crm_views.sql`.

**Frontend:**

| File | Trách nhiệm |
|---|---|
| `src/lib/portal-types.ts` (sửa) | Type `CrmStage`, `CrmAccount`, `CrmContact`, `CrmOpportunityBoardRow`, `CrmActivityRow` |
| `src/lib/portal-queries.ts` (sửa) | Hàm truy vấn/ghi CRM, đúng style hàm sẵn có |
| `src/lib/crm-board.ts` (mới) | Hàm thuần `groupByStage`, `sumAmount`, `weightedForecast` — logic kanban tách khỏi React để test dễ |
| `src/components/portal/CrmNav.tsx` (mới) | Sub-nav 3 mục CRM dùng chung 3 trang |
| `src/components/portal/CrmAccountDrawer.tsx` (mới) | Drawer thêm/sửa khách hàng + danh sách liên hệ của khách đó |
| `src/components/portal/CrmOpportunityDrawer.tsx` (mới) | Drawer thêm/sửa cơ hội |
| `src/components/portal/CrmActivityDrawer.tsx` (mới) | Drawer thêm/sửa hoạt động |
| `src/app/portal/crm/accounts/page.tsx` (mới) | Danh sách khách hàng + tìm kiếm + lọc loại + mở drawer |
| `src/app/portal/crm/pipeline/page.tsx` (mới) | Kanban 2 tab pipeline, kéo-thả đổi giai đoạn |
| `src/app/portal/crm/activities/page.tsx` (mới) | Danh sách hoạt động: hôm nay / quá hạn / đã xong |
| `src/components/portal/PortalShell.tsx` (sửa) | Thêm mục nav CRM cho cả 3 vai trò |
| `src/lib/translations/vi.ts`, `en.ts` (sửa) | Key i18n mới (`t()` fallback thứ tự `locale → en → vi → key`, nên chỉ cần 2 file) |

**Tests frontend:** `tests/unit/portal/crm-board.test.ts`, `tests/unit/portal/crm-queries.test.ts`.

## Quy ước bắt buộc khi viết 3 trang CRM

`PortalShell` nhận prop `variant?: 'dealer' | 'supervisor' | 'admin'` và **mặc định là `'dealer'`** (`PortalShell.tsx:16-23`) — biến này quyết định sidebar nào được render. Vì 3 trang CRM dùng chung cho cả 3 vai trò, mỗi trang **phải** truyền `variant={profile.role ?? 'dealer'}`, nếu không supervisor và admin sẽ thấy sidebar của đại lý.

Cả 3 trang theo cùng khuôn mẫu của các trang portal sẵn có: `'use client'`, `useAuth()` lấy `session/profile/loading`, `useEffect` đẩy về `/portal/login` khi hết phiên, `useI18n()` cho chữ, `toast` của sonner cho lỗi, và **không dùng route động** (`[id]`) vì repo là static export — drill-down bằng drawer hoặc query param.

## Ngoài phạm vi Plan 1 (đừng làm)

Báo giá · Chính sách giá · Phiếu bảo hành · Thẻ tư vấn · chấm điểm/xếp hạng khách hàng · workflow tự động · WebForm hút lead từ landing page · chuyển cơ hội thành đơn hàng tự động (cột `order_id` có sẵn nhưng Plan 1 chỉ gắn tay) · import Excel · báo cáo CRM. Không sửa bảng `orders`, `profiles`, `commission_*`.

**⛔ LỚP AI — LOẠI HẲN, KHÔNG PHẢI HOÃN (Boss chốt 27/07/2026).** CRM của Đại Long **không** làm bất kỳ tính năng AI nào, kể cả khi thấy AMIS CRM có: trợ lý chat kiểu AVA, thêm/điền bản ghi bằng ngôn ngữ tự nhiên, trích xuất khách từ CCCD/hộ chiếu hay mạng xã hội, dự đoán khả năng chốt cơ hội, gợi ý hàng hóa theo lịch sử mua, phát hiện bản ghi trùng bằng AI, tóm tắt/chấm điểm bằng AI, tạo báo cáo hay ảnh quảng cáo bằng AI, thông báo AI theo lịch. Không thêm cột, bảng, prompt, gọi API LLM, hay nút "AI" nào vào 3 module của Plan 1. Nếu một task nào trong plan gợi ý điều đó thì đó là lỗi của plan — bỏ qua, đừng làm.

---

### Task 1: Bảng giai đoạn `crm_stages` + seed 2 pipeline

**Files:**
- Create: `supabase/migrations/20260727120000_crm_stages.sql`
- Test: `supabase/tests/17_crm_stages.sql`

- [ ] **Step 1: Viết test thất bại**

Create `supabase/tests/17_crm_stages.sql`:

```sql
BEGIN;
SELECT plan(4);

SELECT has_table('public', 'crm_stages', 'crm_stages table exists');

SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_stages WHERE pipeline='b2c_device'$$,
    ARRAY[6],
    'pipeline b2c_device seeded with 6 stages'
);

SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_stages WHERE pipeline='b2b_dealer'$$,
    ARRAY[6],
    'pipeline b2b_dealer seeded with 6 stages'
);

SELECT results_eq(
    $$SELECT name FROM public.crm_stages
      WHERE pipeline='b2c_device' AND forecast='won'$$,
    ARRAY['Chốt đơn'],
    'b2c_device has exactly one won stage named Chốt đơn'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy test để chắc nó fail**

```bash
supabase test db 2>&1 | tail -20
```

Expected: FAIL — `relation "public.crm_stages" does not exist`.

- [ ] **Step 3: Viết migration**

Create `supabase/migrations/20260727120000_crm_stages.sql`:

```sql
-- CRM pipeline stages. Hai pipeline: b2c_device (bán máy cho khách cuối),
-- b2b_dealer (tuyển và chăm đại lý). Mẫu giai đoạn học từ AMIS CRM.

CREATE TABLE IF NOT EXISTS public.crm_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline text NOT NULL CHECK (pipeline IN ('b2c_device', 'b2b_dealer')),
    name text NOT NULL,
    probability smallint NOT NULL CHECK (probability BETWEEN 0 AND 100),
    forecast text NOT NULL CHECK (forecast IN ('open', 'won', 'lost')),
    sort_order smallint NOT NULL,
    active boolean NOT NULL DEFAULT true,
    UNIQUE (pipeline, sort_order),
    UNIQUE (pipeline, name)
);

ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_stages_select_all ON public.crm_stages;
CREATE POLICY crm_stages_select_all ON public.crm_stages
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS crm_stages_admin_write ON public.crm_stages;
CREATE POLICY crm_stages_admin_write ON public.crm_stages
    FOR ALL TO authenticated
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

INSERT INTO public.crm_stages (pipeline, name, probability, forecast, sort_order) VALUES
    ('b2c_device', 'Mới tiếp nhận',      10,  'open', 1),
    ('b2c_device', 'Đang quan tâm',      30,  'open', 2),
    ('b2c_device', 'Đã trải nghiệm máy', 50,  'open', 3),
    ('b2c_device', 'Đàm phán giá',       70,  'open', 4),
    ('b2c_device', 'Chốt đơn',          100,  'won',  5),
    ('b2c_device', 'Không mua',           0,  'lost', 6),
    ('b2b_dealer', 'Mới tiếp cận',       10,  'open', 1),
    ('b2b_dealer', 'Đã gửi chính sách',  30,  'open', 2),
    ('b2b_dealer', 'Đàm phán hợp tác',   50,  'open', 3),
    ('b2b_dealer', 'Chờ đơn đầu tiên',   80,  'open', 4),
    ('b2b_dealer', 'Thành đại lý',      100,  'won',  5),
    ('b2b_dealer', 'Từ chối hợp tác',     0,  'lost', 6)
ON CONFLICT (pipeline, sort_order) DO NOTHING;
```

- [ ] **Step 4: Chạy lại test**

```bash
supabase db reset && supabase test db 2>&1 | tail -20
```

Expected: `17_crm_stages.sql .. ok` và tổng kết `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260727120000_crm_stages.sql supabase/tests/17_crm_stages.sql
git commit -m "feat(crm): add crm_stages table with two seeded pipelines"
```

---

### Task 2: Bảng `crm_accounts` + `crm_contacts` + helper phân quyền

**Files:**
- Create: `supabase/migrations/20260727120100_crm_accounts_contacts.sql`
- Test: (test ở Task 3)

- [ ] **Step 1: Viết migration**

Create `supabase/migrations/20260727120100_crm_accounts_contacts.sql`:

```sql
-- CRM khách hàng + liên hệ.
-- owner_id = người sở hữu bản ghi (dealer/supervisor/admin trong profiles).
-- Phân quyền dùng chung helper crm_owner_visible: self / team của supervisor / admin.

CREATE OR REPLACE FUNCTION public.crm_owner_visible(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p_owner = auth.uid()
        OR public.current_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.profiles d
            WHERE d.id = p_owner AND d.supervisor_id = auth.uid()
        );
$$;

REVOKE EXECUTE ON FUNCTION public.crm_owner_visible(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_owner_visible(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_owner_visible(uuid) TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.crm_account_code_seq;
-- Trigger sinh mã KH chạy dưới quyền người gọi (không SECURITY DEFINER),
-- nên role authenticated phải có USAGE trên sequence, không dựa vào default privileges.
GRANT USAGE, SELECT ON SEQUENCE public.crm_account_code_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    kind text NOT NULL DEFAULT 'customer'
        CHECK (kind IN ('customer', 'dealer_prospect')),
    name text NOT NULL,
    is_individual boolean NOT NULL DEFAULT true,
    phone text,
    email text,
    zalo_phone text,
    tax_code text,
    province text,
    address text,
    source text CHECK (source IS NULL OR source IN
        ('website', 'zalo', 'facebook', 'google_ads', 'tiktok', 'referral', 'hotline', 'event', 'other')),
    referrer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_owner ON public.crm_accounts(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_kind ON public.crm_accounts(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_phone ON public.crm_accounts(phone);

CREATE OR REPLACE FUNCTION public.crm_set_account_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := 'KH-' || lpad(nextval('public.crm_account_code_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_accounts_set_code ON public.crm_accounts;
CREATE TRIGGER crm_accounts_set_code
BEFORE INSERT ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.crm_set_account_code();

DROP TRIGGER IF EXISTS crm_accounts_set_updated_at ON public.crm_accounts;
CREATE TRIGGER crm_accounts_set_updated_at
BEFORE UPDATE ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_accounts_select ON public.crm_accounts;
CREATE POLICY crm_accounts_select ON public.crm_accounts
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

DROP POLICY IF EXISTS crm_accounts_insert ON public.crm_accounts;
CREATE POLICY crm_accounts_insert ON public.crm_accounts
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_accounts_update ON public.crm_accounts;
CREATE POLICY crm_accounts_update ON public.crm_accounts
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin')
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_accounts_delete ON public.crm_accounts;
CREATE POLICY crm_accounts_delete ON public.crm_accounts
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    title text,
    phone text,
    email text,
    zalo_phone text,
    is_primary boolean NOT NULL DEFAULT false,
    do_not_call boolean NOT NULL DEFAULT false,
    do_not_email boolean NOT NULL DEFAULT false,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON public.crm_contacts(account_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner ON public.crm_contacts(owner_id, created_at DESC);

DROP TRIGGER IF EXISTS crm_contacts_set_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_set_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_contacts_select ON public.crm_contacts;
CREATE POLICY crm_contacts_select ON public.crm_contacts
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

DROP POLICY IF EXISTS crm_contacts_insert ON public.crm_contacts;
CREATE POLICY crm_contacts_insert ON public.crm_contacts
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_contacts_update ON public.crm_contacts;
CREATE POLICY crm_contacts_update ON public.crm_contacts
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin')
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_contacts_delete ON public.crm_contacts;
CREATE POLICY crm_contacts_delete ON public.crm_contacts
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');
```

- [ ] **Step 2: Chạy migration để chắc nó apply sạch**

```bash
supabase db reset 2>&1 | tail -8
```

Expected: không có dòng `ERROR`, kết thúc bằng thông báo reset xong.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260727120100_crm_accounts_contacts.sql
git commit -m "feat(crm): add crm_accounts + crm_contacts with owner-based RLS"
```

---

### Task 3: pgTAP cho RLS khách hàng/liên hệ

**Files:**
- Test: `supabase/tests/18_crm_accounts.sql`

- [ ] **Step 1: Viết test thất bại**

Create `supabase/tests/18_crm_accounts.sql`. Fixture theo đúng pattern hermetic của repo (TRUNCATE + DELETE auth.users trong transaction, xem `15_inbox.sql`):

```sql
BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000s1','authenticated','authenticated','s1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='supervisor', status='active' WHERE id='00000000-0000-0000-0000-0000000000s1';
UPDATE public.profiles SET role='dealer', status='active', supervisor_id='00000000-0000-0000-0000-0000000000s1' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d2';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- d1 tạo 1 khách hàng
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (name, phone, source, owner_id)
VALUES ('Cô Lan', '0901000001', 'zalo', '00000000-0000-0000-0000-0000000000d1');

-- 1. auto code KH-xxxxxx
SELECT matches(
    (SELECT code FROM public.crm_accounts WHERE name='Cô Lan'),
    '^KH-\d{6}$',
    'account code auto-generated as KH-######'
);

-- 2. chủ sở hữu thấy bản ghi của mình
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'dealer d1 sees own account'
);

-- 3. d1 thêm liên hệ cho khách đó
INSERT INTO public.crm_contacts (account_id, full_name, phone, is_primary, owner_id)
SELECT id, 'Cô Lan', '0901000001', true, '00000000-0000-0000-0000-0000000000d1'
FROM public.crm_accounts WHERE name='Cô Lan';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_contacts$$,
    ARRAY[1],
    'dealer d1 sees own contact'
);

-- 4. dealer khác nhánh không thấy gì
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[0],
    'unrelated dealer d2 sees no account (RLS isolation)'
);

-- 5. d2 không sửa được bản ghi của d1
SELECT results_eq(
    $$WITH u AS (UPDATE public.crm_accounts SET name='Hack' RETURNING 1)
      SELECT count(*)::int FROM u$$,
    ARRAY[0],
    'dealer d2 cannot update d1 account'
);

-- 6. supervisor thấy khách của dealer trong nhánh
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000s1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'supervisor sees account owned by dealer in own branch'
);

-- 7. supervisor cũng thấy liên hệ của nhánh
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_contacts$$,
    ARRAY[1],
    'supervisor sees contact owned by dealer in own branch'
);

-- 8. admin thấy tất cả
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'admin sees all accounts'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy test**

```bash
supabase test db 2>&1 | tail -25
```

Expected: `18_crm_accounts.sql .. ok`, `Result: PASS`. Nếu assertion 5 fail vì UPDATE ném lỗi thay vì trả 0 dòng, đó là dấu hiệu policy sai — RLS UPDATE phải lọc im lặng, không raise.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/18_crm_accounts.sql
git commit -m "test(crm): pgTAP for crm_accounts/crm_contacts RLS across 3 roles"
```

---

### Task 4: Bảng `crm_opportunities`

**Files:**
- Create: `supabase/migrations/20260727120200_crm_opportunities.sql`

- [ ] **Step 1: Viết migration**

Create `supabase/migrations/20260727120200_crm_opportunities.sql`:

```sql
-- CRM cơ hội bán hàng. stage_id phải thuộc đúng pipeline của cơ hội.
-- Khi vào giai đoạn won/lost thì tự đóng (closed_at); quay lại open thì mở lại.

CREATE SEQUENCE IF NOT EXISTS public.crm_opportunity_code_seq;
GRANT USAGE, SELECT ON SEQUENCE public.crm_opportunity_code_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    pipeline text NOT NULL CHECK (pipeline IN ('b2c_device', 'b2b_dealer')),
    stage_id uuid NOT NULL REFERENCES public.crm_stages(id),
    name text NOT NULL,
    model_id uuid REFERENCES public.product_models(id) ON DELETE SET NULL,
    quantity smallint NOT NULL DEFAULT 1 CHECK (quantity > 0),
    amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    expected_close_date date NOT NULL DEFAULT (current_date + 15),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    closed_at timestamptz,
    lost_reason text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_opps_owner ON public.crm_opportunities(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_opps_stage ON public.crm_opportunities(pipeline, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_account ON public.crm_opportunities(account_id);

CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_pipeline text;
    v_forecast text;
BEGIN
    SELECT pipeline, forecast INTO v_pipeline, v_forecast
    FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_pipeline IS NULL THEN
        RAISE EXCEPTION 'crm_opportunities: stage_id % không tồn tại', NEW.stage_id;
    END IF;
    IF v_pipeline <> NEW.pipeline THEN
        RAISE EXCEPTION 'crm_opportunities: giai đoạn thuộc pipeline %, không khớp %', v_pipeline, NEW.pipeline;
    END IF;

    IF NEW.code IS NULL THEN
        NEW.code := 'CH-' || lpad(nextval('public.crm_opportunity_code_seq')::text, 6, '0');
    END IF;

    IF v_forecast IN ('won', 'lost') THEN
        NEW.closed_at := COALESCE(NEW.closed_at, now());
    ELSE
        NEW.closed_at := NULL;
        NEW.lost_reason := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_opportunities_before_write ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_before_write
BEFORE INSERT OR UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_before_write();

DROP TRIGGER IF EXISTS crm_opportunities_set_updated_at ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_set_updated_at
BEFORE UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ghi audit khi đổi giai đoạn (dùng lại write_audit sẵn có)
CREATE OR REPLACE FUNCTION public.crm_opportunity_audit_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
        PERFORM public.write_audit(
            'crm_stage_change',
            'crm_opportunities',
            NEW.id,
            jsonb_build_object('stage_id', OLD.stage_id),
            jsonb_build_object('stage_id', NEW.stage_id)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_opportunities_audit_stage ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_audit_stage
AFTER UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_audit_stage();

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_opps_select ON public.crm_opportunities;
CREATE POLICY crm_opps_select ON public.crm_opportunities
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

DROP POLICY IF EXISTS crm_opps_insert ON public.crm_opportunities;
CREATE POLICY crm_opps_insert ON public.crm_opportunities
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_opps_update ON public.crm_opportunities;
CREATE POLICY crm_opps_update ON public.crm_opportunities
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin')
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_opps_delete ON public.crm_opportunities;
CREATE POLICY crm_opps_delete ON public.crm_opportunities
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_audit_stage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_set_account_code() FROM PUBLIC;
```

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | tail -8
```

Expected: không có `ERROR`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260727120200_crm_opportunities.sql
git commit -m "feat(crm): add crm_opportunities with pipeline guard + stage audit"
```

---

### Task 5: pgTAP cho cơ hội

**Files:**
- Test: `supabase/tests/19_crm_opportunities.sql`

- [ ] **Step 1: Viết test thất bại**

Create `supabase/tests/19_crm_opportunities.sql`:

```sql
BEGIN;
SELECT plan(6);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '0901000001', '00000000-0000-0000-0000-0000000000d1');

INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'b2c_device',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=1),
       'Cô Lan - 1 máy',
       29500000,
       '00000000-0000-0000-0000-0000000000d1';

-- 1. auto code CH-xxxxxx
SELECT matches(
    (SELECT code FROM public.crm_opportunities WHERE id='30000000-0000-0000-0000-000000000001'),
    '^CH-\d{6}$',
    'opportunity code auto-generated as CH-######'
);

-- 2. ngày kỳ vọng ngầm định = hôm nay + 15 ngày
SELECT results_eq(
    $$SELECT expected_close_date = current_date + 15
      FROM public.crm_opportunities WHERE id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[true],
    'expected_close_date defaults to today + 15 days'
);

-- 3. cơ hội đang mở thì closed_at NULL
SELECT results_eq(
    $$SELECT closed_at IS NULL FROM public.crm_opportunities
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[true],
    'open stage leaves closed_at NULL'
);

-- 4. không được gán giai đoạn của pipeline khác
-- Dùng dạng 2 tham số throws_ok(query, errcode). RAISE EXCEPTION mặc định là P0001.
-- KHÔNG truyền NULL vào throws_ok: Postgres sẽ báo "function is not unique" vì nhập nhằng overload.
SELECT throws_ok(
    $$UPDATE public.crm_opportunities
      SET stage_id = (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND sort_order=1)
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    'P0001'
);

-- 5. chuyển sang giai đoạn won thì tự đóng
UPDATE public.crm_opportunities
SET stage_id = (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='won')
WHERE id='30000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT closed_at IS NOT NULL FROM public.crm_opportunities
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[true],
    'moving to a won stage sets closed_at'
);

-- 6. đổi giai đoạn ghi audit_log
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.audit_log
      WHERE action='crm_stage_change' AND target_id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[1],
    'stage change writes one crm_stage_change audit row'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy test**

```bash
supabase test db 2>&1 | tail -25
```

Expected: `19_crm_opportunities.sql .. ok`, `Result: PASS`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/19_crm_opportunities.sql
git commit -m "test(crm): pgTAP for opportunity code, close, pipeline guard, audit"
```

---

### Task 6: Bảng `crm_activities`

**Files:**
- Create: `supabase/migrations/20260727120300_crm_activities.sql`

- [ ] **Step 1: Viết migration**

Create `supabase/migrations/20260727120300_crm_activities.sql`:

```sql
-- CRM hoạt động: nhiệm vụ / cuộc gọi / lịch hẹn. Luôn gắn với khách hàng hoặc cơ hội.

CREATE TABLE IF NOT EXISTS public.crm_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('task', 'call', 'meeting')),
    subject text NOT NULL,
    notes text,
    due_at timestamptz,
    done_at timestamptz,
    outcome text,
    account_id uuid REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_activities_needs_parent
        CHECK (account_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_owner_due
    ON public.crm_activities(owner_id, done_at, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_activities_account ON public.crm_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opp ON public.crm_activities(opportunity_id);

DROP TRIGGER IF EXISTS crm_activities_set_updated_at ON public.crm_activities;
CREATE TRIGGER crm_activities_set_updated_at
BEFORE UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_activities_select ON public.crm_activities;
CREATE POLICY crm_activities_select ON public.crm_activities
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

DROP POLICY IF EXISTS crm_activities_insert ON public.crm_activities;
CREATE POLICY crm_activities_insert ON public.crm_activities
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_activities_update ON public.crm_activities;
CREATE POLICY crm_activities_update ON public.crm_activities
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin')
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_activities_delete ON public.crm_activities;
CREATE POLICY crm_activities_delete ON public.crm_activities
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');
```

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | tail -8
```

Expected: không có `ERROR`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260727120300_crm_activities.sql
git commit -m "feat(crm): add crm_activities (task/call/meeting) with RLS"
```

---

### Task 7: pgTAP cho hoạt động

**Files:**
- Test: `supabase/tests/20_crm_activities.sql`

- [ ] **Step 1: Viết test thất bại**

Create `supabase/tests/20_crm_activities.sql`:

```sql
BEGIN;
SELECT plan(4);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d2';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '00000000-0000-0000-0000-0000000000d1');

-- 1. hoạt động không gắn khách/cơ hội bị chặn (CHECK violation = SQLSTATE 23514)
-- Dạng 2 tham số throws_ok(query, errcode); không truyền NULL để tránh nhập nhằng overload.
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, owner_id)
      VALUES ('call', 'Gọi lung tung', '00000000-0000-0000-0000-0000000000d1')$$,
    '23514'
);

-- 2. hoạt động gắn khách hàng thì tạo được
INSERT INTO public.crm_activities (kind, subject, due_at, account_id, owner_id)
VALUES ('call', 'Gọi tư vấn lần 1', now() + interval '1 day',
        '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1');
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_activities$$,
    ARRAY[1],
    'owner sees own activity'
);

-- 3. kind lạ bị chặn (CHECK violation = SQLSTATE 23514)
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, account_id, owner_id)
      VALUES ('email', 'Sai kind', '20000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-0000000000d1')$$,
    '23514'
);

-- 4. dealer khác không thấy
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_activities$$,
    ARRAY[0],
    'unrelated dealer sees no activity'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy test**

```bash
supabase test db 2>&1 | tail -25
```

Expected: `20_crm_activities.sql .. ok`, `Result: PASS`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/20_crm_activities.sql
git commit -m "test(crm): pgTAP for crm_activities constraints + RLS"
```

---

### Task 8: View cho kanban và danh sách hoạt động

**Files:**
- Create: `supabase/migrations/20260727120400_crm_views.sql`
- Test: `supabase/tests/21_crm_views.sql`

- [ ] **Step 1: Viết test thất bại**

Create `supabase/tests/21_crm_views.sql`:

```sql
BEGIN;
SELECT plan(3);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d2';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001', 'b2c_device',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=2),
       'Cô Lan - 1 máy', 29500000, '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_activities (kind, subject, account_id, owner_id)
VALUES ('task', 'Gửi tài liệu', '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000d1');

-- 1. board view trả tên khách + tên giai đoạn + tỷ lệ
SELECT results_eq(
    $$SELECT account_name, stage_name, probability
      FROM public.crm_opportunity_board
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    $$VALUES ('Cô Lan', 'Đang quan tâm', 30::smallint)$$,
    'crm_opportunity_board joins account name, stage name and probability'
);

-- 2. activity inbox trả tên khách
SELECT results_eq(
    $$SELECT account_name FROM public.crm_activity_inbox WHERE subject='Gửi tài liệu'$$,
    ARRAY['Cô Lan'],
    'crm_activity_inbox joins account name'
);

-- 3. view tôn trọng RLS của bảng gốc (security_invoker)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_opportunity_board$$,
    ARRAY[0],
    'board view is empty for unrelated dealer (security_invoker respected)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy test để chắc nó fail**

```bash
supabase test db 2>&1 | tail -20
```

Expected: FAIL — `relation "public.crm_opportunity_board" does not exist`.

- [ ] **Step 3: Viết migration**

Create `supabase/migrations/20260727120400_crm_views.sql`:

```sql
-- View đọc cho kanban + danh sách hoạt động.
-- security_invoker = true để RLS của bảng gốc vẫn áp dụng cho người gọi.

CREATE OR REPLACE VIEW public.crm_opportunity_board
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.code,
    o.name,
    o.pipeline,
    o.stage_id,
    s.name          AS stage_name,
    s.probability,
    s.forecast,
    s.sort_order,
    o.amount,
    o.quantity,
    o.expected_close_date,
    o.owner_id,
    p.full_name     AS owner_name,
    o.account_id,
    a.name          AS account_name,
    a.phone         AS account_phone,
    a.kind          AS account_kind,
    o.contact_id,
    o.model_id,
    o.order_id,
    o.closed_at,
    o.lost_reason,
    o.created_at
FROM public.crm_opportunities o
JOIN public.crm_stages   s ON s.id = o.stage_id
JOIN public.crm_accounts a ON a.id = o.account_id
LEFT JOIN public.profiles p ON p.id = o.owner_id;

CREATE OR REPLACE VIEW public.crm_activity_inbox
WITH (security_invoker = true) AS
SELECT
    ac.id,
    ac.kind,
    ac.subject,
    ac.notes,
    ac.due_at,
    ac.done_at,
    ac.outcome,
    ac.account_id,
    a.name  AS account_name,
    a.phone AS account_phone,
    ac.opportunity_id,
    o.name  AS opportunity_name,
    ac.contact_id,
    ac.owner_id,
    ac.created_at
FROM public.crm_activities ac
LEFT JOIN public.crm_accounts a ON a.id = ac.account_id
LEFT JOIN public.crm_opportunities o ON o.id = ac.opportunity_id;

GRANT SELECT ON public.crm_opportunity_board TO authenticated;
GRANT SELECT ON public.crm_activity_inbox TO authenticated;
```

- [ ] **Step 4: Chạy lại test**

```bash
supabase db reset && supabase test db 2>&1 | tail -25
```

Expected: 21 file test, `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260727120400_crm_views.sql supabase/tests/21_crm_views.sql
git commit -m "feat(crm): add board + activity inbox views with security_invoker"
```

---

### Task 9: Type TypeScript

**Files:**
- Modify: `src/lib/portal-types.ts` (thêm vào cuối file, sau `AuditEntry`)

- [ ] **Step 1: Thêm type**

Append to `src/lib/portal-types.ts`:

```ts
// ── CRM ──

export type CrmPipeline = 'b2c_device' | 'b2b_dealer';
export type CrmForecast = 'open' | 'won' | 'lost';
export type CrmAccountKind = 'customer' | 'dealer_prospect';
export type CrmActivityKind = 'task' | 'call' | 'meeting';
export type CrmSource =
  | 'website' | 'zalo' | 'facebook' | 'google_ads'
  | 'tiktok' | 'referral' | 'hotline' | 'event' | 'other';

export interface CrmStage {
  id: string;
  pipeline: CrmPipeline;
  name: string;
  probability: number;
  forecast: CrmForecast;
  sort_order: number;
  active: boolean;
}

export interface CrmAccount {
  id: string;
  code: string | null;
  kind: CrmAccountKind;
  name: string;
  is_individual: boolean;
  phone: string | null;
  email: string | null;
  zalo_phone: string | null;
  tax_code: string | null;
  province: string | null;
  address: string | null;
  source: CrmSource | null;
  referrer_profile_id: string | null;
  linked_profile_id: string | null;
  owner_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  account_id: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  zalo_phone: string | null;
  is_primary: boolean;
  do_not_call: boolean;
  do_not_email: boolean;
  owner_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmOpportunityBoardRow {
  id: string;
  code: string | null;
  name: string;
  pipeline: CrmPipeline;
  stage_id: string;
  stage_name: string;
  probability: number;
  forecast: CrmForecast;
  sort_order: number;
  amount: number;
  quantity: number;
  expected_close_date: string;
  owner_id: string;
  owner_name: string | null;
  account_id: string;
  account_name: string;
  account_phone: string | null;
  account_kind: CrmAccountKind;
  contact_id: string | null;
  model_id: string | null;
  order_id: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
}

export interface CrmActivityRow {
  id: string;
  kind: CrmActivityKind;
  subject: string;
  notes: string | null;
  due_at: string | null;
  done_at: string | null;
  outcome: string | null;
  account_id: string | null;
  account_name: string | null;
  account_phone: string | null;
  opportunity_id: string | null;
  opportunity_name: string | null;
  contact_id: string | null;
  owner_id: string;
  created_at: string;
}
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: không có lỗi mới ở `portal-types.ts` (lỗi có sẵn ở `dieu-khoan` nếu còn thì bỏ qua).

- [ ] **Step 3: Commit**

```bash
git add src/lib/portal-types.ts
git commit -m "feat(crm): add CRM entity types"
```

---

### Task 10: Hàm truy vấn CRM

**Files:**
- Modify: `src/lib/portal-queries.ts` (thêm vào cuối file)
- Test: `tests/unit/portal/crm-queries.test.ts`

- [ ] **Step 1: Viết test thất bại**

Create `tests/unit/portal/crm-queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCrmAccount, moveOpportunityStage, completeActivity } from '@/lib/portal-queries';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn(() => ({
  insert: insertMock,
  update: vi.fn(() => ({ eq: updateEqMock })),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  fromMock.mockClear();
  insertMock.mockClear();
  updateEqMock.mockClear();
});

describe('createCrmAccount', () => {
  it('inserts into crm_accounts with owner_id and trimmed name', async () => {
    await createCrmAccount({
      name: '  Cô Lan  ',
      kind: 'customer',
      phone: '0901000001',
      source: 'zalo',
      ownerId: 'owner-1',
    });
    expect(fromMock).toHaveBeenCalledWith('crm_accounts');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cô Lan', owner_id: 'owner-1', source: 'zalo' }),
    );
  });
});

describe('moveOpportunityStage', () => {
  it('updates stage_id on crm_opportunities', async () => {
    await moveOpportunityStage('opp-1', 'stage-9');
    expect(fromMock).toHaveBeenCalledWith('crm_opportunities');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'opp-1');
  });
});

describe('completeActivity', () => {
  it('sets done_at and outcome', async () => {
    await completeActivity('act-1', 'Khách hẹn gọi lại');
    expect(fromMock).toHaveBeenCalledWith('crm_activities');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'act-1');
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

```bash
npx vitest run tests/unit/portal/crm-queries.test.ts 2>&1 | tail -12
```

Expected: FAIL — `createCrmAccount is not a function` (hoặc lỗi import).

- [ ] **Step 3: Viết hàm truy vấn**

Append to `src/lib/portal-queries.ts`:

```ts
// ── CRM ──

export async function getCrmStages(): Promise<CrmStage[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_stages')
    .select('*')
    .eq('active', true)
    .order('pipeline')
    .order('sort_order');
  if (error) throw error;
  return (data as CrmStage[]) ?? [];
}

export async function getCrmAccounts(kind?: CrmAccountKind): Promise<CrmAccount[]> {
  let q = getSupabaseClient().from('crm_accounts').select('*').order('created_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data as CrmAccount[]) ?? [];
}

export interface CrmAccountInput {
  name: string;
  kind: CrmAccountKind;
  isIndividual?: boolean;
  phone?: string | null;
  email?: string | null;
  zaloPhone?: string | null;
  taxCode?: string | null;
  province?: string | null;
  address?: string | null;
  source?: CrmSource | null;
  notes?: string | null;
  ownerId: string;
}

function crmAccountRow(input: CrmAccountInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    is_individual: input.isIndividual ?? true,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    zalo_phone: input.zaloPhone?.trim() || null,
    tax_code: input.taxCode?.trim() || null,
    province: input.province?.trim() || null,
    address: input.address?.trim() || null,
    source: input.source ?? null,
    notes: input.notes?.trim() || null,
    owner_id: input.ownerId,
  };
}

export async function createCrmAccount(input: CrmAccountInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_accounts').insert(crmAccountRow(input));
  if (error) throw error;
}

export async function updateCrmAccount(id: string, input: CrmAccountInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_accounts').update(crmAccountRow(input)).eq('id', id);
  if (error) throw error;
}

export async function getCrmContacts(accountId: string): Promise<CrmContact[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_contacts')
    .select('*')
    .eq('account_id', accountId)
    .order('is_primary', { ascending: false })
    .order('created_at');
  if (error) throw error;
  return (data as CrmContact[]) ?? [];
}

export interface CrmContactInput {
  accountId: string;
  fullName: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  zaloPhone?: string | null;
  isPrimary?: boolean;
  ownerId: string;
}

export async function createCrmContact(input: CrmContactInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_contacts').insert({
    account_id: input.accountId,
    full_name: input.fullName.trim(),
    title: input.title?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    zalo_phone: input.zaloPhone?.trim() || null,
    is_primary: input.isPrimary ?? false,
    owner_id: input.ownerId,
  });
  if (error) throw error;
}

export async function deleteCrmContact(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_contacts').delete().eq('id', id);
  if (error) throw error;
}

export async function getCrmBoard(pipeline: CrmPipeline): Promise<CrmOpportunityBoardRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_opportunity_board')
    .select('*')
    .eq('pipeline', pipeline)
    .order('sort_order')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmOpportunityBoardRow[]) ?? [];
}

export interface CrmOpportunityInput {
  accountId: string;
  contactId?: string | null;
  pipeline: CrmPipeline;
  stageId: string;
  name: string;
  modelId?: string | null;
  quantity?: number;
  amount: number;
  expectedCloseDate?: string | null;
  notes?: string | null;
  ownerId: string;
}

function crmOpportunityRow(input: CrmOpportunityInput) {
  return {
    account_id: input.accountId,
    contact_id: input.contactId ?? null,
    pipeline: input.pipeline,
    stage_id: input.stageId,
    name: input.name.trim(),
    model_id: input.modelId ?? null,
    quantity: input.quantity ?? 1,
    amount: input.amount,
    ...(input.expectedCloseDate ? { expected_close_date: input.expectedCloseDate } : {}),
    notes: input.notes?.trim() || null,
    owner_id: input.ownerId,
  };
}

export async function createCrmOpportunity(input: CrmOpportunityInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_opportunities').insert(crmOpportunityRow(input));
  if (error) throw error;
}

export async function updateCrmOpportunity(id: string, input: CrmOpportunityInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_opportunities').update(crmOpportunityRow(input)).eq('id', id);
  if (error) throw error;
}

export async function moveOpportunityStage(id: string, stageId: string, lostReason?: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_opportunities')
    .update({ stage_id: stageId, lost_reason: lostReason ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function getCrmActivities(): Promise<CrmActivityRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_activity_inbox')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmActivityRow[]) ?? [];
}

export interface CrmActivityInput {
  kind: CrmActivityKind;
  subject: string;
  notes?: string | null;
  dueAt?: string | null;
  accountId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
  ownerId: string;
}

export async function createCrmActivity(input: CrmActivityInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_activities').insert({
    kind: input.kind,
    subject: input.subject.trim(),
    notes: input.notes?.trim() || null,
    due_at: input.dueAt ?? null,
    account_id: input.accountId ?? null,
    opportunity_id: input.opportunityId ?? null,
    contact_id: input.contactId ?? null,
    owner_id: input.ownerId,
  });
  if (error) throw error;
}

export async function completeActivity(id: string, outcome?: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_activities')
    .update({ done_at: new Date().toISOString(), outcome: outcome?.trim() || null })
    .eq('id', id);
  if (error) throw error;
}
```

Sửa dòng import ở đầu `src/lib/portal-queries.ts` để thêm type CRM:

```ts
import type { Order, DealerSummary, TeamMember, UnassignedDealer, FleetSummary, ProductModel, CommissionPlan, DealerCurrentCommission, PortalMessage, PayoutRow, AdminPayoutRow, AuditEntry, CrmStage, CrmAccount, CrmAccountKind, CrmSource, CrmContact, CrmPipeline, CrmOpportunityBoardRow, CrmActivityRow, CrmActivityKind } from './portal-types';
```

- [ ] **Step 4: Chạy lại test**

```bash
npx vitest run tests/unit/portal/crm-queries.test.ts 2>&1 | tail -12
npx tsc --noEmit 2>&1 | head -10
```

Expected: 3 test PASS; `tsc` không có lỗi mới.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portal-queries.ts tests/unit/portal/crm-queries.test.ts
git commit -m "feat(crm): add CRM query helpers with unit tests"
```

---

### Task 11: Logic kanban thuần (tách khỏi React)

**Files:**
- Create: `src/lib/crm-board.ts`
- Test: `tests/unit/portal/crm-board.test.ts`

- [ ] **Step 1: Viết test thất bại**

Create `tests/unit/portal/crm-board.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupByStage, sumAmount, weightedForecast } from '@/lib/crm-board';
import type { CrmOpportunityBoardRow, CrmStage } from '@/lib/portal-types';

const stages: CrmStage[] = [
  { id: 's1', pipeline: 'b2c_device', name: 'Mới tiếp nhận', probability: 10, forecast: 'open', sort_order: 1, active: true },
  { id: 's2', pipeline: 'b2c_device', name: 'Đang quan tâm', probability: 30, forecast: 'open', sort_order: 2, active: true },
  { id: 's3', pipeline: 'b2b_dealer', name: 'Mới tiếp cận', probability: 10, forecast: 'open', sort_order: 1, active: true },
];

const row = (id: string, stage_id: string, amount: number, probability: number): CrmOpportunityBoardRow => ({
  id, code: 'CH-000001', name: 'opp ' + id, pipeline: 'b2c_device', stage_id,
  stage_name: 'x', probability, forecast: 'open', sort_order: 1, amount, quantity: 1,
  expected_close_date: '2026-08-10', owner_id: 'o1', owner_name: null,
  account_id: 'a1', account_name: 'Cô Lan', account_phone: null, account_kind: 'customer',
  contact_id: null, model_id: null, order_id: null, closed_at: null, lost_reason: null,
  created_at: '2026-07-27T00:00:00Z',
});

describe('groupByStage', () => {
  it('returns one column per stage of the pipeline, in sort order', () => {
    const cols = groupByStage(stages, [row('1', 's2', 100, 30)], 'b2c_device');
    expect(cols.map(c => c.stage.id)).toEqual(['s1', 's2']);
    expect(cols[0].rows).toHaveLength(0);
    expect(cols[1].rows.map(r => r.id)).toEqual(['1']);
  });

  it('ignores opportunities whose stage belongs to another pipeline', () => {
    const cols = groupByStage(stages, [row('1', 's3', 100, 10)], 'b2c_device');
    expect(cols.every(c => c.rows.length === 0)).toBe(true);
  });
});

describe('sumAmount', () => {
  it('sums the amount column', () => {
    expect(sumAmount([row('1', 's1', 100, 10), row('2', 's1', 250, 10)])).toBe(350);
  });
});

describe('weightedForecast', () => {
  it('weights each amount by its stage probability', () => {
    expect(weightedForecast([row('1', 's1', 1000, 10), row('2', 's2', 1000, 30)])).toBe(400);
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

```bash
npx vitest run tests/unit/portal/crm-board.test.ts 2>&1 | tail -10
```

Expected: FAIL — không resolve được `@/lib/crm-board`.

- [ ] **Step 3: Viết module**

Create `src/lib/crm-board.ts`:

```ts
import type { CrmOpportunityBoardRow, CrmPipeline, CrmStage } from './portal-types';

export interface BoardColumn {
  stage: CrmStage;
  rows: CrmOpportunityBoardRow[];
}

export function groupByStage(
  stages: CrmStage[],
  rows: CrmOpportunityBoardRow[],
  pipeline: CrmPipeline,
): BoardColumn[] {
  return stages
    .filter(s => s.pipeline === pipeline)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(stage => ({ stage, rows: rows.filter(r => r.stage_id === stage.id) }));
}

export function sumAmount(rows: CrmOpportunityBoardRow[]): number {
  return rows.reduce((acc, r) => acc + Number(r.amount), 0);
}

export function weightedForecast(rows: CrmOpportunityBoardRow[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.amount) * r.probability) / 100, 0);
}
```

- [ ] **Step 4: Chạy lại test**

```bash
npx vitest run tests/unit/portal/crm-board.test.ts 2>&1 | tail -10
```

Expected: 4 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm-board.ts tests/unit/portal/crm-board.test.ts
git commit -m "feat(crm): add pure kanban grouping/forecast helpers"
```

---

### Task 12: Sub-nav CRM

**Files:**
- Create: `src/components/portal/CrmNav.tsx`

- [ ] **Step 1: Viết component**

Create `src/components/portal/CrmNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

const ITEMS = [
  { href: '/portal/crm/accounts', key: 'portal.crm.nav.accounts', icon: 'contacts' },
  { href: '/portal/crm/pipeline', key: 'portal.crm.nav.pipeline', icon: 'view_kanban' },
  { href: '/portal/crm/activities', key: 'portal.crm.nav.activities', icon: 'task_alt' },
];

export function CrmNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {ITEMS.map(it => {
        const active = pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
              active
                ? 'border-[#ff5625] bg-[#ff5625]/10 text-[#ff5625]'
                : 'border-[#3d3f41] text-[#a0a0a8] hover:text-[#e2e2e5]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{it.icon}</span>
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: không lỗi mới (key i18n chưa có sẽ render ra chính key — Task 15 thêm bản dịch).

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/CrmNav.tsx
git commit -m "feat(crm): add CRM sub-navigation component"
```

---

### Task 13: Trang khách hàng + drawer liên hệ

**Files:**
- Create: `src/components/portal/CrmAccountDrawer.tsx`
- Create: `src/app/portal/crm/accounts/page.tsx`

- [ ] **Step 1: Viết drawer**

Create `src/components/portal/CrmAccountDrawer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import {
  createCrmAccount, updateCrmAccount, getCrmContacts, createCrmContact, deleteCrmContact,
} from '@/lib/portal-queries';
import type { CrmAccount, CrmAccountKind, CrmContact, CrmSource } from '@/lib/portal-types';

const SOURCES: CrmSource[] = ['website', 'zalo', 'facebook', 'google_ads', 'tiktok', 'referral', 'hotline', 'event', 'other'];

interface Props {
  open: boolean;
  account: CrmAccount | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CrmAccountDrawer({ open, account, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CrmAccountKind>('customer');
  const [phone, setPhone] = useState('');
  const [zalo, setZalo] = useState('');
  const [email, setEmail] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [source, setSource] = useState<CrmSource | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [newContact, setNewContact] = useState({ full_name: '', phone: '', title: '' });

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setKind(account?.kind ?? 'customer');
    setPhone(account?.phone ?? '');
    setZalo(account?.zalo_phone ?? '');
    setEmail(account?.email ?? '');
    setProvince(account?.province ?? '');
    setAddress(account?.address ?? '');
    setSource(account?.source ?? '');
    setNotes(account?.notes ?? '');
    if (account) getCrmContacts(account.id).then(setContacts).catch(() => setContacts([]));
    else setContacts([]);
  }, [open, account]);

  const save = async () => {
    if (!name.trim()) { toast.error(t('portal.crm.account.name_required')); return; }
    setSaving(true);
    try {
      const input = {
        name, kind, phone, email, zaloPhone: zalo, province, address,
        source: source || null, notes, ownerId,
      };
      if (account) await updateCrmAccount(account.id, input);
      else await createCrmAccount(input);
      toast.success(t('portal.crm.account.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    if (!account || !newContact.full_name.trim()) return;
    try {
      await createCrmContact({
        accountId: account.id,
        fullName: newContact.full_name,
        phone: newContact.phone,
        title: newContact.title,
        isPrimary: contacts.length === 0,
        ownerId,
      });
      setNewContact({ full_name: '', phone: '', title: '' });
      setContacts(await getCrmContacts(account.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeContact = async (id: string) => {
    try {
      await deleteCrmContact(id);
      if (account) setContacts(await getCrmContacts(account.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[#a0a0a8]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-[#1e2022] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#e2e2e5]">
            {account ? t('portal.crm.account.edit') : t('portal.crm.account.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[#a0a0a8]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-acc-name">{t('portal.crm.account.name')}</label>
            <input id="crm-acc-name" className={field} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-kind">{t('portal.crm.account.kind')}</label>
            <select id="crm-acc-kind" className={field} value={kind} onChange={e => setKind(e.target.value as CrmAccountKind)}>
              <option value="customer">{t('portal.crm.account.kind_customer')}</option>
              <option value="dealer_prospect">{t('portal.crm.account.kind_prospect')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-acc-phone">{t('portal.crm.account.phone')}</label>
              <input id="crm-acc-phone" className={field} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="crm-acc-zalo">Zalo</label>
              <input id="crm-acc-zalo" className={field} value={zalo} onChange={e => setZalo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-email">Email</label>
            <input id="crm-acc-email" className={field} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-acc-province">{t('portal.crm.account.province')}</label>
              <input id="crm-acc-province" className={field} value={province} onChange={e => setProvince(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="crm-acc-source">{t('portal.crm.account.source')}</label>
              <select id="crm-acc-source" className={field} value={source} onChange={e => setSource(e.target.value as CrmSource | '')}>
                <option value="">—</option>
                {SOURCES.map(s => <option key={s} value={s}>{t('portal.crm.source.' + s)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-address">{t('portal.crm.account.address')}</label>
            <input id="crm-acc-address" className={field} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-acc-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-acc-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>

        {account && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-bold text-[#e2e2e5]">{t('portal.crm.contact.section')}</h3>
            <ul className="mb-3 space-y-2">
              {contacts.map(c => (
                <li key={c.id} className="flex items-center justify-between rounded-xl bg-[#282a2c] px-3 py-2">
                  <span className="text-sm text-[#e2e2e5]">
                    {c.full_name}
                    {c.title ? ` · ${c.title}` : ''}
                    {c.phone ? ` · ${c.phone}` : ''}
                    {c.is_primary ? ' ★' : ''}
                  </span>
                  <button onClick={() => removeContact(c.id)} aria-label={t('portal.crm.contact.delete')} className="text-[#a0a0a8]">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </li>
              ))}
              {contacts.length === 0 && <li className="text-sm text-[#a0a0a8]">{t('portal.crm.contact.empty')}</li>}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              <input
                className={field} placeholder={t('portal.crm.contact.name')}
                value={newContact.full_name}
                onChange={e => setNewContact({ ...newContact, full_name: e.target.value })}
              />
              <input
                className={field} placeholder={t('portal.crm.contact.title')}
                value={newContact.title}
                onChange={e => setNewContact({ ...newContact, title: e.target.value })}
              />
              <input
                className={field} placeholder={t('portal.crm.account.phone')}
                value={newContact.phone}
                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <button onClick={addContact} className="mt-2 w-full rounded-xl border border-[#3d3f41] py-2 text-sm text-[#e2e2e5]">
              {t('portal.crm.contact.add')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Viết trang danh sách**

Create `src/app/portal/crm/accounts/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmAccounts } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmAccountDrawer } from '@/components/portal/CrmAccountDrawer';
import type { CrmAccount, CrmAccountKind } from '@/lib/portal-types';

export default function CrmAccountsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmAccount[]>([]);
  const [busy, setBusy] = useState(true);
  const [kind, setKind] = useState<CrmAccountKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CrmAccount | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await getCrmAccounts());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (!needle) return true;
      return [r.name, r.phone, r.code, r.province].some(v => (v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, kind, q]);

  if (loading || !profile) return null;

  const field = 'rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[#e2e2e5]">{t('portal.crm.accounts.title')}</h1>
        <input
          className={field}
          placeholder={t('portal.crm.accounts.search')}
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label={t('portal.crm.accounts.search')}
        />
        <select className={field} value={kind} onChange={e => setKind(e.target.value as CrmAccountKind | 'all')} aria-label={t('portal.crm.account.kind')}>
          <option value="all">{t('portal.crm.accounts.all_kinds')}</option>
          <option value="customer">{t('portal.crm.account.kind_customer')}</option>
          <option value="dealer_prospect">{t('portal.crm.account.kind_prospect')}</option>
        </select>
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="rounded-xl bg-[#ff5625] px-4 py-2 font-bold text-white"
        >
          {t('portal.crm.accounts.new')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#3d3f41]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#282a2c] text-[#a0a0a8]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.accounts.col_code')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.name')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.kind')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.phone')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.province')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.source')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#a0a0a8]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#a0a0a8]">{t('portal.crm.accounts.empty')}</td></tr>
            )}
            {filtered.map(r => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-[#3d3f41] hover:bg-[#282a2c]"
                onClick={() => { setEditing(r); setDrawerOpen(true); }}
              >
                <td className="px-4 py-3 font-mono text-[#00daf3]">{r.code}</td>
                <td className="px-4 py-3 text-[#e2e2e5]">{r.name}</td>
                <td className="px-4 py-3 text-[#a0a0a8]">
                  {t(r.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect')}
                </td>
                <td className="px-4 py-3 text-[#a0a0a8]">{r.phone ?? '—'}</td>
                <td className="px-4 py-3 text-[#a0a0a8]">{r.province ?? '—'}</td>
                <td className="px-4 py-3 text-[#a0a0a8]">{r.source ? t('portal.crm.source.' + r.source) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CrmAccountDrawer
        open={drawerOpen}
        account={editing}
        ownerId={profile.id}
        onClose={() => setDrawerOpen(false)}
        onSaved={load}
      />
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify type-check + chạy dev server**

```bash
npx tsc --noEmit 2>&1 | head -10
npm run dev &
sleep 12
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portal/crm/accounts
```

Expected: `tsc` không lỗi mới; curl in `200`.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/CrmAccountDrawer.tsx src/app/portal/crm/accounts/page.tsx
git commit -m "feat(crm): add accounts list page with account+contacts drawer"
```

---

### Task 14: Trang kanban cơ hội

**Files:**
- Create: `src/components/portal/CrmOpportunityDrawer.tsx`
- Create: `src/app/portal/crm/pipeline/page.tsx`

- [ ] **Step 1: Viết drawer cơ hội**

Create `src/components/portal/CrmOpportunityDrawer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { createCrmOpportunity, updateCrmOpportunity, getCrmAccounts, getActiveModels } from '@/lib/portal-queries';
import type { CrmAccount, CrmOpportunityBoardRow, CrmPipeline, CrmStage, ProductModel } from '@/lib/portal-types';

interface Props {
  open: boolean;
  pipeline: CrmPipeline;
  stages: CrmStage[];
  row: CrmOpportunityBoardRow | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CrmOpportunityDrawer({ open, pipeline, stages, row, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [accountId, setAccountId] = useState('');
  const [stageId, setStageId] = useState('');
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(0);
  const [closeDate, setCloseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const pipelineStages = stages.filter(s => s.pipeline === pipeline).sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (!open) return;
    void getCrmAccounts().then(setAccounts).catch(() => setAccounts([]));
    void getActiveModels().then(setModels).catch(() => setModels([]));
    setAccountId(row?.account_id ?? '');
    setStageId(row?.stage_id ?? pipelineStages[0]?.id ?? '');
    setName(row?.name ?? '');
    setModelId(row?.model_id ?? '');
    setQuantity(row?.quantity ?? 1);
    setAmount(row ? Number(row.amount) : 0);
    setCloseDate(row?.expected_close_date ?? '');
    setNotes('');
  }, [open, row, pipeline]);

  const save = async () => {
    if (!accountId) { toast.error(t('portal.crm.opp.account_required')); return; }
    if (!name.trim()) { toast.error(t('portal.crm.opp.name_required')); return; }
    setSaving(true);
    try {
      const input = {
        accountId, pipeline, stageId, name,
        modelId: modelId || null, quantity, amount,
        expectedCloseDate: closeDate || null, notes, ownerId,
      };
      if (row) await updateCrmOpportunity(row.id, input);
      else await createCrmOpportunity(input);
      toast.success(t('portal.crm.opp.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[#a0a0a8]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-[#1e2022] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#e2e2e5]">
            {row ? t('portal.crm.opp.edit') : t('portal.crm.opp.new')}
          </h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[#a0a0a8]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-opp-account">{t('portal.crm.opp.account')}</label>
            <select id="crm-opp-account" className={field} value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="crm-opp-name">{t('portal.crm.opp.name')}</label>
            <input id="crm-opp-name" className={field} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-opp-stage">{t('portal.crm.opp.stage')}</label>
            <select id="crm-opp-stage" className={field} value={stageId} onChange={e => setStageId(e.target.value)}>
              {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name} · {s.probability}%</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-opp-model">{t('portal.crm.opp.model')}</label>
              <select id="crm-opp-model" className={field} value={modelId} onChange={e => setModelId(e.target.value)}>
                <option value="">—</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="crm-opp-qty">{t('portal.crm.opp.quantity')}</label>
              <input
                id="crm-opp-qty" type="number" min={1} className={field}
                value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="crm-opp-amount">{t('portal.crm.opp.amount')}</label>
              <input
                id="crm-opp-amount" type="number" min={0} step={100000} className={field}
                value={amount} onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className={label} htmlFor="crm-opp-close">{t('portal.crm.opp.close_date')}</label>
              <input id="crm-opp-close" type="date" className={field} value={closeDate} onChange={e => setCloseDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="crm-opp-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-opp-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50">
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Viết trang kanban**

Create `src/app/portal/crm/pipeline/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmBoard, getCrmStages, moveOpportunityStage } from '@/lib/portal-queries';
import { groupByStage, sumAmount, weightedForecast } from '@/lib/crm-board';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmOpportunityDrawer } from '@/components/portal/CrmOpportunityDrawer';
import type { CrmOpportunityBoardRow, CrmPipeline, CrmStage } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function CrmPipelinePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [pipeline, setPipeline] = useState<CrmPipeline>('b2c_device');
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [rows, setRows] = useState<CrmOpportunityBoardRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CrmOpportunityBoardRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  const load = useCallback(async (p: CrmPipeline) => {
    setBusy(true);
    try {
      const [s, r] = await Promise.all([getCrmStages(), getCrmBoard(p)]);
      setStages(s);
      setRows(r);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load(pipeline);
  }, [session, pipeline, load]);

  const columns = useMemo(() => groupByStage(stages, rows, pipeline), [stages, rows, pipeline]);
  const openRows = rows.filter(r => r.forecast === 'open');

  const drop = async (stageId: string) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    try {
      await moveOpportunityStage(id, stageId);
      await load(pipeline);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || !profile) return null;

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[#e2e2e5]">{t('portal.crm.pipeline.title')}</h1>
        <div className="flex rounded-xl border border-[#3d3f41] p-1">
          {(['b2c_device', 'b2b_dealer'] as CrmPipeline[]).map(p => (
            <button
              key={p}
              onClick={() => setPipeline(p)}
              className={`rounded-lg px-3 py-1.5 text-sm ${pipeline === p ? 'bg-[#ff5625] text-white' : 'text-[#a0a0a8]'}`}
            >
              {t('portal.crm.pipeline.' + p)}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="rounded-xl bg-[#ff5625] px-4 py-2 font-bold text-white"
        >
          {t('portal.crm.opp.new')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="rounded-xl bg-[#282a2c] px-4 py-2 text-[#a0a0a8]">
          {t('portal.crm.pipeline.open_count')}: <b className="text-[#e2e2e5]">{openRows.length}</b>
        </span>
        <span className="rounded-xl bg-[#282a2c] px-4 py-2 text-[#a0a0a8]">
          {t('portal.crm.pipeline.open_value')}: <b className="text-[#e2e2e5]">{fmtVnd(sumAmount(openRows))}đ</b>
        </span>
        <span className="rounded-xl bg-[#282a2c] px-4 py-2 text-[#a0a0a8]">
          {t('portal.crm.pipeline.forecast')}: <b className="text-[#00daf3]">{fmtVnd(weightedForecast(openRows))}đ</b>
        </span>
      </div>

      {busy && <p className="text-[#a0a0a8]">{t('portal.crm.common.loading')}</p>}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div
            key={col.stage.id}
            onDragOver={e => e.preventDefault()}
            onDrop={() => void drop(col.stage.id)}
            className="w-[280px] flex-shrink-0 rounded-2xl bg-[#1a1c1e] p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-[#e2e2e5]">{col.stage.name}</span>
              <span className="rounded-full bg-[#282a2c] px-2 py-0.5 text-xs text-[#a0a0a8]">
                {col.rows.length} · {col.stage.probability}%
              </span>
            </div>
            <div className="space-y-2">
              {col.rows.map(r => (
                <article
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onClick={() => { setEditing(r); setDrawerOpen(true); }}
                  className="cursor-grab rounded-xl border border-[#3d3f41] bg-[#1e2022] p-3 hover:border-[#ff5625]"
                >
                  <p className="text-sm font-semibold text-[#e2e2e5]">{r.name}</p>
                  <p className="mt-1 text-xs text-[#a0a0a8]">{r.account_name}</p>
                  <p className="mt-2 text-sm font-bold text-[#ff5625]">{fmtVnd(Number(r.amount))}đ</p>
                  <p className="mt-1 text-xs text-[#a0a0a8]">{r.expected_close_date}</p>
                </article>
              ))}
              {col.rows.length === 0 && (
                <p className="py-6 text-center text-xs text-[#a0a0a8]">{t('portal.crm.pipeline.empty_stage')}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <CrmOpportunityDrawer
        open={drawerOpen}
        pipeline={pipeline}
        stages={stages}
        row={editing}
        ownerId={profile.id}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void load(pipeline)}
      />
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -10
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portal/crm/pipeline
```

Expected: `tsc` không lỗi mới; curl in `200`.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/CrmOpportunityDrawer.tsx src/app/portal/crm/pipeline/page.tsx
git commit -m "feat(crm): add two-pipeline kanban board with drag-and-drop stage move"
```

---

### Task 15: Trang hoạt động

**Files:**
- Create: `src/components/portal/CrmActivityDrawer.tsx`
- Create: `src/app/portal/crm/activities/page.tsx`

- [ ] **Step 1: Viết drawer hoạt động**

Create `src/components/portal/CrmActivityDrawer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { createCrmActivity, getCrmAccounts } from '@/lib/portal-queries';
import type { CrmAccount, CrmActivityKind } from '@/lib/portal-types';

interface Props {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

const KINDS: CrmActivityKind[] = ['task', 'call', 'meeting'];

export function CrmActivityDrawer({ open, ownerId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [kind, setKind] = useState<CrmActivityKind>('call');
  const [subject, setSubject] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void getCrmAccounts().then(setAccounts).catch(() => setAccounts([]));
    setKind('call');
    setSubject('');
    setAccountId('');
    setDueAt('');
    setNotes('');
  }, [open]);

  const save = async () => {
    if (!accountId) { toast.error(t('portal.crm.activity.account_required')); return; }
    if (!subject.trim()) { toast.error(t('portal.crm.activity.subject_required')); return; }
    setSaving(true);
    try {
      await createCrmActivity({
        kind, subject, notes,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        accountId, ownerId,
      });
      toast.success(t('portal.crm.activity.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';
  const label = 'mb-1 block text-xs text-[#a0a0a8]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-[#1e2022] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#e2e2e5]">{t('portal.crm.activity.new')}</h2>
          <button onClick={onClose} aria-label={t('portal.crm.common.close')} className="text-[#a0a0a8]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="crm-act-kind">{t('portal.crm.activity.kind')}</label>
            <select id="crm-act-kind" className={field} value={kind} onChange={e => setKind(e.target.value as CrmActivityKind)}>
              {KINDS.map(k => <option key={k} value={k}>{t('portal.crm.activity.kind_' + k)}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="crm-act-account">{t('portal.crm.opp.account')}</label>
            <select id="crm-act-account" className={field} value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="crm-act-subject">{t('portal.crm.activity.subject')}</label>
            <input id="crm-act-subject" className={field} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-act-due">{t('portal.crm.activity.due')}</label>
            <input id="crm-act-due" type="datetime-local" className={field} value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="crm-act-notes">{t('portal.crm.account.notes')}</label>
            <textarea id="crm-act-notes" rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-[#ff5625] py-3 font-bold text-white disabled:opacity-50">
            {saving ? t('portal.crm.common.saving') : t('portal.crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Viết trang hoạt động**

Create `src/app/portal/crm/activities/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmActivities, completeActivity } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmActivityDrawer } from '@/components/portal/CrmActivityDrawer';
import type { CrmActivityRow } from '@/lib/portal-types';

type Bucket = 'overdue' | 'today' | 'upcoming' | 'done';

function bucketOf(a: CrmActivityRow, now: Date): Bucket {
  if (a.done_at) return 'done';
  if (!a.due_at) return 'upcoming';
  const due = new Date(a.due_at);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (due < now) return 'overdue';
  if (due <= endOfToday) return 'today';
  return 'upcoming';
}

export default function CrmActivitiesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmActivityRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<Bucket>('today');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await getCrmActivities());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const buckets = useMemo(() => {
    const now = new Date();
    const acc: Record<Bucket, CrmActivityRow[]> = { overdue: [], today: [], upcoming: [], done: [] };
    rows.forEach(r => acc[bucketOf(r, now)].push(r));
    return acc;
  }, [rows]);

  const done = async (id: string) => {
    try {
      await completeActivity(id);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || !profile) return null;

  const TABS: Bucket[] = ['overdue', 'today', 'upcoming', 'done'];

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[#e2e2e5]">{t('portal.crm.activities.title')}</h1>
        <button onClick={() => setDrawerOpen(true)} className="rounded-xl bg-[#ff5625] px-4 py-2 font-bold text-white">
          {t('portal.crm.activity.new')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(b => (
          <button
            key={b}
            onClick={() => setTab(b)}
            className={`rounded-xl px-4 py-2 text-sm ${tab === b ? 'bg-[#ff5625] text-white' : 'bg-[#282a2c] text-[#a0a0a8]'}`}
          >
            {t('portal.crm.activities.' + b)} ({buckets[b].length})
          </button>
        ))}
      </div>

      {busy && <p className="text-[#a0a0a8]">{t('portal.crm.common.loading')}</p>}

      <ul className="space-y-2">
        {buckets[tab].map(a => (
          <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-[#3d3f41] bg-[#1e2022] p-4">
            <span className="material-symbols-outlined text-[20px] text-[#00daf3]">
              {a.kind === 'call' ? 'call' : a.kind === 'meeting' ? 'event' : 'task_alt'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#e2e2e5]">{a.subject}</p>
              <p className="mt-1 text-xs text-[#a0a0a8]">
                {a.account_name ?? a.opportunity_name ?? '—'}
                {a.due_at ? ` · ${new Date(a.due_at).toLocaleString('vi-VN')}` : ''}
              </p>
              {a.notes && <p className="mt-2 text-xs text-[#a0a0a8]">{a.notes}</p>}
            </div>
            {!a.done_at && (
              <button
                onClick={() => void done(a.id)}
                className="rounded-xl border border-[#3d3f41] px-3 py-1.5 text-xs text-[#e2e2e5] hover:border-[#ff5625]"
              >
                {t('portal.crm.activity.mark_done')}
              </button>
            )}
          </li>
        ))}
        {!busy && buckets[tab].length === 0 && (
          <li className="rounded-2xl border border-[#3d3f41] p-6 text-center text-sm text-[#a0a0a8]">
            {t('portal.crm.activities.empty')}
          </li>
        )}
      </ul>

      <CrmActivityDrawer open={drawerOpen} ownerId={profile.id} onClose={() => setDrawerOpen(false)} onSaved={load} />
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -10
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portal/crm/activities
```

Expected: `tsc` không lỗi mới; curl in `200`.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/CrmActivityDrawer.tsx src/app/portal/crm/activities/page.tsx
git commit -m "feat(crm): add activities page with overdue/today/upcoming buckets"
```

---

### Task 16: Gắn nav + bản dịch

**Files:**
- Modify: `src/components/portal/PortalShell.tsx:39-57`
- Modify: `src/lib/translations/vi.ts` (khối `portal.shell.nav.*`, quanh dòng 533-547)
- Modify: `src/lib/translations/en.ts` (cùng khối)

- [ ] **Step 1: Thêm mục CRM vào cả 3 nav**

Trong `src/components/portal/PortalShell.tsx`, thêm 1 dòng vào mỗi mảng nav — admin (sau dòng `/portal/admin/orders`), dealer (sau `/portal/dashboard`), supervisor (sau `/portal/supervisor`):

```tsx
      { href: '/portal/crm', label: t('portal.shell.nav.crm'), icon: 'contacts' },
```

- [ ] **Step 2: Chuyển `/portal/crm` sang trang khách hàng**

Create `src/app/portal/crm/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CrmIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/portal/crm/accounts');
  }, [router]);
  return null;
}
```

- [ ] **Step 3: Thêm key i18n**

Trong `src/lib/translations/vi.ts`, thêm ngay sau dòng `'portal.shell.nav.profile': 'Tài khoản',`:

```ts
    'portal.shell.nav.crm': 'CRM',
    'portal.crm.nav.accounts': 'Khách hàng',
    'portal.crm.nav.pipeline': 'Cơ hội',
    'portal.crm.nav.activities': 'Hoạt động',
    'portal.crm.common.save': 'Lưu',
    'portal.crm.common.saving': 'Đang lưu…',
    'portal.crm.common.close': 'Đóng',
    'portal.crm.common.loading': 'Đang tải…',
    'portal.crm.accounts.title': 'Khách hàng',
    'portal.crm.accounts.search': 'Tìm tên, số điện thoại, mã…',
    'portal.crm.accounts.all_kinds': 'Tất cả loại',
    'portal.crm.accounts.new': 'Thêm khách hàng',
    'portal.crm.accounts.empty': 'Chưa có khách hàng nào',
    'portal.crm.accounts.col_code': 'Mã',
    'portal.crm.account.new': 'Thêm khách hàng',
    'portal.crm.account.edit': 'Sửa khách hàng',
    'portal.crm.account.name': 'Tên khách hàng',
    'portal.crm.account.name_required': 'Phải nhập tên khách hàng',
    'portal.crm.account.saved': 'Đã lưu khách hàng',
    'portal.crm.account.kind': 'Loại',
    'portal.crm.account.kind_customer': 'Khách mua máy',
    'portal.crm.account.kind_prospect': 'Đại lý tiềm năng',
    'portal.crm.account.phone': 'Điện thoại',
    'portal.crm.account.province': 'Tỉnh/Thành phố',
    'portal.crm.account.address': 'Địa chỉ',
    'portal.crm.account.source': 'Nguồn gốc',
    'portal.crm.account.notes': 'Ghi chú',
    'portal.crm.source.website': 'Website',
    'portal.crm.source.zalo': 'Zalo',
    'portal.crm.source.facebook': 'Facebook',
    'portal.crm.source.google_ads': 'Google Ads',
    'portal.crm.source.tiktok': 'TikTok',
    'portal.crm.source.referral': 'Giới thiệu',
    'portal.crm.source.hotline': 'Hotline',
    'portal.crm.source.event': 'Sự kiện',
    'portal.crm.source.other': 'Khác',
    'portal.crm.contact.section': 'Liên hệ',
    'portal.crm.contact.empty': 'Chưa có liên hệ',
    'portal.crm.contact.add': 'Thêm liên hệ',
    'portal.crm.contact.name': 'Họ tên',
    'portal.crm.contact.title': 'Chức danh',
    'portal.crm.contact.delete': 'Xoá liên hệ',
    'portal.crm.pipeline.title': 'Cơ hội bán hàng',
    'portal.crm.pipeline.b2c_device': 'Bán máy',
    'portal.crm.pipeline.b2b_dealer': 'Tuyển đại lý',
    'portal.crm.pipeline.open_count': 'Cơ hội đang mở',
    'portal.crm.pipeline.open_value': 'Giá trị đang mở',
    'portal.crm.pipeline.forecast': 'Dự báo theo tỷ lệ',
    'portal.crm.pipeline.empty_stage': 'Trống',
    'portal.crm.opp.new': 'Thêm cơ hội',
    'portal.crm.opp.edit': 'Sửa cơ hội',
    'portal.crm.opp.account': 'Khách hàng',
    'portal.crm.opp.account_required': 'Phải chọn khách hàng',
    'portal.crm.opp.name': 'Tên cơ hội',
    'portal.crm.opp.name_required': 'Phải nhập tên cơ hội',
    'portal.crm.opp.stage': 'Giai đoạn',
    'portal.crm.opp.model': 'Sản phẩm',
    'portal.crm.opp.quantity': 'Số lượng',
    'portal.crm.opp.amount': 'Giá trị (đ)',
    'portal.crm.opp.close_date': 'Ngày kỳ vọng',
    'portal.crm.opp.saved': 'Đã lưu cơ hội',
    'portal.crm.activities.title': 'Hoạt động',
    'portal.crm.activities.overdue': 'Quá hạn',
    'portal.crm.activities.today': 'Hôm nay',
    'portal.crm.activities.upcoming': 'Sắp tới',
    'portal.crm.activities.done': 'Đã xong',
    'portal.crm.activities.empty': 'Không có hoạt động nào',
    'portal.crm.activity.new': 'Thêm hoạt động',
    'portal.crm.activity.kind': 'Loại',
    'portal.crm.activity.kind_task': 'Nhiệm vụ',
    'portal.crm.activity.kind_call': 'Cuộc gọi',
    'portal.crm.activity.kind_meeting': 'Lịch hẹn',
    'portal.crm.activity.subject': 'Nội dung',
    'portal.crm.activity.subject_required': 'Phải nhập nội dung',
    'portal.crm.activity.account_required': 'Phải chọn khách hàng',
    'portal.crm.activity.due': 'Hạn',
    'portal.crm.activity.mark_done': 'Xong',
    'portal.crm.activity.saved': 'Đã lưu hoạt động',
```

Trong `src/lib/translations/en.ts`, thêm cùng vị trí bản tiếng Anh (giữ nguyên thứ tự key):

```ts
    'portal.shell.nav.crm': 'CRM',
    'portal.crm.nav.accounts': 'Customers',
    'portal.crm.nav.pipeline': 'Opportunities',
    'portal.crm.nav.activities': 'Activities',
    'portal.crm.common.save': 'Save',
    'portal.crm.common.saving': 'Saving…',
    'portal.crm.common.close': 'Close',
    'portal.crm.common.loading': 'Loading…',
    'portal.crm.accounts.title': 'Customers',
    'portal.crm.accounts.search': 'Search name, phone, code…',
    'portal.crm.accounts.all_kinds': 'All types',
    'portal.crm.accounts.new': 'New customer',
    'portal.crm.accounts.empty': 'No customers yet',
    'portal.crm.accounts.col_code': 'Code',
    'portal.crm.account.new': 'New customer',
    'portal.crm.account.edit': 'Edit customer',
    'portal.crm.account.name': 'Customer name',
    'portal.crm.account.name_required': 'Customer name is required',
    'portal.crm.account.saved': 'Customer saved',
    'portal.crm.account.kind': 'Type',
    'portal.crm.account.kind_customer': 'Device buyer',
    'portal.crm.account.kind_prospect': 'Dealer prospect',
    'portal.crm.account.phone': 'Phone',
    'portal.crm.account.province': 'Province/City',
    'portal.crm.account.address': 'Address',
    'portal.crm.account.source': 'Source',
    'portal.crm.account.notes': 'Notes',
    'portal.crm.source.website': 'Website',
    'portal.crm.source.zalo': 'Zalo',
    'portal.crm.source.facebook': 'Facebook',
    'portal.crm.source.google_ads': 'Google Ads',
    'portal.crm.source.tiktok': 'TikTok',
    'portal.crm.source.referral': 'Referral',
    'portal.crm.source.hotline': 'Hotline',
    'portal.crm.source.event': 'Event',
    'portal.crm.source.other': 'Other',
    'portal.crm.contact.section': 'Contacts',
    'portal.crm.contact.empty': 'No contacts',
    'portal.crm.contact.add': 'Add contact',
    'portal.crm.contact.name': 'Full name',
    'portal.crm.contact.title': 'Job title',
    'portal.crm.contact.delete': 'Delete contact',
    'portal.crm.pipeline.title': 'Sales opportunities',
    'portal.crm.pipeline.b2c_device': 'Device sales',
    'portal.crm.pipeline.b2b_dealer': 'Dealer recruiting',
    'portal.crm.pipeline.open_count': 'Open opportunities',
    'portal.crm.pipeline.open_value': 'Open value',
    'portal.crm.pipeline.forecast': 'Weighted forecast',
    'portal.crm.pipeline.empty_stage': 'Empty',
    'portal.crm.opp.new': 'New opportunity',
    'portal.crm.opp.edit': 'Edit opportunity',
    'portal.crm.opp.account': 'Customer',
    'portal.crm.opp.account_required': 'Select a customer',
    'portal.crm.opp.name': 'Opportunity name',
    'portal.crm.opp.name_required': 'Opportunity name is required',
    'portal.crm.opp.stage': 'Stage',
    'portal.crm.opp.model': 'Product',
    'portal.crm.opp.quantity': 'Quantity',
    'portal.crm.opp.amount': 'Amount (VND)',
    'portal.crm.opp.close_date': 'Expected close date',
    'portal.crm.opp.saved': 'Opportunity saved',
    'portal.crm.activities.title': 'Activities',
    'portal.crm.activities.overdue': 'Overdue',
    'portal.crm.activities.today': 'Today',
    'portal.crm.activities.upcoming': 'Upcoming',
    'portal.crm.activities.done': 'Done',
    'portal.crm.activities.empty': 'No activities',
    'portal.crm.activity.new': 'New activity',
    'portal.crm.activity.kind': 'Type',
    'portal.crm.activity.kind_task': 'Task',
    'portal.crm.activity.kind_call': 'Call',
    'portal.crm.activity.kind_meeting': 'Meeting',
    'portal.crm.activity.subject': 'Subject',
    'portal.crm.activity.subject_required': 'Subject is required',
    'portal.crm.activity.account_required': 'Select a customer',
    'portal.crm.activity.due': 'Due',
    'portal.crm.activity.mark_done': 'Done',
    'portal.crm.activity.saved': 'Activity saved',
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | head -10
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portal/crm
```

Expected: `tsc` không lỗi mới; curl in `200`.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/PortalShell.tsx src/app/portal/crm/page.tsx src/lib/translations/vi.ts src/lib/translations/en.ts
git commit -m "feat(crm): wire CRM into portal nav with vi/en translations"
```

---

### Task 17: Cổng verification (bắt buộc trước khi báo xong)

**Files:** không tạo file mới — chỉ chạy và dán bằng chứng.

- [ ] **Step 1: pgTAP từ trạng thái lạnh**

```bash
supabase db reset && supabase test db 2>&1 | tail -30
```

Expected: 21 file test, dòng cuối `Result: PASS`. Ghi lại tổng số assertion.

- [ ] **Step 2: Unit test toàn bộ**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: 0 failed. Test CRM mới: `crm-board.test.ts` (4) + `crm-queries.test.ts` (3).

- [ ] **Step 3: Type-check + build thật**

```bash
npx tsc --noEmit; echo "tsc exit=$?"
npm run build 2>&1 | tail -15
```

Expected: `tsc exit=0` (trừ lỗi `dieu-khoan` có sẵn nếu còn); build thành công, có 4 route mới `/portal/crm`, `/portal/crm/accounts`, `/portal/crm/pipeline`, `/portal/crm/activities` trong danh sách output.

- [ ] **Step 4: Smoke thật trên dev server bằng seed account**

```bash
npm run dev &
sleep 12
for p in /portal/crm /portal/crm/accounts /portal/crm/pipeline /portal/crm/activities; do
  printf "%s → " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$p"
done
```

Expected: tất cả `200`.

Sau đó đăng nhập bằng seed dealer `d1@dailongai.com` / `dailong2026` trên dev server và kiểm tay theo đúng thứ tự:

1. Thêm 1 khách hàng → thấy mã `KH-000001` trong bảng.
2. Mở lại khách đó → thêm 1 liên hệ → liên hệ hiện trong drawer.
3. Sang **Cơ hội** → thêm cơ hội cho khách đó, pipeline "Bán máy" → thẻ hiện ở cột giai đoạn đầu.
4. Kéo thẻ sang cột "Đàm phán giá" → reload trang, thẻ vẫn ở cột mới.
5. Đổi tab sang "Tuyển đại lý" → bảng rỗng, 6 cột đúng tên B2B.
6. Sang **Hoạt động** → thêm cuộc gọi hạn hôm nay → hiện ở tab "Hôm nay" → bấm "Xong" → chuyển sang tab "Đã xong".
7. Đăng nhập `d2@dailongai.com` (dealer khác nhánh) → cả 3 trang CRM rỗng (chứng minh RLS).

- [ ] **Step 5: Commit + tổng kết bằng chứng**

```bash
git add -A && git commit -m "chore(crm): plan 1 verification gate evidence" --allow-empty
git push -u origin portal-crm
```

Báo cáo cho Boss phải gồm: số file/assertion pgTAP, số test vitest, `tsc exit`, danh sách route build, và kết quả 7 bước smoke ở trên. Không có output thật thì không được nói "xong".

---

## Deploy production (chỉ làm khi Boss đồng ý)

Migration production chạy qua **Supabase Management API** (không dùng MCP vì MCP cấu hình read-only):

```bash
# với mỗi file migration mới, theo thứ tự:
curl -sS -X POST \
  "https://api.supabase.com/v1/projects/gcjiiiijfeitomegnivd/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: supabase-cli/x" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" supabase/migrations/20260727120000_crm_stages.sql)"
```

Lưu ý đã học được từ Plan 1-3 cũ: Cloudflare chặn User-Agent của urllib nên phải set `User-Agent` như trên. Sau khi 5 migration chạy xong mới build + `node_modules/.bin/wrangler pages deploy out`.
