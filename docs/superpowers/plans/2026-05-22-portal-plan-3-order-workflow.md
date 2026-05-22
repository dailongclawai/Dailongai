# Portal Plan 3 — Order Workflow (Tier Engine + Entry + Approval + Live Dashboards)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dealer→admin order lifecycle live end-to-end: dealer records a sale (with receipt upload), admin approves it, the tier-based commission engine computes dealer + supervisor payouts, and all dashboards show real Supabase data instead of mock zeros.

**Architecture:** Add a global `commission_tiers` table (Boss-chosen Tier A: 15% / 20% / 25% by YTD units) and rewrite `calc_commission()` to use it — per-dealer `dealer_commissions` rows become optional overrides, global tier is the default. Orders are inserted by dealers via a `'use client'` form posting to Supabase (RLS-gated), receipt images upload to the existing private `receipts` bucket via signed URLs. Admin approval flips `orders.status` which fires the existing trigger → commission payouts. Dashboards (dealer, supervisor, admin) replace mock data with live queries through the Supabase browser client.

**Tech Stack:** Supabase (Postgres 17 + Storage + RLS), Next.js 16 static export `/portal/**` client components, `@supabase/supabase-js`, pgTAP, Vitest, `xlsx` (SheetJS) for report export.

**Reference spec:** [docs/superpowers/specs/2026-05-21-dailongai-portal-design.md](../specs/2026-05-21-dailongai-portal-design.md)

**Prerequisite:** Plan 1 (DB foundation) + Plan 2 (auth + UI) done on branch `portal-auth`. Supabase local stack running (`docker ps | grep supabase`), `.env.local` has Supabase keys + OAuth secrets.

---

## File Structure

| File | Purpose |
|------|---------|
| `supabase/migrations/20260522110000_commission_tiers.sql` | Global `commission_tiers` table + seed Tier A (15/20/25). |
| `supabase/migrations/20260522110100_calc_commission_tier.sql` | Rewrite `calc_commission()` — override-then-tier resolution + YTD unit count. |
| `supabase/migrations/20260522110200_orders_insert_grants.sql` | GRANT + RLS tweak so dealer INSERT through `record_order` RPC; storage policy for `receipts`. |
| `supabase/migrations/20260522110300_record_order_fn.sql` | `record_order()` RPC: validates dealer owns it, serial unique, status=pending. |
| `supabase/migrations/20260522110400_dashboard_views.sql` | `dealer_dashboard_summary`, `supervisor_team_summary`, `admin_fleet_summary` SQL views (RLS-respecting). |
| `supabase/tests/09_commission_tiers.sql` | pgTAP: tier resolution (0/50/150/250 units → 15/15/20/25%), override beats tier. |
| `supabase/tests/10_record_order.sql` | pgTAP: dealer records own order, cannot spoof dealer_id, serial collision rejected. |
| `supabase/tests/11_dashboard_views.sql` | pgTAP: each view returns correct aggregates under RLS for dealer/supervisor/admin. |
| `src/lib/portal-queries.ts` | Typed query helpers: `getDealerSummary`, `getDealerOrders`, `getSupervisorTeam`, `getAdminFleet`, `recordOrder`, `uploadReceipt`. |
| `src/lib/portal-types.ts` | Extend with `Order`, `CommissionPayout`, `DealerSummary`, `TeamMember`, `FleetSummary`. |
| `src/app/portal/dealer/orders/new/page.tsx` | Order entry form + receipt upload. |
| `src/components/portal/OrderForm.tsx` | Form component (model select, serial, customer, price, date, image). |
| `src/components/portal/DealerDashboard.tsx` | MODIFY: replace mock with live `getDealerSummary` + `getDealerOrders`. |
| `src/components/portal/AdminConsole.tsx` | MODIFY: replace mock with live `getAdminFleet`. |
| `src/app/portal/admin/orders/page.tsx` | Admin order approval queue. |
| `src/components/portal/OrderApprovalRow.tsx` | Single order row with approve/reject + receipt preview. |
| `src/app/portal/supervisor/page.tsx` | Supervisor dashboard (team aggregate). |
| `src/app/portal/supervisor/team/[dealerId]/page.tsx` | Drill-down read-only dealer view. |
| `src/app/portal/admin/reports/page.tsx` | Reports + Excel export. |
| `tests/unit/portal/portal-queries.test.ts` | Vitest: query helpers shape + recordOrder validation. |

---

## Prerequisites (once, before Task 1)

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
git checkout portal-auth
git checkout -b portal-orders
docker ps | grep supabase   # confirm stack up; if not: supabase start
```

---

## Task 1: Global commission_tiers table

**Files:**
- Create: `supabase/migrations/20260522110000_commission_tiers.sql`
- Create: `supabase/tests/09_commission_tiers.sql`

- [ ] **Step 1: Write failing pgTAP test (table existence + seed)**

Create `supabase/tests/09_commission_tiers.sql`:

```sql
BEGIN;
SELECT plan(4);

SELECT has_table('public', 'commission_tiers', 'commission_tiers table exists');
SELECT has_column('public', 'commission_tiers', 'min_units', 'has min_units');
SELECT has_column('public', 'commission_tiers', 'percent', 'has percent');
SELECT results_eq(
    'SELECT count(*)::int FROM public.commission_tiers WHERE active = true',
    ARRAY[3],
    'Tier A seeded with 3 active tiers (15/20/25)'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect 4 failures**

```bash
supabase db reset && supabase test db 2>&1 | grep -E "09_commission|not ok"
```

- [ ] **Step 3: Write migration**

Create `supabase/migrations/20260522110000_commission_tiers.sql`:

```sql
CREATE TABLE public.commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    min_units INTEGER NOT NULL CHECK (min_units >= 0),
    percent NUMERIC(6, 4) NOT NULL CHECK (percent >= 0 AND percent <= 100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (min_units, active)
);

-- Boss-chosen Tier A scheme (2026-05-22): 15% (0-99), 20% (100-199), 25% (200+)
INSERT INTO public.commission_tiers (label, min_units, percent) VALUES
    ('Tier 1', 0, 15),
    ('Tier 2', 100, 20),
    ('Tier 3', 200, 25);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_tiers_select_all
    ON public.commission_tiers FOR SELECT
    USING (active = TRUE);

CREATE POLICY commission_tiers_admin_all
    ON public.commission_tiers FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset && supabase test db 2>&1 | tail -5
```

Expected: 9 files, all pass (4 new assertions in 09).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260522110000_commission_tiers.sql supabase/tests/09_commission_tiers.sql
git commit -m "feat(portal): global commission_tiers table (Tier A 15/20/25 by YTD units)"
```

---

## Task 2: Rewrite calc_commission for tier resolution

**Files:**
- Create: `supabase/migrations/20260522110100_calc_commission_tier.sql`
- Modify: `supabase/tests/09_commission_tiers.sql`

**Resolution order:** (1) active per-dealer `dealer_commissions` override for the model+date → use it. (2) else global tier: count the dealer's YTD units (orders with status in approved/paid, same calendar year as sale_date, including the order being approved) → pick highest tier whose `min_units <=` that count → apply `percent`.

- [ ] **Step 1: Extend pgTAP test (tier resolution + override precedence)**

Bump `SELECT plan(4);` → `SELECT plan(9);` in `supabase/tests/09_commission_tiers.sql` and append before `SELECT * FROM finish();`:

```sql
-- Seed dealer with NO override → falls to global tier
TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000001','authenticated','authenticated','admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000003','authenticated','authenticated','d1@dailongai.com');
INSERT INTO public.profiles (id, role, status) VALUES
    ('00000000-0000-0000-0000-000000000001','admin','active'),
    ('00000000-0000-0000-0000-000000000003','dealer','active')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;
INSERT INTO public.product_models (id, code, name, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001','ZD-A','Zhi Dun A',50000000);

-- First sale of the year: 0 prior units → Tier 1 15%
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-001','K','0900000000',50000000,'2026-03-01');
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE id='20000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts WHERE order_id='20000000-0000-0000-0000-000000000001' AND recipient_role='dealer'$$,
    ARRAY['7500000.00'],
    'tier 1: 15% of 50M = 7.5M (0 prior units)'
);

-- Bump dealer to 100 prior approved units by inserting 99 more approved orders + 1 new
DO $$
DECLARE i INT;
BEGIN
  FOR i IN 2..100 LOOP
    INSERT INTO public.orders (dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date, status, approved_at, approved_by)
    VALUES ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-'||lpad(i::text,3,'0'),'K','0900000000',50000000,'2026-03-02','approved',now(),'00000000-0000-0000-0000-000000000001');
  END LOOP;
END $$;
-- Now 100 prior units → next approval should be Tier 2 (20%)
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-101','K','0900000000',50000000,'2026-03-03');
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE id='20000000-0000-0000-0000-000000000002';
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts WHERE order_id='20000000-0000-0000-0000-000000000002' AND recipient_role='dealer'$$,
    ARRAY['10000000.00'],
    'tier 2: 20% of 50M = 10M (100 prior units)'
);

-- Per-dealer override beats tier
INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES ('00000000-0000-0000-0000-000000000003', NULL, 'percent', 30, '2026-01-01', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-102','K','0900000000',50000000,'2026-03-04');
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE id='20000000-0000-0000-0000-000000000003';
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts WHERE order_id='20000000-0000-0000-0000-000000000003' AND recipient_role='dealer'$$,
    ARRAY['15000000.00'],
    'override 30% of 50M = 15M beats tier'
);
```

- [ ] **Step 2: Run, expect new failures (still flat calc)**

```bash
supabase db reset && supabase test db 2>&1 | grep -E "09_commission|not ok"
```

Expected: tier-2 + override assertions fail (current calc errors with "No commission rule" when no override exists).

- [ ] **Step 3: Write the rewrite migration**

Create `supabase/migrations/20260522110100_calc_commission_tier.sql`:

```sql
CREATE OR REPLACE FUNCTION public.calc_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_dealer public.profiles%ROWTYPE;
    v_rule public.dealer_commissions%ROWTYPE;
    v_override public.supervisor_overrides%ROWTYPE;
    v_dealer_amount NUMERIC(12, 2);
    v_supervisor_amount NUMERIC(12, 2);
    v_ytd_units INTEGER;
    v_tier_percent NUMERIC(6, 4);
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

    SELECT * INTO v_dealer FROM public.profiles WHERE id = v_order.dealer_id;

    -- 1) Per-dealer override (exception) takes precedence
    SELECT * INTO v_rule
    FROM public.dealer_commissions
    WHERE dealer_id = v_order.dealer_id
      AND (model_id = v_order.model_id OR model_id IS NULL)
      AND effective_from <= v_order.sale_date
      AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
    ORDER BY (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
    LIMIT 1;

    IF FOUND THEN
        IF v_rule.commission_type = 'fixed' THEN
            v_dealer_amount := v_rule.rate_value;
        ELSE
            v_dealer_amount := ROUND(v_rule.rate_value / 100.0 * v_order.sale_price, 2);
        END IF;
    ELSE
        -- 2) Global tier by YTD approved/paid units in the sale_date's calendar year
        SELECT count(*) INTO v_ytd_units
        FROM public.orders
        WHERE dealer_id = v_order.dealer_id
          AND status IN ('approved', 'paid')
          AND date_part('year', sale_date) = date_part('year', v_order.sale_date)
          AND id <> p_order_id;

        SELECT percent INTO v_tier_percent
        FROM public.commission_tiers
        WHERE active = TRUE AND min_units <= v_ytd_units
        ORDER BY min_units DESC
        LIMIT 1;

        IF v_tier_percent IS NULL THEN
            RAISE EXCEPTION 'No commission tier configured for % units', v_ytd_units;
        END IF;

        v_dealer_amount := ROUND(v_tier_percent / 100.0 * v_order.sale_price, 2);
    END IF;

    INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
    VALUES (p_order_id, v_order.dealer_id, 'dealer', v_dealer_amount)
    ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;

    -- Supervisor override (unchanged from Plan 1)
    IF v_dealer.supervisor_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM public.supervisor_overrides
        WHERE supervisor_id = v_dealer.supervisor_id
          AND (dealer_id = v_order.dealer_id OR dealer_id IS NULL)
          AND (model_id = v_order.model_id OR model_id IS NULL)
          AND effective_from <= v_order.sale_date
          AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
        ORDER BY (dealer_id IS NOT NULL) DESC, (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_supervisor_amount := ROUND(v_override.override_percent / 100.0 * v_order.sale_price, 2);
            INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
            VALUES (p_order_id, v_dealer.supervisor_id, 'supervisor', v_supervisor_amount)
            ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;
        END IF;
    END IF;
END;
$$;
```

- [ ] **Step 4: Apply + verify (and confirm Plan 1's 05_commission_calc still passes — it uses explicit dealer_commissions rows so override path covers it)**

```bash
supabase db reset && supabase test db 2>&1 | tail -8
```

Expected: 9 files all PASS, including `05_commission_calc.sql` (its dealers all have dealer_commissions rows → override path) and the new tier assertions in `09`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260522110100_calc_commission_tier.sql supabase/tests/09_commission_tiers.sql
git commit -m "feat(portal): tier-based calc_commission (override-then-global-tier by YTD units)"
```

---

## Task 3: record_order RPC + receipts storage policy

**Files:**
- Create: `supabase/migrations/20260522110200_orders_insert_grants.sql`
- Create: `supabase/migrations/20260522110300_record_order_fn.sql`
- Create: `supabase/tests/10_record_order.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/10_record_order.sql`:

```sql
BEGIN;
SELECT plan(4);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000003','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000004','authenticated','authenticated','d2@dailongai.com');
INSERT INTO public.profiles (id, role, status) VALUES
    ('00000000-0000-0000-0000-000000000003','dealer','active'),
    ('00000000-0000-0000-0000-000000000004','dealer','active')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;
INSERT INTO public.product_models (id, code, name, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001','ZD-A','Zhi Dun A',50000000);

-- D1 records own order
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT lives_ok(
    $$SELECT public.record_order('10000000-0000-0000-0000-000000000001'::uuid,'SN-R-001','Khach','0901234567',NULL,55000000,'2026-05-20',NULL)$$,
    'dealer records own order'
);
SELECT results_eq(
    $$SELECT count(*)::int FROM public.orders WHERE serial_number='SN-R-001' AND dealer_id='00000000-0000-0000-0000-000000000003' AND status='pending'$$,
    ARRAY[1],
    'order created as pending for the calling dealer'
);

-- Serial collision rejected
SELECT throws_ok(
    $$SELECT public.record_order('10000000-0000-0000-0000-000000000001'::uuid,'SN-R-001','Khach','0901234567',NULL,55000000,'2026-05-20',NULL)$$,
    NULL, NULL,
    'duplicate serial rejected'
);

-- Non-dealer (no profile role dealer) cannot record — simulate by switching to d2 then asserting it lands under d2 not d1
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
SELECT public.record_order('10000000-0000-0000-0000-000000000001'::uuid,'SN-R-002','K2','0902222222',NULL,60000000,'2026-05-20',NULL);
RESET ROLE;
SELECT results_eq(
    $$SELECT dealer_id::text FROM public.orders WHERE serial_number='SN-R-002'$$,
    ARRAY['00000000-0000-0000-0000-000000000004'],
    'record_order always attributes to caller, cannot spoof dealer_id'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect failures**

```bash
supabase db reset && supabase test db 2>&1 | grep -E "10_record|not ok"
```

- [ ] **Step 3: Write storage policy migration**

Create `supabase/migrations/20260522110200_orders_insert_grants.sql`:

```sql
-- Dealers upload receipts to receipts/<their-uid>/<filename>; can read own folder
CREATE POLICY receipts_dealer_insert
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY receipts_dealer_select_own
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'receipts'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.current_role() = 'admin'
        )
    );
```

- [ ] **Step 4: Write record_order RPC**

Create `supabase/migrations/20260522110300_record_order_fn.sql`:

```sql
CREATE OR REPLACE FUNCTION public.record_order(
    p_model_id UUID,
    p_serial_number TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_address TEXT,
    p_sale_price NUMERIC,
    p_sale_date DATE,
    p_receipt_image_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_order_id UUID;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'dealer' THEN
        RAISE EXCEPTION 'record_order: only dealers can record orders';
    END IF;

    INSERT INTO public.orders
        (dealer_id, model_id, serial_number, customer_name, customer_phone, customer_address, sale_price, sale_date, status, receipt_image_url)
    VALUES
        (auth.uid(), p_model_id, p_serial_number, p_customer_name, p_customer_phone, p_customer_address, p_sale_price, p_sale_date, 'pending', p_receipt_image_url)
    RETURNING id INTO v_order_id;

    RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_order TO authenticated;
```

- [ ] **Step 5: Apply + verify**

```bash
supabase db reset && supabase test db 2>&1 | tail -6
```

Expected: 10 files all PASS (4 new in `10_record_order`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260522110200_orders_insert_grants.sql supabase/migrations/20260522110300_record_order_fn.sql supabase/tests/10_record_order.sql
git commit -m "feat(portal): record_order RPC + receipts storage RLS (dealer folder isolation)"
```

---

## Task 4: Dashboard SQL views

**Files:**
- Create: `supabase/migrations/20260522110400_dashboard_views.sql`
- Create: `supabase/tests/11_dashboard_views.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/11_dashboard_views.sql`:

```sql
BEGIN;
SELECT plan(3);

SELECT has_view('public', 'dealer_dashboard_summary', 'dealer_dashboard_summary view exists');
SELECT has_view('public', 'supervisor_team_summary', 'supervisor_team_summary view exists');
SELECT has_view('public', 'admin_fleet_summary', 'admin_fleet_summary view exists');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect 3 failures**

```bash
supabase db reset && supabase test db 2>&1 | grep -E "11_dashboard|not ok"
```

- [ ] **Step 3: Write views migration**

Create `supabase/migrations/20260522110400_dashboard_views.sql`:

```sql
-- Views run with the querying user's privileges (security_invoker) so RLS on
-- underlying tables (orders, commission_payouts, profiles) still applies.
CREATE VIEW public.dealer_dashboard_summary
WITH (security_invoker = true) AS
SELECT
    o.dealer_id,
    count(*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(*) FILTER (WHERE o.status = 'approved') AS orders_approved,
    count(*) FILTER (WHERE o.status = 'paid') AS orders_paid,
    count(*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (WHERE date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())), 0) AS month_sales,
    coalesce((SELECT sum(cp.amount) FROM public.commission_payouts cp WHERE cp.recipient_id = o.dealer_id AND cp.recipient_role='dealer' AND cp.paid_at IS NULL AND cp.voided_at IS NULL), 0) AS commission_pending,
    coalesce((SELECT sum(cp.amount) FROM public.commission_payouts cp WHERE cp.recipient_id = o.dealer_id AND cp.recipient_role='dealer' AND cp.paid_at IS NOT NULL), 0) AS commission_paid
FROM public.orders o
GROUP BY o.dealer_id;

CREATE VIEW public.supervisor_team_summary
WITH (security_invoker = true) AS
SELECT
    p.supervisor_id,
    p.id AS dealer_id,
    p.full_name AS dealer_name,
    count(o.*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(o.*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (WHERE date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())), 0) AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer' AND p.supervisor_id IS NOT NULL
GROUP BY p.supervisor_id, p.id, p.full_name;

CREATE VIEW public.admin_fleet_summary
WITH (security_invoker = true) AS
SELECT
    count(DISTINCT o.dealer_id) FILTER (WHERE o.status IN ('approved','paid')) AS active_dealers,
    count(*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    count(*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())) AS units_month,
    count(*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    coalesce(sum(o.sale_price) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())), 0) AS revenue_ytd,
    coalesce((SELECT sum(amount) FROM public.commission_payouts WHERE paid_at IS NULL AND voided_at IS NULL), 0) AS commission_pending
FROM public.orders o;
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset && supabase test db 2>&1 | tail -6
```

Expected: 11 files all PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260522110400_dashboard_views.sql supabase/tests/11_dashboard_views.sql
git commit -m "feat(portal): dashboard summary views (dealer/supervisor/admin, security_invoker RLS)"
```

---

## Task 5: Typed query helpers + types

**Files:**
- Modify: `src/lib/portal-types.ts`
- Create: `src/lib/portal-queries.ts`
- Create: `tests/unit/portal/portal-queries.test.ts`

- [ ] **Step 1: Extend portal-types.ts**

Append to `src/lib/portal-types.ts`:

```ts
export interface Order {
  id: string;
  dealer_id: string;
  model_id: string;
  serial_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  sale_price: number;
  sale_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'voided';
  receipt_image_url: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface DealerSummary {
  dealer_id: string;
  orders_pending: number;
  orders_approved: number;
  orders_paid: number;
  units_ytd: number;
  month_sales: number;
  commission_pending: number;
  commission_paid: number;
}

export interface TeamMember {
  supervisor_id: string;
  dealer_id: string;
  dealer_name: string | null;
  orders_pending: number;
  units_ytd: number;
  month_sales: number;
}

export interface FleetSummary {
  active_dealers: number;
  units_ytd: number;
  units_month: number;
  orders_pending: number;
  revenue_ytd: number;
  commission_pending: number;
}
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/portal/portal-queries.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { recordOrder } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({ data: 'order-uuid', error: null });
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

describe('recordOrder', () => {
  it('calls record_order RPC with mapped params and returns order id', async () => {
    const id = await recordOrder({
      modelId: 'm1',
      serialNumber: 'SN-1',
      customerName: 'K',
      customerPhone: '0901234567',
      customerAddress: null,
      salePrice: 55000000,
      saleDate: '2026-05-20',
      receiptImageUrl: null,
    });
    expect(id).toBe('order-uuid');
    expect(rpcMock).toHaveBeenCalledWith('record_order', {
      p_model_id: 'm1',
      p_serial_number: 'SN-1',
      p_customer_name: 'K',
      p_customer_phone: '0901234567',
      p_customer_address: null,
      p_sale_price: 55000000,
      p_sale_date: '2026-05-20',
      p_receipt_image_url: null,
    });
  });
});
```

- [ ] **Step 3: Run, expect fail (module missing)**

```bash
npx vitest run tests/unit/portal/portal-queries.test.ts
```

- [ ] **Step 4: Write portal-queries.ts**

Create `src/lib/portal-queries.ts`:

```ts
import { getSupabaseClient } from './supabase';
import type { Order, DealerSummary, TeamMember, FleetSummary, ProductModel } from './portal-types';

export async function getDealerSummary(dealerId: string): Promise<DealerSummary | null> {
  const { data } = await getSupabaseClient()
    .from('dealer_dashboard_summary')
    .select('*')
    .eq('dealer_id', dealerId)
    .maybeSingle();
  return (data as DealerSummary) ?? null;
}

export async function getDealerOrders(dealerId: string): Promise<Order[]> {
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('*')
    .eq('dealer_id', dealerId)
    .order('sale_date', { ascending: false });
  return (data as Order[]) ?? [];
}

export async function getActiveModels(): Promise<ProductModel[]> {
  const { data } = await getSupabaseClient()
    .from('product_models')
    .select('*')
    .eq('active', true)
    .order('code');
  return (data as ProductModel[]) ?? [];
}

export async function getSupervisorTeam(supervisorId: string): Promise<TeamMember[]> {
  const { data } = await getSupabaseClient()
    .from('supervisor_team_summary')
    .select('*')
    .eq('supervisor_id', supervisorId);
  return (data as TeamMember[]) ?? [];
}

export async function getAdminFleet(): Promise<FleetSummary | null> {
  const { data } = await getSupabaseClient().from('admin_fleet_summary').select('*').maybeSingle();
  return (data as FleetSummary) ?? null;
}

export async function getPendingOrders(): Promise<Order[]> {
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return (data as Order[]) ?? [];
}

export interface RecordOrderInput {
  modelId: string;
  serialNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  salePrice: number;
  saleDate: string;
  receiptImageUrl: string | null;
}

export async function recordOrder(input: RecordOrderInput): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('record_order', {
    p_model_id: input.modelId,
    p_serial_number: input.serialNumber,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_address: input.customerAddress,
    p_sale_price: input.salePrice,
    p_sale_date: input.saleDate,
    p_receipt_image_url: input.receiptImageUrl,
  });
  if (error) throw error;
  return data as string;
}

export async function uploadReceipt(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const client = getSupabaseClient();
  const { error } = await client.storage.from('receipts').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function approveOrder(orderId: string, adminId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('orders')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: adminId })
    .eq('id', orderId);
  if (error) throw error;
}

export async function rejectOrder(orderId: string, reason: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('orders')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', orderId);
  if (error) throw error;
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
npx vitest run tests/unit/portal/portal-queries.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/portal-types.ts src/lib/portal-queries.ts tests/unit/portal/portal-queries.test.ts
git commit -m "feat(portal): typed query helpers (summaries, orders, recordOrder, uploadReceipt, approve/reject)"
```

---

## Task 6: Order entry form

**Files:**
- Create: `src/components/portal/OrderForm.tsx`
- Create: `src/app/portal/dealer/orders/new/page.tsx`

- [ ] **Step 1: Write OrderForm component**

Create `src/components/portal/OrderForm.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { getActiveModels, recordOrder, uploadReceipt } from '@/lib/portal-queries';
import type { ProductModel } from '@/lib/portal-types';

const schema = z.object({
  modelId: z.string().uuid('Chọn model máy'),
  serialNumber: z.string().min(3, 'Số serial tối thiểu 3 ký tự'),
  customerName: z.string().min(2, 'Nhập tên khách'),
  customerPhone: z.string().regex(/^0\d{9,10}$/, 'SĐT khách không hợp lệ'),
  salePrice: z.number().positive('Giá bán phải > 0'),
  saleDate: z.string().min(10, 'Chọn ngày bán'),
});

export function OrderForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [models, setModels] = useState<ProductModel[]>([]);
  const [form, setForm] = useState({
    modelId: '', serialNumber: '', customerName: '', customerPhone: '',
    customerAddress: '', salePrice: '', saleDate: new Date().toISOString().slice(0, 10),
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getActiveModels().then(setModels);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, salePrice: Number(form.salePrice) });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { next[String(i.path[0])] = i.message; });
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      let receiptUrl: string | null = null;
      if (receipt) receiptUrl = await uploadReceipt(userId, receipt);
      await recordOrder({
        modelId: form.modelId,
        serialNumber: form.serialNumber,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerAddress: form.customerAddress || null,
        salePrice: Number(form.salePrice),
        saleDate: form.saleDate,
        receiptImageUrl: receiptUrl,
      });
      toast.success('Đã ghi nhận đơn, chờ admin duyệt');
      router.replace('/portal/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi ghi nhận đơn');
      setBusy(false);
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Model máy</label>
        <select value={form.modelId} onChange={(e) => set('modelId', e.target.value)} className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm">
          <option value="">— Chọn model —</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
        {errors.modelId && <p className="mt-1 text-xs text-[#c46a5e]">{errors.modelId}</p>}
      </div>
      {[
        { k: 'serialNumber', label: 'Số serial máy', type: 'text' },
        { k: 'customerName', label: 'Tên khách hàng', type: 'text' },
        { k: 'customerPhone', label: 'SĐT khách', type: 'tel' },
        { k: 'customerAddress', label: 'Địa chỉ (tùy chọn)', type: 'text' },
        { k: 'salePrice', label: 'Giá bán (VND)', type: 'number' },
        { k: 'saleDate', label: 'Ngày bán', type: 'date' },
      ].map((f) => (
        <div key={f.k}>
          <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">{f.label}</label>
          <input
            type={f.type}
            value={form[f.k as keyof typeof form]}
            onChange={(e) => set(f.k, e.target.value)}
            className="w-full rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm focus:border-[#0e1525] outline-none"
          />
          {errors[f.k] && <p className="mt-1 text-xs text-[#c46a5e]">{errors[f.k]}</p>}
        </div>
      ))}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wider text-[#0e1525]/60">Ảnh biên nhận / hợp đồng</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>
      <button type="submit" disabled={busy} className="rounded-full bg-[#0e1525] px-6 py-3 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50">
        {busy ? 'Đang gửi…' : 'Ghi nhận đơn'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write order entry page**

Create `src/app/portal/dealer/orders/new/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderForm } from '@/components/portal/OrderForm';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function NewOrderPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile && profile.role !== 'dealer') router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile || profile.role !== 'dealer') return null;

  return (
    <PortalShell variant="dealer">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Đơn mới</p>
        <h1 style={display} className="mt-2 text-3xl font-light italic">Ghi nhận đơn bán máy</h1>
      </div>
      <OrderForm userId={session.user.id} />
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/OrderForm.tsx src/app/portal/dealer/orders/new/
git commit -m "feat(portal): dealer order entry form + receipt upload to private bucket"
```

---

## Task 7: Wire DealerDashboard to live data

**Files:**
- Modify: `src/components/portal/DealerDashboard.tsx`

- [ ] **Step 1: Replace mock block with live fetch**

In `src/components/portal/DealerDashboard.tsx`, replace the `const mock = {...}` object and component body data source with a `useEffect` fetch. Specifically: add imports at top —

```tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDealerSummary, getDealerOrders } from '@/lib/portal-queries';
import type { Order, DealerSummary } from '@/lib/portal-types';
```

Replace the `mock` constant + derived values with state:

```tsx
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    getDealerSummary(profile.id).then(setSummary);
    getDealerOrders(profile.id).then(setOrders);
  }, [profile.id]);

  const unitsYtd = summary?.units_ytd ?? 0;
  const monthSales = summary?.month_sales ?? 0;
  const commissionPending = summary?.commission_pending ?? 0;
  const ordersPending = summary?.orders_pending ?? 0;
  const ordersDone = (summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0);
```

Then update the JSX references (`mock.monthSales` → `monthSales`, `mock.unitsYtd` → `unitsYtd`, `mock.commissionPending` → `commissionPending`, `mock.ordersPending` → `ordersPending`, `mock.ordersPaid + mock.ordersApproved` → `ordersDone`, `mock.recentOrders` → `orders`). Make the "Ghi nhận đơn mới" button a Link:

```tsx
  <Link href="/portal/dealer/orders/new" className="rounded-full border border-[#0e1525] bg-[#0e1525] px-6 py-2.5 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] hover:border-[#bc7e3b]">
    + Ghi nhận đơn mới
  </Link>
```

Replace the recent-orders empty-state block to render real orders when present:

```tsx
  {orders.length === 0 ? (
    <div className="mt-6 rounded-xl border-2 border-dashed border-[#0e1525]/15 p-12 text-center text-sm text-[#0e1525]/60">
      <p>Chưa có đơn nào ghi nhận.</p>
    </div>
  ) : (
    <div className="mt-6 divide-y divide-[#0e1525]/10">
      {orders.slice(0, 10).map((o, i) => (
        <div key={o.id} className="grid grid-cols-12 items-center gap-4 py-4 text-sm">
          <span className="col-span-1 text-[#0e1525]/30" style={numeric}>{String(i + 1).padStart(2, '0')}</span>
          <span className="col-span-4 font-medium">{o.customer_name}</span>
          <span className="col-span-3 text-[#0e1525]/60" style={numeric}>{o.serial_number}</span>
          <span className="col-span-2 text-right" style={numeric}>{fmtShortVnd(o.sale_price)}</span>
          <span className="col-span-2 text-right text-xs uppercase tracking-wider text-[#bc7e3b]">{o.status}</span>
        </div>
      ))}
    </div>
  )}
```

Remove the now-unused `mock.recentOrders` typing and the "Plan 3 sẽ wire" disclaimer line.

- [ ] **Step 2: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/DealerDashboard.tsx
git commit -m "feat(portal): wire DealerDashboard to live summary + orders (replace mock)"
```

---

## Task 8: Wire AdminConsole to live fleet data

**Files:**
- Modify: `src/components/portal/AdminConsole.tsx`

- [ ] **Step 1: Replace mockFleet with live fetch**

In `src/components/portal/AdminConsole.tsx` add imports:

```tsx
import { useEffect, useState } from 'react';
import { getAdminFleet } from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';
```

Replace `const mockFleet = {...}` with state inside the component:

```tsx
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  useEffect(() => { getAdminFleet().then(setFleet); }, []);
  const f = fleet ?? { active_dealers: 0, units_ytd: 0, units_month: 0, orders_pending: 0, revenue_ytd: 0, commission_pending: 0 };
```

Update JSX references: `mockFleet.unitsYtdAll` → `f.units_ytd`, `mockFleet.activeDealers` → `f.active_dealers`, `mockFleet.unitsThisMonth` → `f.units_month`, `mockFleet.pendingApprovals` → `f.orders_pending`, `mockFleet.commissionPendingNow` → `f.commission_pending`, `mockFleet.payoutDealersCount` → `f.active_dealers`. Set `pendingRegistrations` to a separate count query or drop the tile (use `f.orders_pending`). Replace the big "0 tỷ" hero literal with `{fmtShortVnd(f.revenue_ytd)}`. Remove the "Plan 3 wire" disclaimer line.

- [ ] **Step 2: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/AdminConsole.tsx
git commit -m "feat(portal): wire AdminConsole to live admin_fleet_summary"
```

---

## Task 9: Admin order approval queue

**Files:**
- Create: `src/components/portal/OrderApprovalRow.tsx`
- Create: `src/app/portal/admin/orders/page.tsx`

- [ ] **Step 1: Write OrderApprovalRow**

Create `src/components/portal/OrderApprovalRow.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { approveOrder, rejectOrder } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import type { Order } from '@/lib/portal-types';

const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

export function OrderApprovalRow({ order, adminId, onResolved }: { order: Order; adminId: string; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const viewReceipt = async () => {
    if (!order.receipt_image_url) return;
    const { data } = await getSupabaseClient().storage.from('receipts').createSignedUrl(order.receipt_image_url, 60);
    if (data?.signedUrl) { setReceiptUrl(data.signedUrl); window.open(data.signedUrl, '_blank'); }
  };

  const approve = async () => {
    setBusy(true);
    try { await approveOrder(order.id, adminId); toast.success('Đã duyệt'); onResolved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Lỗi'); setBusy(false); }
  };
  const reject = async () => {
    const reason = window.prompt('Lý do từ chối?');
    if (!reason) return;
    setBusy(true);
    try { await rejectOrder(order.id, reason); toast.success('Đã từ chối'); onResolved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Lỗi'); setBusy(false); }
  };

  return (
    <tr className="border-t border-[#0e1525]/10 hover:bg-[#f5f1e8]/50">
      <td className="px-4 py-3" style={numeric}>{order.serial_number}</td>
      <td className="px-4 py-3">{order.customer_name}<div className="text-[11px] text-[#0e1525]/60" style={numeric}>{order.customer_phone}</div></td>
      <td className="px-4 py-3 text-right" style={numeric}>{new Intl.NumberFormat('vi-VN').format(order.sale_price)}</td>
      <td className="px-4 py-3" style={numeric}>{order.sale_date}</td>
      <td className="px-4 py-3">
        {order.receipt_image_url
          ? <button onClick={viewReceipt} className="text-xs text-[#bc7e3b] hover:underline">Xem ảnh</button>
          : <span className="text-xs text-[#0e1525]/40">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={approve} disabled={busy} className="rounded-full bg-[#0e1525] px-3 py-1.5 text-xs font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50">Duyệt</button>
          <button onClick={reject} disabled={busy} className="rounded-full border border-[#0e1525]/30 px-3 py-1.5 text-xs font-medium hover:bg-[#0e1525]/5 disabled:opacity-50">Từ chối</button>
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Write admin orders page**

Create `src/app/portal/admin/orders/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPendingOrders } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { OrderApprovalRow } from '@/components/portal/OrderApprovalRow';
import type { Order } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function AdminOrdersPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    setFetching(true);
    setOrders(await getPendingOrders());
    setFetching(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else void refresh();
  }, [loading, session, profile, router, refresh]);

  if (loading || profile?.role !== 'admin') return null;

  return (
    <PortalShell
      variant="admin"
      nav={
        <>
          <Link href="/portal/admin" className="text-[#0e1525]/60 hover:text-[#0e1525]">Tổng quan</Link>
          <Link href="/portal/admin/orders" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Đơn hàng</Link>
          <Link href="/portal/admin/registrations" className="text-[#0e1525]/60 hover:text-[#0e1525]">Đăng ký</Link>
        </>
      }
    >
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Queue cần duyệt</p>
        <h1 style={display} className="mt-2 text-4xl font-light italic">Đơn chờ duyệt</h1>
      </div>
      {fetching ? (
        <p className="text-[#0e1525]/60">Đang tải…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#0e1525]/15 p-12 text-center text-sm text-[#0e1525]/60">Không có đơn chờ duyệt.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
              <tr>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Khách</th>
                <th className="px-4 py-3 text-right">Giá</th>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Biên nhận</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderApprovalRow key={o.id} order={o} adminId={session!.user.id} onResolved={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/OrderApprovalRow.tsx src/app/portal/admin/orders/
git commit -m "feat(portal): admin order approval queue (approve/reject + signed receipt preview)"
```

---

## Task 10: Supervisor dashboard + drill-down

**Files:**
- Create: `src/app/portal/supervisor/page.tsx`
- Create: `src/app/portal/supervisor/team/[dealerId]/page.tsx`

- [ ] **Step 1: Write supervisor dashboard**

Create `src/app/portal/supervisor/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupervisorTeam } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { TeamMember } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };
const fmtShortVnd = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr' : new Intl.NumberFormat('vi-VN').format(n));

export default function SupervisorDashboard() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'supervisor') router.replace('/portal/dashboard');
    else getSupervisorTeam(session.user.id).then(setTeam);
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'supervisor') return null;

  const totalMonth = team.reduce((s, t) => s + Number(t.month_sales), 0);
  const totalUnits = team.reduce((s, t) => s + Number(t.units_ytd), 0);

  return (
    <PortalShell variant="supervisor">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#5d8d6a]">Toàn đội</p>
        <h1 style={display} className="mt-2 text-4xl font-light italic">Đội của tôi</h1>
      </div>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đại lý</p>
          <p style={numeric} className="mt-2 text-3xl font-medium">{team.length}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Doanh số tháng</p>
          <p style={numeric} className="mt-2 text-3xl font-medium">{fmtShortVnd(totalMonth)}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Máy YTD toàn đội</p>
          <p style={numeric} className="mt-2 text-3xl font-medium">{totalUnits}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
            <tr>
              <th className="px-4 py-3">Đại lý</th>
              <th className="px-4 py-3 text-right">Doanh số tháng</th>
              <th className="px-4 py-3 text-right">Máy YTD</th>
              <th className="px-4 py-3 text-right">Đơn chờ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.dealer_id} className="border-t border-[#0e1525]/10 hover:bg-[#f5f1e8]/50">
                <td className="px-4 py-3 font-medium">{t.dealer_name ?? '(không tên)'}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{fmtShortVnd(Number(t.month_sales))}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{t.units_ytd}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{t.orders_pending}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/portal/supervisor/team/${t.dealer_id}`} className="text-xs text-[#bc7e3b] hover:underline">Chi tiết →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
```

- [ ] **Step 2: Write drill-down page**

Create `src/app/portal/supervisor/team/[dealerId]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getDealerSummary, getDealerOrders } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { Order, DealerSummary } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };
const fmtShortVnd = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr' : new Intl.NumberFormat('vi-VN').format(n));

export default function TeamDealerDetail() {
  const router = useRouter();
  const params = useParams();
  const dealerId = params.dealerId as string;
  const { session, profile, loading } = useAuth();
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'supervisor') router.replace('/portal/dashboard');
    else {
      // RLS guarantees supervisor only sees own team's dealer rows; empty = not in team
      getDealerSummary(dealerId).then(setSummary);
      getDealerOrders(dealerId).then(setOrders);
    }
  }, [loading, session, profile, router, dealerId]);

  if (loading || profile?.role !== 'supervisor') return null;

  return (
    <PortalShell variant="supervisor">
      <Link href="/portal/supervisor" className="text-xs text-[#0e1525]/60 hover:text-[#bc7e3b]">← Về đội</Link>
      <h1 style={display} className="mt-3 text-3xl font-light italic">Chi tiết đại lý (read-only)</h1>
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Máy YTD</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{summary?.units_ytd ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Doanh số tháng</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{fmtShortVnd(Number(summary?.month_sales ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đơn chờ</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{summary?.orders_pending ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đã chốt</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{(summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0)}</p>
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
            <tr><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Khách</th><th className="px-4 py-3 text-right">Giá</th><th className="px-4 py-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-[#0e1525]/10">
                <td className="px-4 py-3" style={numeric}>{o.serial_number}</td>
                <td className="px-4 py-3">{o.customer_name}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{fmtShortVnd(o.sale_price)}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-[#bc7e3b]">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/supervisor/
git commit -m "feat(portal): supervisor team dashboard + read-only dealer drill-down"
```

---

## Task 11: Admin reports + Excel export

**Files:**
- Create: `src/app/portal/admin/reports/page.tsx`
- Modify: `package.json` (add `xlsx`)

- [ ] **Step 1: Install xlsx**

```bash
npm install xlsx
```

- [ ] **Step 2: Write reports page**

Create `src/app/portal/admin/reports/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { toast } from 'sonner';
import type { Order } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };

export default function ReportsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'admin') router.replace('/portal/dashboard');
    else {
      getSupabaseClient().from('orders').select('*').order('sale_date', { ascending: false })
        .then(({ data }) => setOrders((data as Order[]) ?? []));
    }
  }, [loading, session, profile, router]);

  if (loading || profile?.role !== 'admin') return null;

  const exportExcel = () => {
    if (orders.length === 0) { toast.error('Không có đơn để xuất'); return; }
    const rows = orders.map((o) => ({
      Serial: o.serial_number,
      'Khách hàng': o.customer_name,
      SĐT: o.customer_phone,
      'Giá bán': o.sale_price,
      'Ngày bán': o.sale_date,
      'Trạng thái': o.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn hàng');
    XLSX.writeFile(wb, `dailong-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Đã xuất Excel');
  };

  return (
    <PortalShell
      variant="admin"
      nav={
        <>
          <Link href="/portal/admin" className="text-[#0e1525]/60 hover:text-[#0e1525]">Tổng quan</Link>
          <Link href="/portal/admin/reports" className="border-b-2 border-[#0e1525] pb-1 font-semibold">Báo cáo</Link>
        </>
      }
    >
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Báo cáo</p>
          <h1 style={display} className="mt-2 text-4xl font-light italic">Toàn bộ đơn hàng</h1>
        </div>
        <button onClick={exportExcel} className="rounded-full bg-[#0e1525] px-5 py-2.5 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b]">
          ↓ Xuất Excel ({orders.length} đơn)
        </button>
      </div>
      <p className="text-sm text-[#0e1525]/60">Tổng <span className="font-semibold">{orders.length}</span> đơn trong hệ thống. Bấm “Xuất Excel” để tải file .xlsx.</p>
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/admin/reports/ package.json package-lock.json
git commit -m "feat(portal): admin reports page + Excel export (SheetJS)"
```

---

## Task 12: Dashboard role routing fix for supervisor

**Files:**
- Modify: `src/app/portal/dashboard/page.tsx`

- [ ] **Step 1: Route supervisor to /portal/supervisor**

In `src/app/portal/dashboard/page.tsx`, in the redirect `useEffect`, after the admin redirect, add a supervisor redirect:

```tsx
    if (profile.role === 'admin') { router.replace('/portal/admin'); return; }
    if (profile.role === 'supervisor') { router.replace('/portal/supervisor'); return; }
```

And update the early return guard so supervisors don't render the dealer dashboard:

```tsx
  if (loading || !session || !profile || profile.status !== 'active' || !profile.role) return null;
  if (profile.role !== 'dealer') return null;
```

- [ ] **Step 2: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/dashboard/page.tsx
git commit -m "feat(portal): route supervisor role to /portal/supervisor dashboard"
```

---

## Task 13: E2E manual smoke (browser) + seed exercise

**Files:** None — verification task.

- [ ] **Step 1: Reset with seed + add a supervisor-linked dealer order via psql**

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'EOF'
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT public.record_order('10000000-0000-0000-0000-000000000001'::uuid,'E2E-P3-001','Khach E2E','0911111111',NULL,55000000,'2026-05-22',NULL);
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001' WHERE serial_number='E2E-P3-001';
RESET ROLE;
SELECT recipient_role, amount FROM public.commission_payouts
WHERE order_id = (SELECT id FROM public.orders WHERE serial_number='E2E-P3-001') ORDER BY recipient_role;
EOF
```

Expected (seed d1 has supervisor sv1 with 2.5% override; d1 has explicit dealer_commissions fixed 5M for ZD-A → override path):

```
 recipient_role |   amount
----------------+------------
 dealer         | 5000000.00
 supervisor     | 1375000.00
```

- [ ] **Step 2: Start dev server, browse the flow**

```bash
npx next dev -p 3003 &
sleep 6
```

Then in browser (or Playwright) confirm:
- `/portal/dealer/orders/new` renders form, model dropdown populated.
- `/portal/admin/orders` lists the pending order (login as admin seed account).
- `/portal/supervisor` shows team table when logged in as a supervisor.

- [ ] **Step 3: Commit nothing (verification only); note results**

Output to console: "Plan 3 E2E smoke: record_order → approve → payouts (dealer 5M + supervisor 1.375M) verified; pages render."

---

## Task 14: Verification Gate (CLAUDE.md §8.5)

**Files:** None — verification + reporting only.

**Why:** Plan 3 is a chain of ≥2 code tasks (5 migrations, 3 views, query lib, 6 pages/components). Per CLAUDE.md §8.5, before claiming done Sen Coder MUST invoke `superpowers:verification-before-completion` and paste fresh tool output.

- [ ] **Step 1: Invoke verification skill**

Run `Skill` tool with `skill: superpowers:verification-before-completion`.

- [ ] **Step 2: Full pgTAP from cold reset**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
supabase db reset 2>&1 | tail -3
supabase test db 2>&1 | tee /tmp/plan3-pgtap.log | tail -10
```

Expected: 11 files, all PASS (includes tier resolution + record_order + views). Paste last 10 lines.

- [ ] **Step 3: Vitest portal suite**

```bash
npx vitest run tests/unit/portal/ 2>&1 | tee /tmp/plan3-vitest.log | tail -8
```

Expected: 0 failed (supabase singleton + AuthProvider + portal-queries). Paste.

- [ ] **Step 4: TypeScript**

```bash
node node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "dieu-khoan" | tee /tmp/plan3-tsc.log
echo "exit: ${PIPESTATUS[0]}"
```

Expected: no portal errors. Paste.

- [ ] **Step 5: Live routes**

```bash
bash -c 'for p in /portal/dealer/orders/new /portal/admin/orders /portal/supervisor /portal/admin/reports; do echo "$p: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003$p)"; done'
```

Expected: all 200. Paste.

- [ ] **Step 6: Git state**

```bash
git status
git log --oneline portal-orders ^portal-auth | head -20
```

Expected: clean tree, ≥13 commits ahead of portal-auth. Paste.

- [ ] **Step 7: Report with evidence**

Only after Steps 2–6 produce passing output, post to Boss: pgTAP tail, vitest tail, tsc result, route codes, git log, and one-sentence conclusion: "Plan 3 — Order Workflow done; tier engine + order entry + approval + live dashboards verified on cold state."

If any step fails: diagnose, fix, re-run from Step 2. Do not claim done without evidence.

---

## Self-Review Notes

- **Spec coverage**: order entry ✅ (Task 6), serial-unique anti-fraud ✅ (DB constraint + record_order), admin approval ✅ (Task 9), commission 2-tier with tier scheme ✅ (Tasks 1-2), supervisor view + drill-down ✅ (Task 10), reports + Excel ✅ (Task 11), receipt upload to private bucket ✅ (Task 3 + 6). Audit triggers fire automatically (Plan 1).
- **Tier decision**: Boss chose Tier A (15/20/25 by YTD units). Per-dealer `dealer_commissions` rows kept as override (admin can still set exceptions via the registration approval flow from Plan 2).
- **Naming consistency**: `record_order`, `approveOrder`, `rejectOrder`, `getDealerSummary`, `getAdminFleet`, `getSupervisorTeam`, view names `dealer_dashboard_summary`/`supervisor_team_summary`/`admin_fleet_summary` — stable across tasks.
- **RLS reliance**: dashboard views use `security_invoker = true` so underlying RLS applies; supervisor drill-down trusts RLS to scope team-only (empty result if not in team).
- **Out of scope (Plan 4)**: notification dispatch (Telegram + Zalo OA), auto-payment cron 5-10 + bank batch transfer, Zalo OA OTP signup, mobile-polish pass, production Supabase project + OAuth prod redirect URIs, Facebook App Review, sales documents page, prod deploy.
- **Known limitation**: `record_order` does not re-validate price ranges or model-active state beyond FK; admin approval is the human gate. Year-boundary tier reset uses `date_part('year', sale_date)` — an order backdated to last year counts against last year's tier (intended).
