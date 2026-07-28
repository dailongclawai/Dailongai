# Portal CRM Plan 2 — Vai trò staff, hoa hồng staff, chuyển khách chéo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở CRM cho một loại tài khoản mới — **staff** (nhân viên kinh doanh của công ty) — với hoa hồng riêng tính trên giá cơ sở, luồng chuyển khách chéo B2C ↔ B2B có thưởng, và báo cáo tổng hợp chỉ admin xem được.

**Architecture:** Thêm giá trị `staff` vào enum `profile_role` và cột `profiles.staff_segment` (`b2c` | `b2b`) để biết staff phụ trách mảng nào. Tham số kinh doanh nằm trong bảng cấu hình một dòng `crm_settings` (giá cơ sở 15.000.000, 20% B2C, 10% B2B, thưởng chéo 5%). CRM đóng lại chỉ còn staff + admin — RLS của 5 bảng CRM thêm điều kiện vai trò, nav của đại lý/supervisor gỡ mục CRM. Khi cơ hội vào giai đoạn thắng, trigger sinh bản ghi `crm_staff_commissions` trạng thái `pending` **có snapshot giá cơ sở và tỷ lệ** (đổi cấu hình sau không sửa lại quá khứ); admin duyệt thì thành `payable`, chi rồi thành `paid`. Chuyển khách chéo ghi vào `crm_handovers`, và deal thắng ĐẦU TIÊN của người nhận trên khách đó sẽ tất toán handover kèm thưởng 5% chia đôi.

**Tech Stack:** Supabase Postgres 17.6 + RLS + pgTAP · Next.js 15 static export client-side · TypeScript · vitest · Tailwind.

---

## Quyết định của Boss (2026-07-28) — không được tự đổi

1. **CRM chỉ mở cho `staff` và `admin`.** Đại lý và supervisor KHÔNG thấy CRM nữa (gỡ nav + chặn ở RLS). Phần đơn hàng/hoa hồng đại lý giữ nguyên không đụng.
2. **Hoa hồng staff:** B2C = **20% giá cơ sở**, B2B = **10% giá cơ sở**.
3. **Giá cơ sở = hằng số cấu hình toàn hệ thống**, mặc định **15.000.000đ**, độc lập với giá bán thật của máy. ⇒ B2C = 3.000.000đ/deal, B2B = 1.500.000đ/deal.
4. **Chỉ admin xem được báo cáo tổng hợp.** Staff chỉ xem số của chính mình.
5. **Chuyển khách chéo:** staff B2C bắn khách thuộc mảng B2B sang staff chuyên B2B và ngược lại. Deal thành công thì trích **5% giá cơ sở = 750.000đ**, chia đôi **375.000đ mỗi người** — **cộng thêm ngoài**, không trừ vào hoa hồng người chốt. Tổng chi cho một deal B2C có chuyển khách = 20% + 5% = 25% giá cơ sở.
6. **Mốc ghi nhận:** cơ hội vào giai đoạn thắng → hoa hồng `pending`; **admin duyệt** → `payable`; admin chi → `paid`.

## Ngoài phạm vi Plan 2 (đừng làm)

Trả hoa hồng tự động qua bank · mục tiêu/KPI staff · phân bổ khách tự động cho staff · chấm điểm khách · xếp hạng staff · báo giá · bảo hành · thẻ tư vấn · workflow tự động · **bất kỳ tính năng AI nào** (Boss loại khỏi phạm vi CRM ngày 27/07/2026: không trợ lý chat, không nhập liệu bằng ngôn ngữ tự nhiên, không dự đoán/gợi ý/phát hiện trùng bằng AI).

## Bối cảnh code đã có (Plan 1, nhánh `portal-crm`)

5 bảng `crm_stages` / `crm_accounts` / `crm_contacts` / `crm_opportunities` / `crm_activities`, 2 view `crm_opportunity_board` + `crm_activity_inbox` (`security_invoker`), helper `public.crm_owner_visible(uuid)`, 3 trang `/portal/crm/{accounts,pipeline,activities}` + `CrmNav` + 3 drawer, `src/lib/crm-board.ts`, 78 key i18n vi/en.

Quy tắc RLS đã chốt ở Plan 1 và **phải giữ**: SELECT theo `crm_owner_visible(owner_id)`; ghi thì `owner_id = auth.uid() OR admin` **VÀ** phải kiểm quyền **sở hữu** bản ghi cha (`account_id` / `contact_id` / `opportunity_id`) vì khoá ngoại không chịu RLS. Vi phạm trả SQLSTATE `42501`.

Helper dùng lại, không viết lại: `public.current_role()`, `public.set_updated_at()`, `public.write_audit()`, `public.crm_owner_visible()`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `supabase/migrations/20260728100000_profile_role_staff.sql` | `ALTER TYPE profile_role ADD VALUE 'staff'` — **phải nằm riêng một file** |
| `supabase/migrations/20260728100100_staff_segment_settings.sql` | `profiles.staff_segment` + bảng `crm_settings` + RPC `admin_set_staff` |
| `supabase/migrations/20260728100200_crm_staff_only_rls.sql` | Đóng CRM lại cho staff/admin trên cả 5 bảng |
| `supabase/migrations/20260728100300_crm_handovers.sql` | Bảng `crm_handovers` + RPC `staff_handover_account` |
| `supabase/migrations/20260728100400_crm_staff_commissions.sql` | Bảng `crm_staff_commissions` + trigger sinh hoa hồng + 2 RPC admin |
| `supabase/migrations/20260728100500_crm_staff_report.sql` | View `crm_staff_report` (admin-only) |
| `supabase/tests/22_crm_staff_access.sql` | Vai trò + settings + đại lý bị chặn khỏi CRM |
| `supabase/tests/23_crm_staff_commission.sql` | Toán tiền + vòng đời pending→payable→paid |
| `supabase/tests/24_crm_handover.sql` | Chuyển khách chéo + thưởng chia đôi + chỉ tất toán một lần |
| `src/lib/portal-types.ts` (sửa) | `ProfileRole` thêm `'staff'`; type `StaffSegment`, `CrmSettings`, `CrmStaffCommission`, `CrmHandover`, `CrmStaffReportRow` |
| `src/lib/portal-queries.ts` (sửa) | `getCrmSettings`, `getMyStaffCommissions`, `handoverAccount`, `getStaffPeers`, `adminConfirmStaffDeal`, `adminPayStaffCommission`, `getCrmStaffReport`, `adminSetStaff` |
| `src/components/portal/PortalShell.tsx` (sửa) | Thêm variant `staff`; gỡ mục CRM khỏi nav đại lý + supervisor |
| `src/components/portal/CrmNav.tsx` (sửa) | Thêm mục "Hoa hồng" (staff) và "Báo cáo" (chỉ admin) |
| `src/components/portal/CrmHandoverDialog.tsx` (mới) | Chọn staff mảng đối diện để bắn khách |
| `src/app/portal/crm/commission/page.tsx` (mới) | Staff xem hoa hồng của mình; admin xem toàn bộ + duyệt/chi |
| `src/app/portal/crm/reports/page.tsx` (mới) | Báo cáo tổng hợp, **chỉ admin** |
| `src/app/portal/admin/upgrade/page.tsx` (sửa) | Thêm khối gán vai trò staff + mảng phụ trách |
| `src/lib/translations/vi.ts`, `en.ts` (sửa) | Key mới |

---

### Task 1: Thêm giá trị `staff` vào enum vai trò

**Files:** Create `supabase/migrations/20260728100000_profile_role_staff.sql`

- [ ] **Step 1: Viết migration**

```sql
-- Thêm vai trò staff (nhân viên kinh doanh của công ty).
-- PHẢI nằm riêng một file: Postgres cho ADD VALUE trong transaction nhưng
-- KHÔNG cho dùng giá trị mới trong cùng transaction đó, nên các migration sau
-- (dùng 'staff' trong policy/CHECK/seed) phải chạy ở transaction khác.
ALTER TYPE public.profile_role ADD VALUE IF NOT EXISTS 'staff';
```

- [ ] **Step 2: Apply + verify enum**

```bash
supabase db reset 2>&1 | grep -iE "^ERROR|Finished"
docker exec supabase_db_dai-long-landing psql -U postgres -d postgres -t \
  -c "SELECT string_agg(enumlabel,',' ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='profile_role';"
```

Expected: `Finished`, không ERROR; enum in ra `dealer,supervisor,admin,staff`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728100000_profile_role_staff.sql
git commit -m "feat(crm): add staff role to profile_role enum"
```

---

### Task 2: `staff_segment` + bảng cấu hình `crm_settings` + RPC gán staff

**Files:** Create `supabase/migrations/20260728100100_staff_segment_settings.sql`

- [ ] **Step 1: Viết migration**

```sql
-- Mảng phụ trách của staff + tham số kinh doanh của CRM.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS staff_segment text
        CHECK (staff_segment IS NULL OR staff_segment IN ('b2c', 'b2b'));

COMMENT ON COLUMN public.profiles.staff_segment IS
    'Mảng phụ trách, chỉ có nghĩa khi role = staff: b2c bán máy cho khách cuối, b2b tuyển/chăm đại lý';

-- Bảng cấu hình MỘT DÒNG. Khoá chính boolean CHECK (id) là mẫu single-row của Postgres.
CREATE TABLE IF NOT EXISTS public.crm_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    base_price numeric(14,2) NOT NULL DEFAULT 15000000 CHECK (base_price > 0),
    staff_rate_b2c numeric(5,4) NOT NULL DEFAULT 0.2000 CHECK (staff_rate_b2c >= 0 AND staff_rate_b2c <= 1),
    staff_rate_b2b numeric(5,4) NOT NULL DEFAULT 0.1000 CHECK (staff_rate_b2b >= 0 AND staff_rate_b2b <= 1),
    crossover_bonus_rate numeric(5,4) NOT NULL DEFAULT 0.0500 CHECK (crossover_bonus_rate >= 0 AND crossover_bonus_rate <= 1),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS crm_settings_set_updated_at ON public.crm_settings;
CREATE TRIGGER crm_settings_set_updated_at
BEFORE UPDATE ON public.crm_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- Mọi người đăng nhập đọc được (staff cần biết mình sắp nhận bao nhiêu);
-- chỉ admin sửa.
DROP POLICY IF EXISTS crm_settings_select ON public.crm_settings;
CREATE POLICY crm_settings_select ON public.crm_settings
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS crm_settings_admin_write ON public.crm_settings;
CREATE POLICY crm_settings_admin_write ON public.crm_settings
    FOR UPDATE TO authenticated
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

-- Admin gán vai trò staff + mảng phụ trách.
CREATE OR REPLACE FUNCTION public.admin_set_staff(p_user_id uuid, p_segment text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được gán vai trò staff';
    END IF;
    IF p_segment NOT IN ('b2c', 'b2b') THEN
        RAISE EXCEPTION 'Mảng phụ trách phải là b2c hoặc b2b, nhận được %', p_segment;
    END IF;

    SELECT jsonb_build_object('role', role, 'staff_segment', staff_segment)
      INTO v_before FROM public.profiles WHERE id = p_user_id;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản %', p_user_id;
    END IF;

    UPDATE public.profiles
       SET role = 'staff'::public.profile_role,
           status = 'active'::public.profile_status,
           staff_segment = p_segment,
           supervisor_id = NULL
     WHERE id = p_user_id;

    PERFORM public.write_audit('set_staff', 'profiles', p_user_id, v_before,
        jsonb_build_object('role', 'staff', 'staff_segment', p_segment));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_staff(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_staff(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff(uuid, text) TO authenticated;
```

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | grep -iE "^ERROR|Finished"
```

Expected: `Finished`, không ERROR.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728100100_staff_segment_settings.sql
git commit -m "feat(crm): add staff_segment, crm_settings config row, admin_set_staff RPC"
```

---

### Task 3: Đóng CRM lại — chỉ staff và admin

**Files:** Create `supabase/migrations/20260728100200_crm_staff_only_rls.sql`

Nguyên tắc: giữ nguyên toàn bộ chốt chặn của Plan 1, **thêm** điều kiện vai trò. Viết lại policy bằng `DROP POLICY IF EXISTS` + `CREATE POLICY` như Plan 1 đã làm.

- [ ] **Step 1: Viết migration**

```sql
-- Boss chốt 28/07/2026: CRM chỉ mở cho staff và admin.
-- Đại lý/supervisor không đọc không ghi được bản ghi CRM nào nữa.
-- Giữ nguyên chốt chặn bản ghi cha của Plan 1, chỉ THÊM điều kiện vai trò.

CREATE OR REPLACE FUNCTION public.crm_role_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.current_role() IN ('staff', 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.crm_role_allowed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_role_allowed() FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_role_allowed() TO authenticated;

-- ── crm_accounts ──
DROP POLICY IF EXISTS crm_accounts_select ON public.crm_accounts;
CREATE POLICY crm_accounts_select ON public.crm_accounts
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (
            owner_id = auth.uid()
            OR public.current_role() = 'admin'
            -- staff đã bắn khách đi vẫn theo dõi được để nhận thưởng
            OR EXISTS (
                SELECT 1 FROM public.crm_handovers h
                WHERE h.account_id = public.crm_accounts.id
                  AND h.from_staff_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS crm_accounts_insert ON public.crm_accounts;
CREATE POLICY crm_accounts_insert ON public.crm_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_accounts_update ON public.crm_accounts;
CREATE POLICY crm_accounts_update ON public.crm_accounts
    FOR UPDATE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'))
    WITH CHECK (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

DROP POLICY IF EXISTS crm_accounts_delete ON public.crm_accounts;
CREATE POLICY crm_accounts_delete ON public.crm_accounts
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

-- ── crm_contacts ──
DROP POLICY IF EXISTS crm_contacts_select ON public.crm_contacts;
CREATE POLICY crm_contacts_select ON public.crm_contacts
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_contacts_insert ON public.crm_contacts;
CREATE POLICY crm_contacts_insert ON public.crm_contacts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS crm_contacts_update ON public.crm_contacts;
CREATE POLICY crm_contacts_update ON public.crm_contacts
    FOR UPDATE TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    )
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS crm_contacts_delete ON public.crm_contacts;
CREATE POLICY crm_contacts_delete ON public.crm_contacts
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

-- ── crm_opportunities ──
DROP POLICY IF EXISTS crm_opps_select ON public.crm_opportunities;
CREATE POLICY crm_opps_select ON public.crm_opportunities
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_opps_insert ON public.crm_opportunities;
CREATE POLICY crm_opps_insert ON public.crm_opportunities
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_opps_update ON public.crm_opportunities;
CREATE POLICY crm_opps_update ON public.crm_opportunities
    FOR UPDATE TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    )
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_opps_delete ON public.crm_opportunities;
CREATE POLICY crm_opps_delete ON public.crm_opportunities
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

-- ── crm_activities ──
DROP POLICY IF EXISTS crm_activities_select ON public.crm_activities;
CREATE POLICY crm_activities_select ON public.crm_activities
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_activities_insert ON public.crm_activities;
CREATE POLICY crm_activities_insert ON public.crm_activities
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND (account_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (opportunity_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_opportunities o
            WHERE o.id = opportunity_id
              AND (o.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_activities_update ON public.crm_activities;
CREATE POLICY crm_activities_update ON public.crm_activities
    FOR UPDATE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'))
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND (account_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (opportunity_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_opportunities o
            WHERE o.id = opportunity_id
              AND (o.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_activities_delete ON public.crm_activities;
CREATE POLICY crm_activities_delete ON public.crm_activities
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));
```

⚠️ **Lưu ý thứ tự:** policy `crm_accounts_select` tham chiếu `public.crm_handovers` — bảng đó tạo ở Task 4. Policy chỉ được kiểm khi query chạy, KHÔNG kiểm lúc CREATE POLICY, nhưng `supabase db reset` sẽ chạy Task 4 sau nên phải bảo đảm **không có query nào vào `crm_accounts` giữa hai migration này** (không có, vì seed CRM không tồn tại). Nếu `db reset` báo lỗi thiếu quan hệ thì đảo thứ tự: đổi tên file Task 4 thành `...100150_...` để chạy trước.

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | grep -iE "^ERROR|Finished"
```

Expected: `Finished`, không ERROR. Nếu ERROR nói `relation "crm_handovers" does not exist` thì làm Task 4 trước rồi chạy lại.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728100200_crm_staff_only_rls.sql
git commit -m "feat(crm): restrict CRM tables to staff and admin roles"
```

---

### Task 4: Chuyển khách chéo — bảng `crm_handovers` + RPC

**Files:** Create `supabase/migrations/20260728100300_crm_handovers.sql`

- [ ] **Step 1: Viết migration**

```sql
-- Chuyển khách chéo B2C ↔ B2B giữa staff.
-- Deal thắng ĐẦU TIÊN của người nhận trên khách này sẽ tất toán handover
-- và sinh thưởng 5% giá cơ sở chia đôi (xem migration hoa hồng).

CREATE TABLE IF NOT EXISTS public.crm_handovers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    from_staff_id uuid NOT NULL REFERENCES public.profiles(id),
    to_staff_id uuid NOT NULL REFERENCES public.profiles(id),
    from_segment text NOT NULL CHECK (from_segment IN ('b2c', 'b2b')),
    to_segment text NOT NULL CHECK (to_segment IN ('b2c', 'b2b')),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    settled_at timestamptz,
    settled_opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
    CONSTRAINT crm_handovers_cross_segment CHECK (from_segment <> to_segment),
    CONSTRAINT crm_handovers_two_people CHECK (from_staff_id <> to_staff_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_handovers_account ON public.crm_handovers(account_id, settled_at);
CREATE INDEX IF NOT EXISTS idx_crm_handovers_from ON public.crm_handovers(from_staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_handovers_to ON public.crm_handovers(to_staff_id, created_at DESC);

ALTER TABLE public.crm_handovers ENABLE ROW LEVEL SECURITY;

-- Hai bên liên quan và admin đọc được; ghi CHỈ qua RPC bên dưới.
DROP POLICY IF EXISTS crm_handovers_select ON public.crm_handovers;
CREATE POLICY crm_handovers_select ON public.crm_handovers
    FOR SELECT TO authenticated
    USING (
        from_staff_id = auth.uid()
        OR to_staff_id = auth.uid()
        OR public.current_role() = 'admin'
    );

-- Bắn khách sang staff mảng đối diện. Đổi luôn chủ sở hữu khách + liên hệ,
-- người bắn vẫn đọc được khách đó nhờ policy crm_accounts_select.
CREATE OR REPLACE FUNCTION public.staff_handover_account(
    p_account_id uuid,
    p_to_staff uuid,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_from_segment text;
    v_to_segment text;
    v_owner uuid;
    v_id uuid;
BEGIN
    SELECT staff_segment INTO v_from_segment
      FROM public.profiles WHERE id = auth.uid() AND role = 'staff';
    IF v_from_segment IS NULL THEN
        RAISE EXCEPTION 'Chỉ staff có mảng phụ trách mới bắn khách được';
    END IF;

    SELECT staff_segment INTO v_to_segment
      FROM public.profiles
     WHERE id = p_to_staff AND role = 'staff' AND status = 'active';
    IF v_to_segment IS NULL THEN
        RAISE EXCEPTION 'Người nhận phải là staff đang hoạt động';
    END IF;

    IF v_to_segment = v_from_segment THEN
        RAISE EXCEPTION 'Chỉ bắn khách sang staff mảng khác (% -> %)', v_from_segment, v_to_segment;
    END IF;

    SELECT owner_id INTO v_owner FROM public.crm_accounts WHERE id = p_account_id;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy khách hàng %', p_account_id;
    END IF;
    IF v_owner <> auth.uid() THEN
        RAISE EXCEPTION 'Chỉ bắn được khách của chính mình';
    END IF;

    INSERT INTO public.crm_handovers
        (account_id, from_staff_id, to_staff_id, from_segment, to_segment, note)
    VALUES (p_account_id, auth.uid(), p_to_staff, v_from_segment, v_to_segment, p_note)
    RETURNING id INTO v_id;

    UPDATE public.crm_accounts SET owner_id = p_to_staff WHERE id = p_account_id;
    UPDATE public.crm_contacts SET owner_id = p_to_staff WHERE account_id = p_account_id;

    PERFORM public.write_audit('crm_handover', 'crm_accounts', p_account_id,
        jsonb_build_object('owner_id', v_owner),
        jsonb_build_object('owner_id', p_to_staff, 'handover_id', v_id));

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) TO authenticated;
```

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | grep -iE "^ERROR|Finished"
```

Expected: `Finished`, không ERROR.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728100300_crm_handovers.sql
git commit -m "feat(crm): add cross-segment account handover between staff"
```

---

### Task 5: Hoa hồng staff — bảng, trigger, 2 RPC admin

**Files:** Create `supabase/migrations/20260728100400_crm_staff_commissions.sql`

Toán tiền với cấu hình mặc định (giá cơ sở 15.000.000): B2C closer 20% = **3.000.000**; B2B closer 10% = **1.500.000**; thưởng chéo 5% = 750.000 chia đôi = **375.000 mỗi người**.

- [ ] **Step 1: Viết migration**

```sql
-- Hoa hồng staff. Snapshot base_price + rate vào từng dòng để đổi cấu hình
-- sau này KHÔNG viết lại quá khứ.
-- Vòng đời: pending (cơ hội thắng) -> payable (admin duyệt) -> paid (đã chi).

CREATE TABLE IF NOT EXISTS public.crm_staff_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES public.profiles(id),
    role_in_deal text NOT NULL CHECK (role_in_deal IN ('closer', 'referrer')),
    pipeline text NOT NULL CHECK (pipeline IN ('b2c_device', 'b2b_dealer')),
    base_price numeric(14,2) NOT NULL CHECK (base_price > 0),
    rate numeric(5,4) NOT NULL CHECK (rate > 0 AND rate <= 1),
    amount numeric(14,2) NOT NULL CHECK (amount >= 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'payable', 'paid', 'void')),
    handover_id uuid REFERENCES public.crm_handovers(id) ON DELETE SET NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    confirmed_at timestamptz,
    confirmed_by uuid REFERENCES public.profiles(id),
    paid_at timestamptz,
    payment_ref text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- một cơ hội chỉ sinh một dòng cho mỗi người ở mỗi vai trò
    UNIQUE (opportunity_id, staff_id, role_in_deal)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_comm_staff
    ON public.crm_staff_commissions(staff_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_staff_comm_status
    ON public.crm_staff_commissions(status, created_at DESC);

DROP TRIGGER IF EXISTS crm_staff_commissions_set_updated_at ON public.crm_staff_commissions;
CREATE TRIGGER crm_staff_commissions_set_updated_at
BEFORE UPDATE ON public.crm_staff_commissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_staff_commissions ENABLE ROW LEVEL SECURITY;

-- Staff chỉ xem của mình; admin xem tất cả. Ghi CHỈ qua trigger/RPC.
DROP POLICY IF EXISTS crm_staff_comm_select ON public.crm_staff_commissions;
CREATE POLICY crm_staff_comm_select ON public.crm_staff_commissions
    FOR SELECT TO authenticated
    USING (staff_id = auth.uid() OR public.current_role() = 'admin');

-- Cơ hội vào giai đoạn thắng -> sinh hoa hồng người chốt + (nếu có handover
-- chưa tất toán) thưởng chéo chia đôi.
CREATE OR REPLACE FUNCTION public.crm_opportunity_accrue_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_forecast text;
    v_cfg public.crm_settings;
    v_rate numeric(5,4);
    v_bonus_total numeric(14,2);
    v_bonus_each numeric(14,2);
    v_handover public.crm_handovers;
    v_owner_role public.profile_role;
BEGIN
    SELECT forecast INTO v_forecast FROM public.crm_stages WHERE id = NEW.stage_id;
    IF v_forecast <> 'won' THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_owner_role FROM public.profiles WHERE id = NEW.owner_id;
    IF v_owner_role <> 'staff' THEN
        RETURN NEW;   -- admin tự chốt hộ thì không phát sinh hoa hồng
    END IF;

    SELECT * INTO v_cfg FROM public.crm_settings WHERE id;
    v_rate := CASE NEW.pipeline
                  WHEN 'b2c_device' THEN v_cfg.staff_rate_b2c
                  ELSE v_cfg.staff_rate_b2b
              END;

    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, role_in_deal, pipeline, base_price, rate, amount, order_id)
    VALUES (NEW.id, NEW.owner_id, 'closer', NEW.pipeline,
            v_cfg.base_price, v_rate,
            round(v_cfg.base_price * v_rate, 2), NEW.order_id)
    ON CONFLICT (opportunity_id, staff_id, role_in_deal) DO NOTHING;

    -- thưởng chuyển khách chéo: handover chưa tất toán, người nhận đúng là
    -- chủ cơ hội này
    SELECT * INTO v_handover
      FROM public.crm_handovers h
     WHERE h.account_id = NEW.account_id
       AND h.settled_at IS NULL
       AND h.to_staff_id = NEW.owner_id
     ORDER BY h.created_at
     LIMIT 1;

    IF v_handover.id IS NOT NULL THEN
        v_bonus_total := round(v_cfg.base_price * v_cfg.crossover_bonus_rate, 2);
        v_bonus_each := round(v_bonus_total / 2, 2);

        INSERT INTO public.crm_staff_commissions
            (opportunity_id, staff_id, role_in_deal, pipeline, base_price, rate, amount, handover_id, order_id)
        VALUES
            (NEW.id, v_handover.from_staff_id, 'referrer', NEW.pipeline,
             v_cfg.base_price, v_cfg.crossover_bonus_rate / 2, v_bonus_each, v_handover.id, NEW.order_id),
            (NEW.id, v_handover.to_staff_id, 'referrer', NEW.pipeline,
             v_cfg.base_price, v_cfg.crossover_bonus_rate / 2, v_bonus_each, v_handover.id, NEW.order_id)
        ON CONFLICT (opportunity_id, staff_id, role_in_deal) DO NOTHING;

        UPDATE public.crm_handovers
           SET settled_at = now(), settled_opportunity_id = NEW.id
         WHERE id = v_handover.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_opportunities_accrue_commission ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_accrue_commission
AFTER INSERT OR UPDATE OF stage_id ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_accrue_commission();

-- Admin duyệt: pending -> payable (kèm gắn đơn hàng nếu có)
CREATE OR REPLACE FUNCTION public.admin_confirm_staff_deal(
    p_opportunity_id uuid,
    p_order_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được duyệt hoa hồng staff';
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'payable',
           confirmed_at = now(),
           confirmed_by = auth.uid(),
           order_id = COALESCE(p_order_id, order_id)
     WHERE opportunity_id = p_opportunity_id
       AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.write_audit('confirm_staff_deal', 'crm_staff_commissions', p_opportunity_id,
        NULL, jsonb_build_object('rows', v_count, 'order_id', p_order_id));
    RETURN v_count;
END;
$$;

-- Admin chi: payable -> paid
CREATE OR REPLACE FUNCTION public.admin_pay_staff_commission(
    p_commission_id uuid,
    p_payment_ref text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được chi hoa hồng staff';
    END IF;

    SELECT jsonb_build_object('status', status, 'amount', amount)
      INTO v_before FROM public.crm_staff_commissions WHERE id = p_commission_id;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy dòng hoa hồng %', p_commission_id;
    END IF;
    IF v_before->>'status' <> 'payable' THEN
        RAISE EXCEPTION 'Chỉ chi được dòng đang ở trạng thái payable, hiện tại %', v_before->>'status';
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'paid', paid_at = now(), payment_ref = p_payment_ref
     WHERE id = p_commission_id;

    PERFORM public.write_audit('pay_staff_commission', 'crm_staff_commissions', p_commission_id,
        v_before, jsonb_build_object('status', 'paid', 'payment_ref', p_payment_ref));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_accrue_commission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_staff_deal(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_staff_deal(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_staff_deal(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_pay_staff_commission(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_pay_staff_commission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_pay_staff_commission(uuid, text) TO authenticated;
```

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | grep -iE "^ERROR|Finished"
```

Expected: `Finished`, không ERROR.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728100400_crm_staff_commissions.sql
git commit -m "feat(crm): accrue staff commission on won deals with crossover bonus"
```

---

### Task 6: Báo cáo tổng hợp chỉ admin

**Files:** Create `supabase/migrations/20260728100500_crm_staff_report.sql`

- [ ] **Step 1: Viết migration**

```sql
-- Báo cáo tổng hợp theo staff. CHỈ ADMIN (Boss chốt 28/07/2026).
-- KHÔNG dùng security_invoker: view này cố tình đọc xuyên RLS, nên tự chặn
-- bằng điều kiện vai trò trong thân view — không phải admin thì trả 0 dòng.

CREATE OR REPLACE VIEW public.crm_staff_report AS
SELECT
    p.id                                     AS staff_id,
    p.full_name                              AS staff_name,
    p.email                                  AS staff_email,
    p.staff_segment,
    count(DISTINCT o.id) FILTER (WHERE s.forecast = 'won')   AS deals_won,
    count(DISTINCT o.id) FILTER (WHERE s.forecast = 'open')  AS deals_open,
    coalesce(sum(c.amount) FILTER (WHERE c.role_in_deal = 'closer'), 0)   AS commission_closer,
    coalesce(sum(c.amount) FILTER (WHERE c.role_in_deal = 'referrer'), 0) AS commission_referral,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'pending'), 0)  AS amount_pending,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'payable'), 0)  AS amount_payable,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'paid'), 0)     AS amount_paid
FROM public.profiles p
LEFT JOIN public.crm_opportunities o ON o.owner_id = p.id
LEFT JOIN public.crm_stages s ON s.id = o.stage_id
LEFT JOIN public.crm_staff_commissions c ON c.staff_id = p.id
WHERE p.role = 'staff'
  AND public.current_role() = 'admin'
GROUP BY p.id, p.full_name, p.email, p.staff_segment;

GRANT SELECT ON public.crm_staff_report TO authenticated;
```

- [ ] **Step 2: Apply**

```bash
supabase db reset 2>&1 | grep -iE "^ERROR|Finished"
```

Expected: `Finished`, không ERROR.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728100500_crm_staff_report.sql
git commit -m "feat(crm): add admin-only staff report view"
```

---

### Task 7: pgTAP — vai trò, cấu hình, chặn đại lý khỏi CRM

**Files:** Create `supabase/tests/22_crm_staff_access.sql`

- [ ] **Step 1: Viết test**

```sql
BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- 1. cấu hình mặc định đúng con số Boss chốt
SELECT results_eq(
    $$SELECT base_price, staff_rate_b2c, staff_rate_b2b, crossover_bonus_rate
      FROM public.crm_settings$$,
    $$VALUES (15000000::numeric(14,2), 0.2000::numeric(5,4), 0.1000::numeric(5,4), 0.0500::numeric(5,4))$$,
    'crm_settings mặc định: 15tr, 20%, 10%, 5%'
);

-- 2. admin gán được vai trò staff
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT lives_ok(
    $$SELECT public.admin_set_staff('00000000-0000-0000-0000-00000000005c', 'b2c')$$,
    'admin gán được staff b2c'
);
SELECT public.admin_set_staff('00000000-0000-0000-0000-00000000005b', 'b2b');

-- 3. dealer KHÔNG gán được staff
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT throws_ok(
    $$SELECT public.admin_set_staff('00000000-0000-0000-0000-0000000000d1', 'b2c')$$,
    'P0001'
);

-- 4. mảng phụ trách sai bị chặn
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT throws_ok(
    $$SELECT public.admin_set_staff('00000000-0000-0000-0000-00000000005c', 'b2x')$$,
    'P0001'
);

-- 5. staff tạo được khách hàng
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách của staff B2C',
        '00000000-0000-0000-0000-00000000005c');
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'staff thấy khách của mình'
);

-- 6. ĐẠI LÝ không đọc được CRM nữa
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[0],
    'dealer không đọc được crm_accounts'
);

-- 7. ĐẠI LÝ không ghi được CRM nữa
SELECT throws_ok(
    $$INSERT INTO public.crm_accounts (name, owner_id)
      VALUES ('Đại lý chen ngang', '00000000-0000-0000-0000-0000000000d1')$$,
    '42501'
);

-- 8. staff không phải admin thì báo cáo tổng hợp trả rỗng
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_report$$,
    ARRAY[0],
    'staff không xem được báo cáo tổng hợp'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy**

```bash
supabase test db 2>&1 | grep -E "22_crm|^Result"
```

Expected: `22_crm_staff_access.sql .. ok`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/22_crm_staff_access.sql
git commit -m "test(crm): staff role, settings defaults, dealers locked out of CRM"
```

---

### Task 8: pgTAP — toán tiền hoa hồng + vòng đời

**Files:** Create `supabase/tests/23_crm_staff_commission.sql`

- [ ] **Step 1: Viết test**

```sql
BEGIN;
SELECT plan(9);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách B2C', '00000000-0000-0000-0000-00000000005c');

-- cơ hội B2C ở giai đoạn mở
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a1',
       '20000000-0000-0000-0000-0000000000a1', 'b2c_device',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=1),
       'Khách B2C - 1 máy', 29500000, '00000000-0000-0000-0000-00000000005c';

-- 1. chưa thắng thì chưa có hoa hồng
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[0],
    'cơ hội đang mở chưa sinh hoa hồng'
);

-- 2. thắng B2C -> 20% của 15tr = 3.000.000
UPDATE public.crm_opportunities
   SET stage_id = (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='won')
 WHERE id = '30000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1' AND role_in_deal='closer'$$,
    ARRAY[3000000::numeric(14,2)],
    'staff B2C chốt deal nhận 20% của 15tr = 3.000.000'
);

-- 3. trạng thái ban đầu là pending
SELECT results_eq(
    $$SELECT status FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['pending'],
    'hoa hồng mới sinh ở trạng thái pending'
);

-- 4. snapshot giá cơ sở và tỷ lệ
SELECT results_eq(
    $$SELECT base_price, rate FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (15000000::numeric(14,2), 0.2000::numeric(5,4))$$,
    'dòng hoa hồng snapshot giá cơ sở + tỷ lệ'
);

-- 5. staff B2B thắng deal B2B -> 10% của 15tr = 1.500.000
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000b1', 'Đại lý tiềm năng', '00000000-0000-0000-0000-00000000005b');
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000b1',
       '20000000-0000-0000-0000-0000000000b1', 'b2b_dealer',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND forecast='won'),
       'Ký hợp tác đại lý', 0, '00000000-0000-0000-0000-00000000005b';
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'$$,
    ARRAY[1500000::numeric(14,2)],
    'staff B2B chốt deal nhận 10% của 15tr = 1.500.000'
);

-- 6. staff chỉ thấy hoa hồng của mình
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[1],
    'staff B2B chỉ thấy 1 dòng của mình'
);

-- 7. admin duyệt -> payable
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT public.admin_confirm_staff_deal('30000000-0000-0000-0000-0000000000a1', NULL)$$,
    ARRAY[1],
    'admin duyệt chuyển 1 dòng sang payable'
);

-- 8. chi khi chưa payable thì bị chặn
SELECT throws_ok(
    $$SELECT public.admin_pay_staff_commission(
        (SELECT id FROM public.crm_staff_commissions
          WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'), 'TEST')$$,
    'P0001'
);

-- 9. duyệt rồi chi được -> paid
SELECT lives_ok(
    $$SELECT public.admin_pay_staff_commission(
        (SELECT id FROM public.crm_staff_commissions
          WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'), 'CK-001')$$,
    'admin chi được dòng đã duyệt'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy**

```bash
supabase test db 2>&1 | grep -E "23_crm|^Result"
```

Expected: `23_crm_staff_commission.sql .. ok`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/23_crm_staff_commission.sql
git commit -m "test(crm): staff commission math (3M B2C, 1.5M B2B) and lifecycle"
```

---

### Task 9: pgTAP — chuyển khách chéo và thưởng chia đôi

**Files:** Create `supabase/tests/24_crm_handover.sql`

- [ ] **Step 1: Viết test**

```sql
BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005d','authenticated','authenticated','staff.b2c2@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005d';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_accounts (id, name, kind, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách hoá ra là đại lý',
        'dealer_prospect', '00000000-0000-0000-0000-00000000005c');

-- 1. không bắn được sang staff CÙNG mảng
SELECT throws_ok(
    $$SELECT public.staff_handover_account(
        '20000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000005d', NULL)$$,
    'P0001'
);

-- 2. bắn sang staff mảng đối diện thì được
SELECT lives_ok(
    $$SELECT public.staff_handover_account(
        '20000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000005b', 'Khách này mở phòng khám, chuyển B2B')$$,
    'staff B2C bắn khách sang staff B2B'
);

-- 3. chủ sở hữu khách đã đổi
SELECT results_eq(
    $$SELECT owner_id FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['00000000-0000-0000-0000-00000000005b'::uuid],
    'khách chuyển sang chủ mới'
);

-- 4. người bắn vẫn theo dõi được khách đó
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[1],
    'người bắn khách vẫn đọc được khách đã chuyển'
);

-- 5. người nhận chốt deal -> 3 dòng hoa hồng (1 closer + 2 referrer)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000b1',
       '20000000-0000-0000-0000-0000000000a1', 'b2b_dealer',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND forecast='won'),
       'Chốt hợp tác', 0, '00000000-0000-0000-0000-00000000005b';
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'$$,
    ARRAY[3],
    'deal có chuyển khách sinh 3 dòng: 1 closer + 2 thưởng'
);

-- 6. thưởng chia đôi: 5% của 15tr = 750k, mỗi người 375k
SELECT results_eq(
    $$SELECT DISTINCT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'
        AND role_in_deal='referrer'$$,
    ARRAY[375000::numeric(14,2)],
    'mỗi người nhận 375.000 (5% của 15tr chia đôi)'
);

-- 7. người chốt vẫn ăn đủ 10%, không bị trừ
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'
        AND role_in_deal='closer'$$,
    ARRAY[1500000::numeric(14,2)],
    'thưởng chéo cộng thêm, không trừ vào hoa hồng người chốt'
);

-- 8. handover đã tất toán, deal thứ hai KHÔNG thưởng nữa
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000b2',
       '20000000-0000-0000-0000-0000000000a1', 'b2b_dealer',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND forecast='won'),
       'Máy thứ hai', 0, '00000000-0000-0000-0000-00000000005b';
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b2'
        AND role_in_deal='referrer'$$,
    ARRAY[0],
    'thưởng chuyển khách chỉ tính một lần'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Chạy**

```bash
supabase test db 2>&1 | grep -E "24_crm|^Result"
```

Expected: `24_crm_handover.sql .. ok`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/24_crm_handover.sql
git commit -m "test(crm): cross-segment handover, split bonus, one-time settlement"
```

---

### Task 10: Type + hàm truy vấn

**Files:** Modify `src/lib/portal-types.ts`, `src/lib/portal-queries.ts`; create `tests/unit/portal/crm-staff.test.ts`

- [ ] **Step 1: Sửa `ProfileRole` và thêm type mới**

Trong `src/lib/portal-types.ts`, dòng 1 đổi thành:

```ts
export type ProfileRole = 'dealer' | 'supervisor' | 'admin' | 'staff';
export type StaffSegment = 'b2c' | 'b2b';
```

Thêm `staff_segment: StaffSegment | null;` vào interface `Profile` (ngay dưới `role`), và thêm vào cuối file:

```ts
export interface CrmSettings {
  base_price: number;
  staff_rate_b2c: number;
  staff_rate_b2b: number;
  crossover_bonus_rate: number;
}

export type CrmCommissionStatus = 'pending' | 'payable' | 'paid' | 'void';

export interface CrmStaffCommission {
  id: string;
  opportunity_id: string;
  staff_id: string;
  role_in_deal: 'closer' | 'referrer';
  pipeline: CrmPipeline;
  base_price: string;
  rate: string;
  amount: string;
  status: CrmCommissionStatus;
  handover_id: string | null;
  order_id: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  payment_ref: string | null;
  created_at: string;
}

export interface CrmStaffReportRow {
  staff_id: string;
  staff_name: string | null;
  staff_email: string | null;
  staff_segment: StaffSegment | null;
  deals_won: number;
  deals_open: number;
  commission_closer: string;
  commission_referral: string;
  amount_pending: string;
  amount_payable: string;
  amount_paid: string;
}

export interface StaffPeer {
  id: string;
  full_name: string | null;
  email: string | null;
  staff_segment: StaffSegment | null;
}
```

- [ ] **Step 2: Viết test thất bại**

Create `tests/unit/portal/crm-staff.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handoverAccount, adminConfirmStaffDeal, adminPayStaffCommission, adminSetStaff } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ rpc: rpcMock }) }));

beforeEach(() => rpcMock.mockClear());

describe('handoverAccount', () => {
  it('calls staff_handover_account with mapped params', async () => {
    await handoverAccount('acc-1', 'staff-2', 'ghi chú');
    expect(rpcMock).toHaveBeenCalledWith('staff_handover_account', {
      p_account_id: 'acc-1', p_to_staff: 'staff-2', p_note: 'ghi chú',
    });
  });
});

describe('adminConfirmStaffDeal', () => {
  it('calls admin_confirm_staff_deal and returns affected row count', async () => {
    const n = await adminConfirmStaffDeal('opp-1');
    expect(rpcMock).toHaveBeenCalledWith('admin_confirm_staff_deal', {
      p_opportunity_id: 'opp-1', p_order_id: null,
    });
    expect(n).toBe(1);
  });
});

describe('adminPayStaffCommission', () => {
  it('calls admin_pay_staff_commission with payment ref', async () => {
    await adminPayStaffCommission('c-1', 'CK-001');
    expect(rpcMock).toHaveBeenCalledWith('admin_pay_staff_commission', {
      p_commission_id: 'c-1', p_payment_ref: 'CK-001',
    });
  });
});

describe('adminSetStaff', () => {
  it('calls admin_set_staff with segment', async () => {
    await adminSetStaff('u-1', 'b2b');
    expect(rpcMock).toHaveBeenCalledWith('admin_set_staff', {
      p_user_id: 'u-1', p_segment: 'b2b',
    });
  });
});
```

- [ ] **Step 3: Chạy test để chắc nó fail**

```bash
npx vitest run tests/unit/portal/crm-staff.test.ts 2>&1 | tail -10
```

Expected: FAIL — `handoverAccount is not a function`.

- [ ] **Step 4: Viết hàm truy vấn**

Thêm vào cuối `src/lib/portal-queries.ts` (và bổ sung type mới vào dòng `import type` đầu file):

```ts
export async function getCrmSettings(): Promise<CrmSettings | null> {
  const { data, error } = await getSupabaseClient()
    .from('crm_settings')
    .select('base_price, staff_rate_b2c, staff_rate_b2b, crossover_bonus_rate')
    .maybeSingle();
  if (error) throw error;
  return (data as CrmSettings) ?? null;
}

export async function getStaffPeers(segment: StaffSegment): Promise<StaffPeer[]> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, email, staff_segment')
    .eq('role', 'staff')
    .eq('status', 'active')
    .eq('staff_segment', segment)
    .order('full_name');
  if (error) throw error;
  return (data as StaffPeer[]) ?? [];
}

export async function handoverAccount(accountId: string, toStaffId: string, note?: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('staff_handover_account', {
    p_account_id: accountId,
    p_to_staff: toStaffId,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function getMyStaffCommissions(): Promise<CrmStaffCommission[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_staff_commissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmStaffCommission[]) ?? [];
}

export async function adminConfirmStaffDeal(opportunityId: string, orderId?: string): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('admin_confirm_staff_deal', {
    p_opportunity_id: opportunityId,
    p_order_id: orderId ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function adminPayStaffCommission(commissionId: string, paymentRef: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_pay_staff_commission', {
    p_commission_id: commissionId,
    p_payment_ref: paymentRef,
  });
  if (error) throw error;
}

export async function adminSetStaff(userId: string, segment: StaffSegment): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_staff', {
    p_user_id: userId,
    p_segment: segment,
  });
  if (error) throw error;
}

export async function getCrmStaffReport(): Promise<CrmStaffReportRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_staff_report')
    .select('*')
    .order('staff_name');
  if (error) throw error;
  return (data as CrmStaffReportRow[]) ?? [];
}
```

- [ ] **Step 5: Chạy lại test + type-check**

```bash
npx vitest run tests/unit/portal/crm-staff.test.ts 2>&1 | tail -10
npx tsc --noEmit 2>&1 | head -20
```

Expected: 4 test PASS; `tsc` exit 0. **Nếu `tsc` báo lỗi ở chỗ khác vì `ProfileRole` thêm `'staff'`** (ví dụ `PortalShell` map `Record<Variant, …>` hoặc trang nào so sánh role), sửa đúng những chỗ đó — đó là việc của Task 11/12, ghi lại để làm.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portal-types.ts src/lib/portal-queries.ts tests/unit/portal/crm-staff.test.ts
git commit -m "feat(crm): add staff types and query helpers with unit tests"
```

---

### Task 11: Nav — thêm variant `staff`, gỡ CRM khỏi đại lý/supervisor

**Files:** Modify `src/components/portal/PortalShell.tsx`, `src/components/portal/CrmNav.tsx`

- [ ] **Step 1: Sửa `PortalShell.tsx`**

1. `type Variant = 'dealer' | 'supervisor' | 'admin';` → thêm `| 'staff'`.
2. **Xoá** dòng `{ href: '/portal/crm', … }` khỏi mảng `dealer` và mảng `supervisor` (Boss chốt CRM chỉ staff + admin). Giữ ở `admin`.
3. Thêm mảng nav mới vào object `NAV`:

```tsx
    staff: [
      { href: '/portal/crm/accounts', label: t('portal.crm.nav.accounts'), icon: 'contacts', exact: true },
      { href: '/portal/crm/pipeline', label: t('portal.crm.nav.pipeline'), icon: 'view_kanban' },
      { href: '/portal/crm/activities', label: t('portal.crm.nav.activities'), icon: 'task_alt' },
      { href: '/portal/crm/commission', label: t('portal.crm.nav.commission'), icon: 'payments' },
    ],
```

4. Nút CTA "Đơn mới" (`/portal/dealer/orders/new`) chỉ dành cho đại lý — bọc điều kiện `variant === 'dealer'` nếu chưa có.

- [ ] **Step 2: Sửa `CrmNav.tsx`**

Thêm 2 mục, mục báo cáo chỉ hiện với admin. Component cần biết vai trò: dùng `useAuth()`.

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';

const ITEMS = [
  { href: '/portal/crm/accounts', key: 'portal.crm.nav.accounts', icon: 'contacts', adminOnly: false },
  { href: '/portal/crm/pipeline', key: 'portal.crm.nav.pipeline', icon: 'view_kanban', adminOnly: false },
  { href: '/portal/crm/activities', key: 'portal.crm.nav.activities', icon: 'task_alt', adminOnly: false },
  { href: '/portal/crm/commission', key: 'portal.crm.nav.commission', icon: 'payments', adminOnly: false },
  { href: '/portal/crm/reports', key: 'portal.crm.nav.reports', icon: 'bar_chart', adminOnly: true },
];

export function CrmNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { profile } = useAuth();
  const items = ITEMS.filter(it => !it.adminOnly || profile?.role === 'admin');
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {items.map(it => {
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

- [ ] **Step 3: Chặn cả ở tầng trang**

Trong CẢ NĂM trang `/portal/crm/**` (accounts, pipeline, activities, commission, reports), sau khi có `profile`, thêm chặn vai trò:

```tsx
  useEffect(() => {
    if (!loading && profile && profile.role !== 'staff' && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);
```

Trang `/portal/crm/reports` chặn gắt hơn: `profile.role !== 'admin'` → `/portal/403`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/PortalShell.tsx src/components/portal/CrmNav.tsx src/app/portal/crm
git commit -m "feat(crm): staff nav variant, remove CRM from dealer/supervisor nav"
```

---

### Task 12: Bắn khách chéo trên drawer khách hàng

**Files:** Create `src/components/portal/CrmHandoverDialog.tsx`; modify `src/components/portal/CrmAccountDrawer.tsx`

- [ ] **Step 1: Viết dialog**

Create `src/components/portal/CrmHandoverDialog.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { getStaffPeers, handoverAccount, getCrmSettings } from '@/lib/portal-queries';
import type { StaffPeer, StaffSegment } from '@/lib/portal-types';

interface Props {
  open: boolean;
  accountId: string;
  mySegment: StaffSegment;
  onClose: () => void;
  onDone: () => void;
}

export function CrmHandoverDialog({ open, accountId, mySegment, onClose, onDone }: Props) {
  const { t } = useI18n();
  const target: StaffSegment = mySegment === 'b2c' ? 'b2b' : 'b2c';
  const [peers, setPeers] = useState<StaffPeer[]>([]);
  const [toStaff, setToStaff] = useState('');
  const [note, setNote] = useState('');
  const [bonus, setBonus] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToStaff('');
    setNote('');
    void getStaffPeers(target).then(setPeers).catch(() => setPeers([]));
    void getCrmSettings()
      .then(s => setBonus(s ? (Number(s.base_price) * Number(s.crossover_bonus_rate)) / 2 : null))
      .catch(() => setBonus(null));
  }, [open, target]);

  const submit = async () => {
    if (!toStaff) { toast.error(t('portal.crm.handover.pick_staff')); return; }
    setSaving(true);
    try {
      await handoverAccount(accountId, toStaff, note);
      toast.success(t('portal.crm.handover.done'));
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full rounded-xl border border-[#3d3f41] bg-[#1a1c1e] px-3 py-2 text-[#e2e2e5] outline-none focus:border-[#ff5625]';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#1e2022] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-[#e2e2e5]">{t('portal.crm.handover.title')}</h3>
        <p className="mb-4 text-sm text-[#a0a0a8]">
          {t(target === 'b2b' ? 'portal.crm.handover.to_b2b' : 'portal.crm.handover.to_b2c')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[#a0a0a8]" htmlFor="handover-staff">
              {t('portal.crm.handover.staff')}
            </label>
            <select id="handover-staff" className={field} value={toStaff} onChange={e => setToStaff(e.target.value)}>
              <option value="">—</option>
              {peers.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#a0a0a8]" htmlFor="handover-note">
              {t('portal.crm.handover.note')}
            </label>
            <textarea id="handover-note" rows={2} className={field} value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {bonus !== null && (
            <p className="rounded-xl bg-[#282a2c] px-3 py-2 text-xs text-[#00daf3]">
              {t('portal.crm.handover.bonus_hint')}: {new Intl.NumberFormat('vi-VN').format(bonus)}đ
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-[#3d3f41] py-2.5 text-[#e2e2e5]">
              {t('portal.crm.handover.cancel')}
            </button>
            <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-[#ff5625] py-2.5 font-bold text-white disabled:opacity-50">
              {saving ? t('portal.crm.common.saving') : t('portal.crm.handover.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Gắn vào `CrmAccountDrawer.tsx`**

Trong drawer, khi đang sửa một khách hàng đã có (`account !== null`) **và** người dùng là staff có `staff_segment`, hiện nút bắn khách ngay dưới khối liên hệ:

```tsx
        {account && profile?.role === 'staff' && profile.staff_segment && (
          <button
            onClick={() => setHandoverOpen(true)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00daf3] py-2.5 text-sm text-[#00daf3]"
          >
            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
            {t('portal.crm.handover.button')}
          </button>
        )}
        {account && profile?.role === 'staff' && profile.staff_segment && (
          <CrmHandoverDialog
            open={handoverOpen}
            accountId={account.id}
            mySegment={profile.staff_segment}
            onClose={() => setHandoverOpen(false)}
            onDone={() => { onSaved(); onClose(); }}
          />
        )}
```

Thêm `const [handoverOpen, setHandoverOpen] = useState(false);`, `const { profile } = useAuth();` và 2 import tương ứng.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/CrmHandoverDialog.tsx src/components/portal/CrmAccountDrawer.tsx
git commit -m "feat(crm): staff can hand an account to the opposite segment"
```

---

### Task 13: Trang hoa hồng staff + trang báo cáo admin

**Files:** Create `src/app/portal/crm/commission/page.tsx`, `src/app/portal/crm/reports/page.tsx`

- [ ] **Step 1: Trang hoa hồng**

`src/app/portal/crm/commission/page.tsx` — theo đúng khuôn của `src/app/portal/crm/activities/page.tsx` (`'use client'`, `useAuth`, guard vai trò staff/admin như Task 11 Step 3, `PortalShell variant={profile.role ?? 'dealer'}`, `CrmNav`), nội dung:

- Gọi `getMyStaffCommissions()`; staff thấy dòng của mình, admin thấy tất cả (RLS tự lọc).
- 4 thẻ tổng: `pending`, `payable`, `paid`, và tổng cộng — cộng `Number(amount)` theo `status`.
- Bảng: Ngày · Cơ hội (`opportunity_id` cắt 8 ký tự) · Vai trò (`closer` = "Người chốt" / `referrer` = "Thưởng chuyển khách") · Pipeline · Giá cơ sở · Tỷ lệ · Số tiền · Trạng thái (pending cam `#ff5625`, payable cyan `#00daf3`, paid xanh `#34d399`, void xám).
- Nếu `profile.role === 'admin'`: mỗi dòng `payable` có nút "Đánh dấu đã chi" → mở prompt nhập mã giao dịch → `adminPayStaffCommission(id, ref)` → reload; mỗi dòng `pending` có nút "Duyệt" → `adminConfirmStaffDeal(opportunity_id)` → reload.
- Định dạng tiền: `new Intl.NumberFormat('vi-VN').format(Math.round(n))` + `đ`.

- [ ] **Step 2: Trang báo cáo (chỉ admin)**

`src/app/portal/crm/reports/page.tsx` — cùng khuôn, guard `profile.role !== 'admin'` → `router.replace('/portal/403')`, gọi `getCrmStaffReport()`, render bảng: Nhân viên · Mảng · Deal thắng · Deal đang mở · Hoa hồng chốt · Thưởng chuyển khách · Chờ duyệt · Chờ chi · Đã chi. Thêm một dòng tổng cuối bảng. Bảng bọc trong `overflow-x-auto`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
npx next dev -p 3100 &
sleep 14
for p in /portal/crm/commission /portal/crm/reports; do printf "%s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100$p"; done
pkill -f "next dev -p 3100"
```

Expected: `tsc` exit 0; cả hai route trả `200`.

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/crm/commission src/app/portal/crm/reports
git commit -m "feat(crm): staff commission page and admin-only report page"
```

---

### Task 14: Admin gán vai trò staff + bản dịch

**Files:** Modify `src/app/portal/admin/upgrade/page.tsx`, `src/lib/translations/vi.ts`, `src/lib/translations/en.ts`

- [ ] **Step 1: Thêm khối gán staff vào trang upgrade**

Trang đã có 2 khối (nâng supervisor, hạ dealer) gọi RPC trực tiếp qua `getSupabaseClient().rpc(...)`. Thêm khối thứ ba cùng kiểu: ô nhập account ID + select mảng (`b2c` / `b2b`) + nút "Gán staff" → gọi `adminSetStaff(id, segment)` từ `@/lib/portal-queries` → `toast.success` → xoá ô nhập. Mọi input phải có `<label htmlFor>`.

- [ ] **Step 2: Thêm key i18n vào cả `vi.ts` và `en.ts`**

Chèn ngay dưới khối `portal.crm.*` đã có (vi trước, en tương ứng):

```ts
    'portal.crm.nav.commission': 'Hoa hồng',
    'portal.crm.nav.reports': 'Báo cáo',
    'portal.crm.handover.button': 'Bắn khách sang mảng khác',
    'portal.crm.handover.title': 'Chuyển khách cho staff mảng khác',
    'portal.crm.handover.to_b2b': 'Khách này thuộc mảng đại lý — chọn staff phụ trách B2B để chuyển.',
    'portal.crm.handover.to_b2c': 'Khách này thuộc mảng khách cuối — chọn staff phụ trách B2C để chuyển.',
    'portal.crm.handover.staff': 'Chuyển cho',
    'portal.crm.handover.note': 'Ghi chú cho người nhận',
    'portal.crm.handover.pick_staff': 'Phải chọn người nhận',
    'portal.crm.handover.bonus_hint': 'Nếu chốt thành công, mỗi người được thưởng',
    'portal.crm.handover.submit': 'Chuyển khách',
    'portal.crm.handover.cancel': 'Huỷ',
    'portal.crm.handover.done': 'Đã chuyển khách',
    'portal.crm.commission.title': 'Hoa hồng của tôi',
    'portal.crm.commission.pending': 'Chờ duyệt',
    'portal.crm.commission.payable': 'Chờ chi',
    'portal.crm.commission.paid': 'Đã chi',
    'portal.crm.commission.total': 'Tổng cộng',
    'portal.crm.commission.role_closer': 'Người chốt',
    'portal.crm.commission.role_referrer': 'Thưởng chuyển khách',
    'portal.crm.commission.col_date': 'Ngày',
    'portal.crm.commission.col_deal': 'Cơ hội',
    'portal.crm.commission.col_role': 'Vai trò',
    'portal.crm.commission.col_base': 'Giá cơ sở',
    'portal.crm.commission.col_rate': 'Tỷ lệ',
    'portal.crm.commission.col_amount': 'Số tiền',
    'portal.crm.commission.col_status': 'Trạng thái',
    'portal.crm.commission.empty': 'Chưa có hoa hồng nào',
    'portal.crm.commission.confirm': 'Duyệt',
    'portal.crm.commission.mark_paid': 'Đánh dấu đã chi',
    'portal.crm.commission.payment_ref': 'Mã giao dịch',
    'portal.crm.reports.title': 'Báo cáo tổng hợp',
    'portal.crm.reports.col_staff': 'Nhân viên',
    'portal.crm.reports.col_segment': 'Mảng',
    'portal.crm.reports.col_won': 'Deal thắng',
    'portal.crm.reports.col_open': 'Đang mở',
    'portal.crm.reports.col_closer': 'Hoa hồng chốt',
    'portal.crm.reports.col_referral': 'Thưởng chuyển khách',
    'portal.crm.reports.empty': 'Chưa có nhân viên kinh doanh nào',
    'portal.admin.upgrade.staff_title': 'Gán vai trò nhân viên kinh doanh',
    'portal.admin.upgrade.staff_segment': 'Mảng phụ trách',
    'portal.admin.upgrade.staff_submit': 'Gán staff',
    'portal.admin.upgrade.staff_done': 'Đã gán vai trò staff',
```

- [ ] **Step 3: Kiểm mọi key CRM đều có trong cả 2 file**

```bash
for k in $(grep -rhoE "t\('portal\.(crm|admin\.upgrade)\.[a-z_.]*'" src/components/portal/Crm*.tsx src/app/portal/crm/ src/app/portal/admin/upgrade/page.tsx | sed "s/t('//;s/'$//" | grep -v '\.$' | sort -u); do
  grep -q "'$k'" src/lib/translations/vi.ts || echo "MISSING vi: $k"
  grep -q "'$k'" src/lib/translations/en.ts || echo "MISSING en: $k"
done; echo "key check done"
```

Expected: chỉ in `key check done` (bỏ qua artifact chuỗi ghép động kết thúc bằng `_`).

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/admin/upgrade/page.tsx src/lib/translations/vi.ts src/lib/translations/en.ts
git commit -m "feat(crm): admin assigns staff role, add staff i18n keys"
```

---

### Task 15: Cổng verification (bắt buộc trước khi báo xong)

- [ ] **Step 1: pgTAP từ trạng thái lạnh**

```bash
supabase db reset && supabase test db 2>&1 | tail -30
```

Expected: 24 file test; `17`–`24` (8 file CRM) đều `ok`. Baseline cũ KHÔNG được phình: `04_rls_commissions` 2 · `05_commission_calc` 4 · `06_audit_log` abort · `08_admin_approve_fn` 1 · `09_commission_tiers` 2 · `15_inbox` 5. `Result: FAIL` tổng thể là do baseline này, không phải do Plan 2.

- [ ] **Step 2: Unit test + type-check + build**

```bash
npx vitest run 2>&1 | tail -8
npx tsc --noEmit; echo "tsc exit=$?"
npm run build 2>&1 | tail -8
```

Expected: vitest chỉ còn 1 file đỏ có sẵn `tests/unit/meo-chat-panel.test.tsx` (5 test); `tsc exit=0`; build thành công và sinh `out/portal/crm/commission.html` + `out/portal/crm/reports.html`.

- [ ] **Step 3: Smoke thật trên dev server**

Tạo 3 tài khoản test trên Supabase local (qua Studio hoặc SQL) rồi gán vai trò: `staff.b2c@dailongai.com` (staff b2c), `staff.b2b@dailongai.com` (staff b2b), dùng `admin@dailongai.com` seed sẵn. Mật khẩu seed `dailong2026`.

Kịch bản phải chạy đúng theo thứ tự:

1. Đăng nhập **staff B2C** → sidebar hiện đúng 4 mục CRM, KHÔNG có mục đơn hàng đại lý.
2. Thêm khách hàng → mở lại → bấm **"Bắn khách sang mảng khác"** → chọn staff B2B → xác nhận. Khách biến khỏi quyền sửa nhưng vẫn đọc được.
3. Đăng nhập **staff B2B** → thấy khách vừa nhận → tạo cơ hội pipeline "Tuyển đại lý" → kéo sang **"Thành đại lý"**.
4. Vào trang **Hoa hồng**: staff B2B thấy 1.500.000đ (người chốt) + 375.000đ (thưởng) đều ở `Chờ duyệt`.
5. Đăng nhập lại **staff B2C** → trang Hoa hồng thấy 375.000đ thưởng chuyển khách.
6. Đăng nhập **admin** → trang Hoa hồng bấm **Duyệt** → cả 3 dòng sang `Chờ chi` → bấm **Đánh dấu đã chi** một dòng, nhập mã → dòng đó sang `Đã chi`.
7. Admin vào **Báo cáo** → thấy 2 staff, số khớp bước 4-6. Đăng nhập staff → **không có mục Báo cáo trong nav**, vào thẳng `/portal/crm/reports` bị đẩy sang `/portal/403`.
8. Đăng nhập **đại lý d1** → sidebar KHÔNG có mục CRM; vào thẳng `/portal/crm/accounts` bị đẩy sang `/portal/403`.

- [ ] **Step 4: Multi-task verification gate (CLAUDE.md §8.5 — bắt buộc)**

Invoke skill `superpowers:verification-before-completion`, chạy lại đủ bộ chứng cứ cho stack này — `supabase test db`, `npx vitest run`, `npx tsc --noEmit`, `npm run build`, `curl` từng route CRM — và dán output thật vào câu trả lời. **Không có tool output = KHÔNG được nói "xong"/"done"/"✅".**

- [ ] **Step 5: Báo cáo bằng chứng**

Phải gồm: số file/assertion pgTAP, kết quả vitest, `tsc exit`, danh sách route mới trong `out/`, và kết quả 8 bước smoke ở trên.

---

## Deploy production (chỉ khi Boss đồng ý)

6 migration mới chạy **theo thứ tự** qua Supabase Management API (MCP là read-only), nhớ `User-Agent: supabase-cli/x` vì Cloudflare chặn urllib:

```bash
curl -sS -X POST \
  "https://api.supabase.com/v1/projects/gcjiiiijfeitomegnivd/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: supabase-cli/x" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" supabase/migrations/20260728100000_profile_role_staff.sql)"
```

⚠️ `ALTER TYPE … ADD VALUE` phải chạy **riêng một request**, xong rồi mới chạy các migration sau (Postgres không cho dùng giá trị enum mới trong cùng transaction). Sau đó build + `node_modules/.bin/wrangler pages deploy out`.
