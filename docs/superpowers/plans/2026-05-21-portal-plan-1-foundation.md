# Portal Plan 1 — Foundation (DB + RLS + Commission Engine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Supabase project, 8 core tables, Row-Level Security policies, commission calculation engine, and pgTAP test suite — produce a working backend that the v1 portal frontend can consume.

**Architecture:** New Supabase project `dailongai-portal` (separate from fleet_ops). Migrations as SQL files under `supabase/migrations/`. RLS enforced for all multi-tenant tables. Commission calculation as `BEFORE UPDATE` trigger on `orders` that fires when `status` transitions to `approved`, computing dealer-tier and supervisor-tier payouts in one DB transaction. All tests written in pgTAP and runnable via `supabase test db`.

**Tech Stack:** Supabase (Postgres 15), Supabase CLI, pgTAP, plpgsql.

**Reference spec:** [docs/superpowers/specs/2026-05-21-dailongai-portal-design.md](../specs/2026-05-21-dailongai-portal-design.md)

---

## File Structure

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Local Supabase project config (db port, auth providers stubbed). |
| `supabase/migrations/20260521120000_profiles.sql` | `profiles` table extending `auth.users`. |
| `supabase/migrations/20260521120100_product_models.sql` | Product catalog. |
| `supabase/migrations/20260521120200_dealer_commissions.sql` | Tier-1 commission rules. |
| `supabase/migrations/20260521120300_supervisor_overrides.sql` | Tier-2 override rules. |
| `supabase/migrations/20260521120400_orders.sql` | Orders with status state machine. |
| `supabase/migrations/20260521120500_commission_payouts.sql` | Snapshot of computed payouts. |
| `supabase/migrations/20260521120600_audit_log.sql` | Immutable audit trail. |
| `supabase/migrations/20260521120700_sales_documents.sql` | Sales material references. |
| `supabase/migrations/20260521120800_storage_buckets.sql` | `receipts` (private) + `sales-docs` (role-gated). |
| `supabase/migrations/20260521120900_rls_profiles.sql` | RLS policies on `profiles`. |
| `supabase/migrations/20260521121000_rls_orders.sql` | RLS policies on `orders`. |
| `supabase/migrations/20260521121100_rls_commissions.sql` | RLS on `dealer_commissions` + `supervisor_overrides` + `commission_payouts`. |
| `supabase/migrations/20260521121200_rls_audit_docs.sql` | RLS on `audit_log`, `product_models`, `sales_documents`. |
| `supabase/migrations/20260521121300_commission_calc_fn.sql` | `calc_commission(order_id)` function + trigger on `orders`. |
| `supabase/migrations/20260521121400_audit_triggers.sql` | Triggers writing to `audit_log` on key tables. |
| `supabase/tests/01_schema_smoke.sql` | pgTAP: tables, columns, constraints exist. |
| `supabase/tests/02_rls_profiles.sql` | pgTAP: profile access control. |
| `supabase/tests/03_rls_orders.sql` | pgTAP: order access control. |
| `supabase/tests/04_rls_commissions.sql` | pgTAP: commission rule + payout access control. |
| `supabase/tests/05_commission_calc.sql` | pgTAP: commission calc correctness (fixed, percent, supervisor override). |
| `supabase/tests/06_audit_log.sql` | pgTAP: audit log immutability + content. |
| `supabase/seed.sql` | Dev seed: 1 admin, 1 supervisor, 2 dealers, 2 products, 2 commission rules, 1 override. |

---

## Prerequisites (do once before Task 1)

- Supabase CLI installed: `brew install supabase/tap/supabase` then `supabase --version` (must be ≥ 1.200).
- Working directory: `cd /Users/agentopenclaw/Downloads/dai-long-landing`.
- Branch: `git checkout -b portal-foundation` from current HEAD.

---

## Task 1: Initialize Supabase project locally

**Files:**
- Create: `supabase/config.toml`
- Modify: `.gitignore` (append `supabase/.branches`, `supabase/.temp`)

- [ ] **Step 1: Init Supabase project**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
supabase init
```

Expected: creates `supabase/config.toml`, `supabase/seed.sql` (empty), `.gitignore` entries.

- [ ] **Step 2: Configure project ID and disable remote-only features**

Edit `supabase/config.toml`:

```toml
project_id = "dailongai-portal"

[api]
enabled = true
port = 54321

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/portal/auth/callback", "https://dailongai.com/portal/auth/callback"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true

[auth.external.google]
enabled = false
client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"

[auth.external.facebook]
enabled = false
client_id = "env(SUPABASE_AUTH_FACEBOOK_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_FACEBOOK_SECRET)"
```

OAuth providers stay `enabled = false` here (Plan 2 enables them after registering OAuth apps).

- [ ] **Step 3: Start local Supabase stack**

```bash
supabase start
```

Expected output ends with `API URL: http://127.0.0.1:54321` and prints anon/service keys. Save them — Plan 2 needs them.

- [ ] **Step 4: Verify stack health**

```bash
curl -s http://127.0.0.1:54321/rest/v1/ -H "apikey: $(supabase status -o env | grep ANON_KEY | cut -d= -f2)" | head -5
```

Expected: JSON `{"swagger": "2.0", ...}` — confirms PostgREST reachable.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/seed.sql .gitignore
git commit -m "feat(portal): init Supabase project for dailongai-portal"
```

---

## Task 2: Create `profiles` table

**Files:**
- Create: `supabase/migrations/20260521120000_profiles.sql`
- Create: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Write the failing schema smoke test (profiles)**

Create `supabase/tests/01_schema_smoke.sql`:

```sql
BEGIN;
SELECT plan(8);

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_column('public', 'profiles', 'id', 'profiles.id exists');
SELECT has_column('public', 'profiles', 'role', 'profiles.role exists');
SELECT has_column('public', 'profiles', 'status', 'profiles.status exists');
SELECT has_column('public', 'profiles', 'supervisor_id', 'profiles.supervisor_id exists');
SELECT col_is_pk('public', 'profiles', 'id', 'profiles.id is PK');
SELECT col_is_fk('public', 'profiles', 'supervisor_id', 'profiles.supervisor_id is FK');
SELECT col_not_null('public', 'profiles', 'status', 'profiles.status NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run smoke test to verify it fails**

```bash
supabase test db --linked=false 2>&1 | head -20
```

Expected: `not ok` lines for all assertions because `profiles` doesn't exist yet.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260521120000_profiles.sql`:

```sql
CREATE TYPE profile_role AS ENUM ('dealer', 'supervisor', 'admin');
CREATE TYPE profile_status AS ENUM ('pending', 'active', 'suspended');

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    role profile_role,
    status profile_status NOT NULL DEFAULT 'pending',
    supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    business_name TEXT,
    business_address TEXT,
    id_number TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT supervisor_only_for_dealer
        CHECK (supervisor_id IS NULL OR role = 'dealer')
);

CREATE INDEX idx_profiles_supervisor ON public.profiles(supervisor_id) WHERE supervisor_id IS NOT NULL;
CREATE INDEX idx_profiles_role_status ON public.profiles(role, status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 4: Apply migration and re-run smoke test**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -10
```

Expected: 8 pass / 0 fail on the profile assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120000_profiles.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add profiles table extending auth.users"
```

---

## Task 3: Create `product_models` table

**Files:**
- Create: `supabase/migrations/20260521120100_product_models.sql`
- Modify: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Extend the smoke test**

Append to `supabase/tests/01_schema_smoke.sql` (replace `SELECT plan(8);` with `SELECT plan(13);` and add the assertions before `SELECT * FROM finish();`):

```sql
SELECT has_table('public', 'product_models', 'product_models table exists');
SELECT has_column('public', 'product_models', 'code', 'product_models.code exists');
SELECT col_is_unique('public', 'product_models', ARRAY['code'], 'product_models.code is UNIQUE');
SELECT has_column('public', 'product_models', 'active', 'product_models.active exists');
SELECT col_not_null('public', 'product_models', 'name', 'product_models.name NOT NULL');
```

- [ ] **Step 2: Run test, expect new assertions to fail**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok|ok 1[0-3]"
```

Expected: assertions 9-13 fail.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260521120100_product_models.sql`:

```sql
CREATE TABLE public.product_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER product_models_set_updated_at
BEFORE UPDATE ON public.product_models
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -5
```

Expected: 13 pass / 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120100_product_models.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add product_models catalog table"
```

---

## Task 4: Create `dealer_commissions` table (tier-1 rules)

**Files:**
- Create: `supabase/migrations/20260521120200_dealer_commissions.sql`
- Modify: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Extend smoke test (plan to 18)**

Bump `SELECT plan(13);` → `SELECT plan(18);` and add:

```sql
SELECT has_table('public', 'dealer_commissions', 'dealer_commissions exists');
SELECT has_column('public', 'dealer_commissions', 'commission_type', 'has commission_type');
SELECT has_column('public', 'dealer_commissions', 'rate_value', 'has rate_value');
SELECT has_column('public', 'dealer_commissions', 'effective_from', 'has effective_from');
SELECT col_is_fk('public', 'dealer_commissions', 'dealer_id', 'dealer_id is FK');
```

- [ ] **Step 2: Run, expect 5 new failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260521120200_dealer_commissions.sql`:

```sql
CREATE TYPE commission_type AS ENUM ('fixed', 'percent');

CREATE TABLE public.dealer_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    model_id UUID REFERENCES public.product_models(id) ON DELETE CASCADE,
    commission_type commission_type NOT NULL,
    rate_value NUMERIC(12, 4) NOT NULL CHECK (rate_value >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    set_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT percent_in_range CHECK (commission_type <> 'percent' OR rate_value <= 100)
);

CREATE INDEX idx_dealer_commissions_lookup
    ON public.dealer_commissions(dealer_id, model_id, effective_from DESC);
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -5
```

Expected: 18 pass / 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120200_dealer_commissions.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add dealer_commissions tier-1 rules"
```

---

## Task 5: Create `supervisor_overrides` table (tier-2 rules)

**Files:**
- Create: `supabase/migrations/20260521120300_supervisor_overrides.sql`
- Modify: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Extend smoke test (plan to 22)**

Bump `SELECT plan(18);` → `SELECT plan(22);` and add:

```sql
SELECT has_table('public', 'supervisor_overrides', 'supervisor_overrides exists');
SELECT has_column('public', 'supervisor_overrides', 'override_percent', 'has override_percent');
SELECT col_is_fk('public', 'supervisor_overrides', 'supervisor_id', 'supervisor_id is FK');
SELECT col_is_fk('public', 'supervisor_overrides', 'dealer_id', 'dealer_id is FK');
```

- [ ] **Step 2: Run, expect 4 new failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260521120300_supervisor_overrides.sql`:

```sql
CREATE TABLE public.supervisor_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dealer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    model_id UUID REFERENCES public.product_models(id) ON DELETE CASCADE,
    override_percent NUMERIC(6, 4) NOT NULL CHECK (override_percent >= 0 AND override_percent <= 100),
    effective_from DATE NOT NULL,
    effective_to DATE,
    set_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT effective_range_sv CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_supervisor_overrides_lookup
    ON public.supervisor_overrides(supervisor_id, dealer_id, model_id, effective_from DESC);
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -5
```

Expected: 22 pass / 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120300_supervisor_overrides.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add supervisor_overrides tier-2 rules"
```

---

## Task 6: Create `orders` table with state machine

**Files:**
- Create: `supabase/migrations/20260521120400_orders.sql`
- Modify: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Extend smoke test (plan to 29)**

Bump `SELECT plan(22);` → `SELECT plan(29);` and add:

```sql
SELECT has_table('public', 'orders', 'orders table exists');
SELECT has_column('public', 'orders', 'serial_number', 'has serial_number');
SELECT col_is_unique('public', 'orders', ARRAY['serial_number'], 'serial_number UNIQUE');
SELECT has_column('public', 'orders', 'status', 'has status');
SELECT col_not_null('public', 'orders', 'status', 'status NOT NULL');
SELECT has_column('public', 'orders', 'sale_price', 'has sale_price');
SELECT has_column('public', 'orders', 'sale_date', 'has sale_date');
```

- [ ] **Step 2: Run, expect 7 new failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260521120400_orders.sql`:

```sql
CREATE TYPE order_status AS ENUM ('pending', 'approved', 'rejected', 'paid', 'voided');

CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.profiles(id),
    model_id UUID NOT NULL REFERENCES public.product_models(id),
    serial_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    sale_price NUMERIC(12, 2) NOT NULL CHECK (sale_price > 0),
    sale_date DATE NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    receipt_image_url TEXT,
    contract_image_url TEXT,
    notes TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    rejection_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reject_needs_reason
        CHECK (status <> 'rejected' OR (rejection_reason IS NOT NULL AND length(rejection_reason) > 0)),
    CONSTRAINT approve_needs_approver
        CHECK (status NOT IN ('approved', 'paid') OR approved_by IS NOT NULL)
);

CREATE INDEX idx_orders_dealer ON public.orders(dealer_id, sale_date DESC);
CREATE INDEX idx_orders_status ON public.orders(status, created_at DESC);

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -5
```

Expected: 29 pass / 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120400_orders.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add orders table with status state machine"
```

---

## Task 7: Create `commission_payouts` table

**Files:**
- Create: `supabase/migrations/20260521120500_commission_payouts.sql`
- Modify: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Extend smoke test (plan to 33)**

Bump `SELECT plan(29);` → `SELECT plan(33);` and add:

```sql
SELECT has_table('public', 'commission_payouts', 'commission_payouts exists');
SELECT has_column('public', 'commission_payouts', 'recipient_role', 'has recipient_role');
SELECT col_is_fk('public', 'commission_payouts', 'order_id', 'order_id is FK');
SELECT col_is_fk('public', 'commission_payouts', 'recipient_id', 'recipient_id is FK');
```

- [ ] **Step 2: Run, expect 4 new failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260521120500_commission_payouts.sql`:

```sql
CREATE TYPE recipient_role AS ENUM ('dealer', 'supervisor');

CREATE TABLE public.commission_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id),
    recipient_role recipient_role NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ,
    payment_proof_url TEXT,
    voided_at TIMESTAMPTZ,
    UNIQUE (order_id, recipient_id, recipient_role)
);

CREATE INDEX idx_payouts_recipient ON public.commission_payouts(recipient_id, calculated_at DESC);
CREATE INDEX idx_payouts_order ON public.commission_payouts(order_id);
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -5
```

Expected: 33 pass / 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120500_commission_payouts.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add commission_payouts snapshot table"
```

---

## Task 8: Create `audit_log` (immutable) + `sales_documents` tables

**Files:**
- Create: `supabase/migrations/20260521120600_audit_log.sql`
- Create: `supabase/migrations/20260521120700_sales_documents.sql`
- Modify: `supabase/tests/01_schema_smoke.sql`

- [ ] **Step 1: Extend smoke test (plan to 39)**

Bump `SELECT plan(33);` → `SELECT plan(39);` and add:

```sql
SELECT has_table('public', 'audit_log', 'audit_log exists');
SELECT has_column('public', 'audit_log', 'action', 'audit_log.action exists');
SELECT has_column('public', 'audit_log', 'before', 'audit_log.before exists');
SELECT has_column('public', 'audit_log', 'after', 'audit_log.after exists');
SELECT has_table('public', 'sales_documents', 'sales_documents exists');
SELECT has_column('public', 'sales_documents', 'visible_to', 'sales_documents.visible_to exists');
```

- [ ] **Step 2: Run, expect 6 new failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write `audit_log` migration**

Create `supabase/migrations/20260521120600_audit_log.sql`:

```sql
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_target ON public.audit_log(target_table, target_id, created_at DESC);
CREATE INDEX idx_audit_actor ON public.audit_log(actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_log_block_modify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable';
END;
$$;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_modify();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_modify();
```

- [ ] **Step 4: Write `sales_documents` migration**

Create `supabase/migrations/20260521120700_sales_documents.sql`:

```sql
CREATE TYPE doc_category AS ENUM ('catalog', 'video', 'contract_template', 'manual');
CREATE TYPE doc_visibility AS ENUM ('all', 'dealer', 'supervisor');

CREATE TABLE public.sales_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    category doc_category NOT NULL,
    visible_to doc_visibility NOT NULL DEFAULT 'all',
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 5: Apply + verify**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -5
```

Expected: 39 pass / 0 fail.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260521120600_audit_log.sql supabase/migrations/20260521120700_sales_documents.sql supabase/tests/01_schema_smoke.sql
git commit -m "feat(portal): add audit_log (immutable) + sales_documents"
```

---

## Task 9: Create storage buckets

**Files:**
- Create: `supabase/migrations/20260521120800_storage_buckets.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260521120800_storage_buckets.sql`:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('receipts', 'receipts', FALSE, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
    ('sales-docs', 'sales-docs', FALSE, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Apply migration**

```bash
supabase db reset
```

- [ ] **Step 3: Verify buckets created**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT id, public, file_size_limit FROM storage.buckets ORDER BY id;"
```

Expected:

```
    id     | public | file_size_limit
-----------+--------+-----------------
 receipts  | f      |         5242880
 sales-docs| f      |        52428800
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260521120800_storage_buckets.sql
git commit -m "feat(portal): create receipts + sales-docs storage buckets"
```

---

## Task 10: RLS — `profiles` access control

**Files:**
- Create: `supabase/migrations/20260521120900_rls_profiles.sql`
- Create: `supabase/tests/02_rls_profiles.sql`

- [ ] **Step 1: Write the failing RLS test**

Create `supabase/tests/02_rls_profiles.sql`:

```sql
BEGIN;
SELECT plan(6);

-- Seed: 1 admin, 1 supervisor (sv1), 2 dealers (d1 under sv1, d2 standalone)
INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000002', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000003', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000004', 'd2@dailongai.com');

INSERT INTO public.profiles (id, full_name, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'Supervisor 1', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'Dealer 1', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'Dealer 2', 'dealer', 'active', NULL);

-- Test as dealer 1
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT results_eq(
    'SELECT count(*)::int FROM public.profiles',
    ARRAY[1],
    'dealer sees only own profile'
);

-- Test as supervisor 1
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SELECT results_eq(
    'SELECT count(*)::int FROM public.profiles',
    ARRAY[2],
    'supervisor sees self + team (1 dealer)'
);
SELECT results_eq(
    'SELECT count(*)::int FROM public.profiles WHERE id = ''00000000-0000-0000-0000-000000000004''',
    ARRAY[0],
    'supervisor does NOT see dealer outside team'
);

-- Test as admin
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT results_eq(
    'SELECT count(*)::int FROM public.profiles',
    ARRAY[4],
    'admin sees all profiles'
);

-- Test as anon
RESET ROLE;
SET LOCAL ROLE anon;
SELECT results_eq(
    'SELECT count(*)::int FROM public.profiles',
    ARRAY[0],
    'anon sees nothing'
);

-- Dealer cannot UPDATE role of self
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT throws_ok(
    $$UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-000000000003'$$,
    'dealer cannot escalate role'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect all 6 fail (no RLS yet → all return 4 rows)**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write RLS policies**

Create `supabase/migrations/20260521120900_rls_profiles.sql`:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS profile_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY profiles_select_self
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY profiles_select_team
    ON public.profiles FOR SELECT
    USING (
        supervisor_id = auth.uid()
        AND public.current_role() = 'supervisor'
    );

CREATE POLICY profiles_select_admin
    ON public.profiles FOR SELECT
    USING (public.current_role() = 'admin');

CREATE POLICY profiles_insert_self
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid() AND role IS NULL AND status = 'pending');

CREATE POLICY profiles_update_self_limited
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
        AND supervisor_id IS NOT DISTINCT FROM (SELECT supervisor_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY profiles_admin_all
    ON public.profiles FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
```

- [ ] **Step 4: Apply + run RLS test**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | grep -E "ok|not ok" | head -10
```

Expected: 6/6 pass in `02_rls_profiles.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120900_rls_profiles.sql supabase/tests/02_rls_profiles.sql
git commit -m "feat(portal): RLS policies for profiles (dealer/supervisor/admin)"
```

---

## Task 11: RLS — `orders` access control

**Files:**
- Create: `supabase/migrations/20260521121000_rls_orders.sql`
- Create: `supabase/tests/03_rls_orders.sql`

- [ ] **Step 1: Write failing RLS test**

Create `supabase/tests/03_rls_orders.sql`:

```sql
BEGIN;
SELECT plan(5);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000002', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000003', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000004', 'd2@dailongai.com');
INSERT INTO public.profiles (id, full_name, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'SV1', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'D1', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'D2', 'dealer', 'active', NULL);

INSERT INTO public.product_models (id, code, name, base_price)
VALUES ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 50000000);

INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES
    ('20000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000001',
     'SN-D1-001', 'Khach 1', '0901111111', 55000000, '2026-05-15'),
    ('20000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000004',
     '10000000-0000-0000-0000-000000000001',
     'SN-D2-001', 'Khach 2', '0902222222', 60000000, '2026-05-15');

-- D1 sees own
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT results_eq(
    'SELECT count(*)::int FROM public.orders',
    ARRAY[1],
    'dealer sees only own orders'
);

-- D1 cannot SELECT D2 order
SELECT results_eq(
    $$SELECT count(*)::int FROM public.orders WHERE id = '20000000-0000-0000-0000-000000000002'$$,
    ARRAY[0],
    'dealer cannot see other dealer orders'
);

-- SV1 sees D1 (team) order
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SELECT results_eq(
    'SELECT count(*)::int FROM public.orders',
    ARRAY[1],
    'supervisor sees team orders'
);

-- SV1 cannot SELECT D2 (not in team)
SELECT results_eq(
    $$SELECT count(*)::int FROM public.orders WHERE id = '20000000-0000-0000-0000-000000000002'$$,
    ARRAY[0],
    'supervisor cannot see non-team orders'
);

-- Admin sees all
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT results_eq(
    'SELECT count(*)::int FROM public.orders',
    ARRAY[2],
    'admin sees all orders'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write RLS migration**

Create `supabase/migrations/20260521121000_rls_orders.sql`:

```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_dealer_select_own
    ON public.orders FOR SELECT
    USING (dealer_id = auth.uid());

CREATE POLICY orders_dealer_insert_own
    ON public.orders FOR INSERT
    WITH CHECK (
        dealer_id = auth.uid()
        AND status = 'pending'
        AND approved_at IS NULL
        AND approved_by IS NULL
    );

CREATE POLICY orders_dealer_update_own_pending
    ON public.orders FOR UPDATE
    USING (dealer_id = auth.uid() AND status = 'pending')
    WITH CHECK (dealer_id = auth.uid() AND status = 'pending');

CREATE POLICY orders_supervisor_select_team
    ON public.orders FOR SELECT
    USING (
        public.current_role() = 'supervisor'
        AND dealer_id IN (
            SELECT id FROM public.profiles WHERE supervisor_id = auth.uid()
        )
    );

CREATE POLICY orders_admin_all
    ON public.orders FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
```

- [ ] **Step 4: Apply + run**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | grep -E "ok|not ok"
```

Expected: 5/5 pass on `03_rls_orders.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521121000_rls_orders.sql supabase/tests/03_rls_orders.sql
git commit -m "feat(portal): RLS policies for orders"
```

---

## Task 12: RLS — commissions + supervisor_overrides + payouts

**Files:**
- Create: `supabase/migrations/20260521121100_rls_commissions.sql`
- Create: `supabase/tests/04_rls_commissions.sql`

- [ ] **Step 1: Write failing RLS test**

Create `supabase/tests/04_rls_commissions.sql`:

```sql
BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000002', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000003', 'd1@dailongai.com');
INSERT INTO public.profiles (id, full_name, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'SV1', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'D1', 'dealer', 'active', '00000000-0000-0000-0000-000000000002');

INSERT INTO public.dealer_commissions
    (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000003', NULL, 'fixed', 5000000, '2026-01-01', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.supervisor_overrides
    (supervisor_id, dealer_id, model_id, override_percent, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, 2.5, '2026-01-01', '00000000-0000-0000-0000-000000000001');

-- Dealer sees own commission rule
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT results_eq(
    'SELECT count(*)::int FROM public.dealer_commissions',
    ARRAY[1],
    'dealer sees own commission rule'
);

-- Dealer CANNOT see supervisor_overrides
SELECT results_eq(
    'SELECT count(*)::int FROM public.supervisor_overrides',
    ARRAY[0],
    'dealer cannot see supervisor_overrides'
);

-- Supervisor sees own override
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SELECT results_eq(
    'SELECT count(*)::int FROM public.supervisor_overrides',
    ARRAY[1],
    'supervisor sees own override'
);

-- Admin sees all rules
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT results_eq(
    '(SELECT count(*)::int FROM public.dealer_commissions) + (SELECT count(*)::int FROM public.supervisor_overrides)',
    ARRAY[2],
    'admin sees all commission + override rules'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect failures**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write RLS migration**

Create `supabase/migrations/20260521121100_rls_commissions.sql`:

```sql
ALTER TABLE public.dealer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dealer_commissions_select_own
    ON public.dealer_commissions FOR SELECT
    USING (dealer_id = auth.uid());

CREATE POLICY dealer_commissions_admin_all
    ON public.dealer_commissions FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

CREATE POLICY supervisor_overrides_select_own
    ON public.supervisor_overrides FOR SELECT
    USING (supervisor_id = auth.uid());

CREATE POLICY supervisor_overrides_admin_all
    ON public.supervisor_overrides FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

CREATE POLICY payouts_select_own
    ON public.commission_payouts FOR SELECT
    USING (recipient_id = auth.uid());

CREATE POLICY payouts_admin_all
    ON public.commission_payouts FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
```

- [ ] **Step 4: Apply + run**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | grep -E "ok|not ok"
```

Expected: 4/4 pass on `04_rls_commissions.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521121100_rls_commissions.sql supabase/tests/04_rls_commissions.sql
git commit -m "feat(portal): RLS for commission rules + payouts"
```

---

## Task 13: RLS — audit_log + product_models + sales_documents

**Files:**
- Create: `supabase/migrations/20260521121200_rls_audit_docs.sql`

- [ ] **Step 1: Write RLS migration**

Create `supabase/migrations/20260521121200_rls_audit_docs.sql`:

```sql
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;

-- audit_log: admin SELECT only; INSERT via SECURITY DEFINER functions
CREATE POLICY audit_log_admin_select
    ON public.audit_log FOR SELECT
    USING (public.current_role() = 'admin');

-- product_models: all authenticated SELECT active; admin all
CREATE POLICY product_models_select_active
    ON public.product_models FOR SELECT
    USING (active = TRUE);

CREATE POLICY product_models_admin_all
    ON public.product_models FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

-- sales_documents: role-gated visibility
CREATE POLICY sales_docs_select_by_visibility
    ON public.sales_documents FOR SELECT
    USING (
        visible_to = 'all'
        OR (visible_to = 'dealer' AND public.current_role() = 'dealer')
        OR (visible_to = 'supervisor' AND public.current_role() = 'supervisor')
        OR public.current_role() = 'admin'
    );

CREATE POLICY sales_docs_admin_all
    ON public.sales_documents FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
```

- [ ] **Step 2: Apply migration**

```bash
supabase db reset 2>&1 | tail -5
```

Expected: `Resetting database... Initialising schema... Applying migration ... Finished supabase db reset.`

- [ ] **Step 3: Manually verify RLS for audit_log (psql)**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'EOF'
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000099';
SELECT count(*) FROM public.audit_log;
EOF
```

Expected: `0` rows (authenticated user without admin role cannot SELECT audit_log).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260521121200_rls_audit_docs.sql
git commit -m "feat(portal): RLS for audit_log, product_models, sales_documents"
```

---

## Task 14: Commission calculation function + trigger

**Files:**
- Create: `supabase/migrations/20260521121300_commission_calc_fn.sql`
- Create: `supabase/tests/05_commission_calc.sql`

- [ ] **Step 1: Write failing test for commission calc**

Create `supabase/tests/05_commission_calc.sql`:

```sql
BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000002', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000003', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000004', 'd2@dailongai.com');
INSERT INTO public.profiles (id, full_name, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'SV1', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'D1', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'D2', 'dealer', 'active', NULL);

INSERT INTO public.product_models (id, code, name, base_price)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 50000000),
    ('10000000-0000-0000-0000-000000000002', 'ZD-B', 'Zhi Dun B', 80000000);

-- D1: fixed 5M per Zhi Dun A
INSERT INTO public.dealer_commissions
    (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
     'fixed', 5000000, '2026-01-01', '00000000-0000-0000-0000-000000000001');

-- D2: 8% of sale_price for ANY model
INSERT INTO public.dealer_commissions
    (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000004', NULL,
     'percent', 8, '2026-01-01', '00000000-0000-0000-0000-000000000001');

-- SV1: 2.5% override on team
INSERT INTO public.supervisor_overrides
    (supervisor_id, dealer_id, model_id, override_percent, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, 2.5, '2026-01-01', '00000000-0000-0000-0000-000000000001');

-- ORDER A: D1 sells Zhi Dun A at 55M
INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES
    ('20000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000001',
     'SN-A-001', 'Khach A', '0901111111', 55000000, '2026-05-15');

-- Approve order A → trigger commission calc
UPDATE public.orders
SET status = 'approved',
    approved_at = now(),
    approved_by = '00000000-0000-0000-0000-000000000001'
WHERE id = '20000000-0000-0000-0000-000000000001';

-- Expect 2 payouts: D1 fixed 5M + SV1 2.5% of 55M = 1,375,000
SELECT results_eq(
    $$SELECT count(*)::int FROM public.commission_payouts WHERE order_id = '20000000-0000-0000-0000-000000000001'$$,
    ARRAY[2],
    'order A produces 2 payouts (dealer + supervisor)'
);
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts
      WHERE order_id = '20000000-0000-0000-0000-000000000001'
        AND recipient_role = 'dealer'$$,
    ARRAY['5000000.00'],
    'dealer fixed payout 5M'
);
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts
      WHERE order_id = '20000000-0000-0000-0000-000000000001'
        AND recipient_role = 'supervisor'$$,
    ARRAY['1375000.00'],
    'supervisor override 2.5% of 55M = 1,375,000'
);

-- ORDER B: D2 sells Zhi Dun B at 90M (no supervisor)
INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES
    ('20000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000004',
     '10000000-0000-0000-0000-000000000002',
     'SN-B-001', 'Khach B', '0902222222', 90000000, '2026-05-15');
UPDATE public.orders
SET status = 'approved',
    approved_at = now(),
    approved_by = '00000000-0000-0000-0000-000000000001'
WHERE id = '20000000-0000-0000-0000-000000000002';

-- Expect 1 payout: D2 8% of 90M = 7.2M
SELECT results_eq(
    $$SELECT count(*)::int FROM public.commission_payouts WHERE order_id = '20000000-0000-0000-0000-000000000002'$$,
    ARRAY[1],
    'order B produces 1 payout (no supervisor)'
);
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts
      WHERE order_id = '20000000-0000-0000-0000-000000000002'$$,
    ARRAY['7200000.00'],
    'dealer percent payout 8% of 90M = 7,200,000'
);

-- Idempotency: re-approve → no duplicate payout (UNIQUE constraint)
UPDATE public.orders
SET status = 'paid'
WHERE id = '20000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.commission_payouts WHERE order_id = '20000000-0000-0000-0000-000000000001'$$,
    ARRAY[2],
    'transition approved→paid does not re-trigger payout'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test, expect failures (no function yet)**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write the function + trigger**

Create `supabase/migrations/20260521121300_commission_calc_fn.sql`:

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
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

    SELECT * INTO v_dealer FROM public.profiles WHERE id = v_order.dealer_id;

    SELECT * INTO v_rule
    FROM public.dealer_commissions
    WHERE dealer_id = v_order.dealer_id
      AND (model_id = v_order.model_id OR model_id IS NULL)
      AND effective_from <= v_order.sale_date
      AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
    ORDER BY (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No commission rule for dealer % at sale_date %', v_order.dealer_id, v_order.sale_date;
    END IF;

    IF v_rule.commission_type = 'fixed' THEN
        v_dealer_amount := v_rule.rate_value;
    ELSE
        v_dealer_amount := ROUND(v_rule.rate_value / 100.0 * v_order.sale_price, 2);
    END IF;

    INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
    VALUES (p_order_id, v_order.dealer_id, 'dealer', v_dealer_amount)
    ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;

    IF v_dealer.supervisor_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM public.supervisor_overrides
        WHERE supervisor_id = v_dealer.supervisor_id
          AND (dealer_id = v_order.dealer_id OR dealer_id IS NULL)
          AND (model_id = v_order.model_id OR model_id IS NULL)
          AND effective_from <= v_order.sale_date
          AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
        ORDER BY
            (dealer_id IS NOT NULL) DESC,
            (model_id IS NOT NULL) DESC,
            effective_from DESC,
            created_at DESC
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

CREATE OR REPLACE FUNCTION public.orders_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF (TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'approved') THEN
        PERFORM public.calc_commission(NEW.id);
    END IF;

    IF (TG_OP = 'UPDATE'
        AND OLD.status IN ('approved', 'paid')
        AND NEW.status = 'voided') THEN
        UPDATE public.commission_payouts
        SET voided_at = now()
        WHERE order_id = NEW.id AND voided_at IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER orders_commission_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_on_approve();
```

- [ ] **Step 4: Apply + run commission test**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -10
```

Expected: 6/6 pass on `05_commission_calc.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521121300_commission_calc_fn.sql supabase/tests/05_commission_calc.sql
git commit -m "feat(portal): commission calc function + approval trigger (2-tier)"
```

---

## Task 15: Audit triggers on key tables

**Files:**
- Create: `supabase/migrations/20260521121400_audit_triggers.sql`
- Create: `supabase/tests/06_audit_log.sql`

- [ ] **Step 1: Write failing audit test**

Create `supabase/tests/06_audit_log.sql`:

```sql
BEGIN;
SELECT plan(3);

INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000003', 'd1@dailongai.com');
INSERT INTO public.profiles (id, full_name, role, status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active'),
    ('00000000-0000-0000-0000-000000000003', 'D1', 'dealer', 'active');
INSERT INTO public.product_models (id, code, name, base_price)
VALUES ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 50000000);
INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES ('00000000-0000-0000-0000-000000000003', NULL, 'fixed', 1000000, '2026-01-01', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        'SN-001', 'K', '0900000000', 50000000, '2026-05-15');

-- Approve as admin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
UPDATE public.orders
SET status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000000001'
WHERE id = '20000000-0000-0000-0000-000000000001';

RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.audit_log
       WHERE target_table = 'orders' AND action = 'approve_order'$$,
    ARRAY[1],
    'audit row created on order approval'
);

-- audit_log immutable: UPDATE must fail
SELECT throws_ok(
    $$UPDATE public.audit_log SET action = 'tampered' WHERE target_table = 'orders'$$,
    'audit_log UPDATE blocked'
);
SELECT throws_ok(
    $$DELETE FROM public.audit_log WHERE target_table = 'orders'$$,
    'audit_log DELETE blocked'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect first assertion failing**

```bash
supabase test db --linked=false 2>&1 | grep -E "not ok"
```

- [ ] **Step 3: Write audit triggers**

Create `supabase/migrations/20260521121400_audit_triggers.sql`:

```sql
CREATE OR REPLACE FUNCTION public.write_audit(
    p_action TEXT,
    p_target_table TEXT,
    p_target_id UUID,
    p_before JSONB,
    p_after JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    INSERT INTO public.audit_log (actor_id, action, target_table, target_id, before, after)
    VALUES (auth.uid(), p_action, p_target_table, p_target_id, p_before, p_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF (OLD.status = 'pending' AND NEW.status = 'approved') THEN
        v_action := 'approve_order';
    ELSIF (OLD.status = 'pending' AND NEW.status = 'rejected') THEN
        v_action := 'reject_order';
    ELSIF (OLD.status IN ('approved', 'paid') AND NEW.status = 'voided') THEN
        v_action := 'void_order';
    ELSIF (OLD.status = 'approved' AND NEW.status = 'paid') THEN
        v_action := 'mark_paid';
    ELSE
        RETURN NEW;
    END IF;

    PERFORM public.write_audit(v_action, 'orders', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
END;
$$;

CREATE TRIGGER orders_audit
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_audit_trigger();

CREATE OR REPLACE FUNCTION public.profiles_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.supervisor_id IS DISTINCT FROM NEW.supervisor_id THEN
        PERFORM public.write_audit('update_profile', 'profiles', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_audit
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_audit_trigger();

CREATE OR REPLACE FUNCTION public.commissions_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.write_audit('insert_' || TG_TABLE_NAME, TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.write_audit('update_' || TG_TABLE_NAME, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.write_audit('delete_' || TG_TABLE_NAME, TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER dealer_commissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.dealer_commissions
FOR EACH ROW EXECUTE FUNCTION public.commissions_audit_trigger();

CREATE TRIGGER supervisor_overrides_audit
AFTER INSERT OR UPDATE OR DELETE ON public.supervisor_overrides
FOR EACH ROW EXECUTE FUNCTION public.commissions_audit_trigger();
```

- [ ] **Step 4: Apply + run audit test**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -10
```

Expected: 3/3 pass on `06_audit_log.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521121400_audit_triggers.sql supabase/tests/06_audit_log.sql
git commit -m "feat(portal): audit triggers on orders, profiles, commission rules"
```

---

## Task 16: Dev seed data

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write seed file**

Replace `supabase/seed.sql` with:

```sql
INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000002', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000003', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000004', 'd2@dailongai.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, phone, email, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Boss Admin', '0900000001', 'admin@dailongai.com', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'Supervisor 1', '0900000002', 'sv1@dailongai.com', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'Dealer 1', '0900000003', 'd1@dailongai.com', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'Dealer 2', '0900000004', 'd2@dailongai.com', 'dealer', 'active', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_models (id, code, name, description, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 'Máy laser bán dẫn dòng A', 50000000),
    ('10000000-0000-0000-0000-000000000002', 'ZD-B', 'Zhi Dun B', 'Máy laser bán dẫn dòng B', 80000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by) VALUES
    ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'fixed', 5000000, '2026-01-01', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000004', NULL, 'percent', 8, '2026-01-01', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.supervisor_overrides (supervisor_id, dealer_id, model_id, override_percent, effective_from, set_by) VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, 2.5, '2026-01-01', '00000000-0000-0000-0000-000000000001');
```

- [ ] **Step 2: Apply seed via reset**

```bash
supabase db reset
```

Expected: migrations + seed applied without error.

- [ ] **Step 3: Verify seed**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;"
```

Expected:

```
   role    | count
-----------+-------
 admin     |     1
 dealer    |     2
 supervisor|     1
```

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(portal): dev seed data (1 admin, 1 sv, 2 dealers, 2 models, 3 rules)"
```

---

## Task 17: Full test suite green run + smoke E2E

**Files:** None (verification task)

- [ ] **Step 1: Run full pgTAP suite**

```bash
supabase db reset
supabase test db --linked=false 2>&1 | tail -30
```

Expected: all test files report `PASS` and overall summary shows `Result: PASS` with total count across all 6 test files.

- [ ] **Step 2: Manual smoke E2E via psql**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'EOF'
-- Dealer 1 inserts an order (as authenticated)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
INSERT INTO public.orders (dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('00000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        'E2E-SMOKE-001', 'Khach E2E', '0911111111', 55000000, '2026-05-21')
RETURNING id;

-- Admin approves it
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
UPDATE public.orders
SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE serial_number='E2E-SMOKE-001';

-- Verify 2 payouts
RESET ROLE;
SELECT recipient_role, amount FROM public.commission_payouts
WHERE order_id = (SELECT id FROM public.orders WHERE serial_number='E2E-SMOKE-001')
ORDER BY recipient_role;
EOF
```

Expected output ends with:

```
 recipient_role |   amount
----------------+------------
 dealer         | 5000000.00
 supervisor     | 1375000.00
```

- [ ] **Step 3: Verify audit log captured the approval**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'EOF'
SELECT action, target_table, after->>'status' AS new_status, actor_id
FROM public.audit_log
WHERE target_table = 'orders'
ORDER BY created_at DESC
LIMIT 1;
EOF
```

Expected: 1 row with `action='approve_order'`, `new_status='approved'`, `actor_id='00000000-0000-0000-0000-000000000001'`.

- [ ] **Step 4: Commit nothing, push branch**

```bash
git push -u origin portal-foundation
```

Expected: branch pushed. No new commits — this task is verification only.

- [ ] **Step 5: Plan 1 done — record completion**

Output to console: "Plan 1 — Foundation complete. 14 migrations + 6 pgTAP test files + seed. All RLS, commission calc, and audit triggers verified."

Then proceed to **Task 18: Final Verification Gate** (mandatory before claiming Plan 1 done).

---

## Task 18: Multi-task Verification Gate (CLAUDE.md §8.5)

**Files:** None — verification + reporting only.

**Why this exists:** Plan 1 is a chain of ≥2 code tasks (14 migrations, 6 test files, 1 seed, 1 function module). Per CLAUDE.md §8.5 Code Discipline rule 5, before claiming "done/xong/hoàn tất/✅", Sen Coder MUST invoke `superpowers:verification-before-completion`, run stack-appropriate verify commands, and paste their output as evidence. No tool output = no done claim.

- [ ] **Step 1: Invoke verification skill**

Run the `Skill` tool with `skill: superpowers:verification-before-completion`. Follow whatever checklist that skill prints — do not skip steps and do not summarize the output to the user.

- [ ] **Step 2: Run full pgTAP suite from a cold reset**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
supabase db reset 2>&1 | tail -5
supabase test db --linked=false 2>&1 | tee /tmp/plan1-pgtap.log | tail -20
```

Expected: every test file under `supabase/tests/` reports `ok` and the summary shows total `PASS`. Paste the last 20 lines of `/tmp/plan1-pgtap.log` into the response.

- [ ] **Step 3: Count migrations and confirm chronological order**

```bash
ls supabase/migrations/ | sort | nl
```

Expected: exactly 14 migration files in lexicographic order matching the file table at the top of this plan. Paste the output.

- [ ] **Step 4: Verify storage buckets and RLS state**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
SELECT id, public, file_size_limit FROM storage.buckets ORDER BY id;
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public' AND tablename IN
  ('profiles','orders','dealer_commissions','supervisor_overrides','commission_payouts','audit_log','product_models','sales_documents')
ORDER BY tablename;"
```

Expected: 2 buckets (`receipts`, `sales-docs`) both `public=f`; all 8 tables with `rowsecurity=t`. Paste the output.

- [ ] **Step 5: Re-run E2E smoke from Task 17 Step 2 against the fresh reset**

Re-run the heredoc psql block from Task 17 Step 2. Expected: same `dealer 5,000,000.00` + `supervisor 1,375,000.00` payout rows. Paste the output.

- [ ] **Step 6: Git status clean check**

```bash
git status
git log --oneline portal-foundation ^main 2>/dev/null | head -25
```

Expected: working tree clean, ≥14 commits on `portal-foundation` ahead of base. Paste both outputs.

- [ ] **Step 7: Report done with evidence**

Only after Steps 1–6 produce passing tool output, post a single-message report to Boss containing:

1. Verbatim `tail -20` of `/tmp/plan1-pgtap.log` (Step 2).
2. Migration count + list (Step 3).
3. Bucket + RLS summary (Step 4).
4. E2E payout query result (Step 5).
5. Git log summary (Step 6).
6. One-sentence conclusion: "Plan 1 — Foundation done, all 6 pgTAP suites + E2E smoke pass on cold reset."

If ANY of Steps 2–6 fail or produce unexpected output, DO NOT claim done. Diagnose, fix, re-run from Step 2. Do not amend or skip — fix forward.

---

## Self-Review Notes

- **Spec coverage**: 8 tables ✅, RLS for all multi-tenant tables ✅, commission 2-tier ✅, audit log immutable ✅, storage buckets ✅, seed data ✅.
- **Out of scope here (Plan 2-4)**: OAuth provider enablement, Next.js client integration, notification dispatch, frontend pages, mobile polish.
- **Naming consistency check**: `calc_commission`, `orders_on_approve`, `current_role`, `write_audit` — all stable across tasks. `audit_log` columns `before`/`after` jsonb (not `before_data`/`after_data` — fixed from spec for SQL ergonomics).
- **Edge case coverage**: rule lookup ranking (model-specific first, then created_at DESC tiebreaker) handled in calc_commission. UNIQUE on (order_id, recipient_id, recipient_role) prevents duplicate payouts on re-trigger.
- **Known gap to be picked up in Plan 2**: dealer `INSERT INTO orders` requires `dealer_id = auth.uid()` — this works once Plan 2 wires Supabase Auth JWT correctly. The pgTAP tests stub it via `SET LOCAL "request.jwt.claim.sub"`.
