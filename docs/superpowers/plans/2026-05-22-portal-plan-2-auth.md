# Portal Plan 2 — Auth & Onboarding (OAuth + Register + Admin Approval)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing auth + onboarding layer on top of Plan 1's DB foundation. Đại lý đăng ký bằng Google/Facebook OAuth (hoặc email fallback) → điền 2 field SĐT + role mong muốn → admin duyệt → nhận role + supervisor_id + commission rule → login vào dashboard placeholder.

**Architecture:** All portal pages under `/portal/**` are `'use client'` React components calling Supabase JS client directly (no server actions, no API routes). Static export hiện tại của marketing site được giữ nguyên — portal routes vẫn build static HTML shell, runtime mounting client-side. OAuth callback route exchanges auth code via Supabase JS, profile auto-creation via Postgres trigger on `auth.users` INSERT, admin approval mutates profile rows via authenticated client (RLS gates write).

**Tech Stack additions (Plan 1 stack +):** `@supabase/supabase-js` (browser client), `@supabase/ssr` (Next.js helpers), `shadcn/ui` (Button, Card, Input, Form, Dialog, Table, Toast), `react-hook-form` + existing `zod` (form validation), `sonner` (toasts), `lucide-react` (icons).

**Reference spec:** [docs/superpowers/specs/2026-05-21-dailongai-portal-design.md](../specs/2026-05-21-dailongai-portal-design.md)

**Prerequisite:** Plan 1 done (branch `portal-foundation` merged or branched from). DB schema + RLS + commission engine + audit triggers + seed all live and verified.

---

## File Structure

| File | Purpose |
|------|---------|
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (committed to `.env.example`, real values gitignored). |
| `src/lib/supabase.ts` | Browser client factory + helpers `getSession()`, `signOut()`. |
| `src/lib/auth-context.tsx` | React context provider for `session` + `profile` state, subscribes to auth state changes. |
| `src/lib/auth-guard.tsx` | `<RequireAuth>` wrapper + role-based redirect logic. |
| `src/lib/portal-types.ts` | TypeScript types matching DB schema (Profile, Order, etc.). |
| `src/app/portal/layout.tsx` | Wraps all `/portal/**` routes with `AuthProvider` + `<Toaster />`. |
| `src/app/portal/page.tsx` | Index → redirect to `/portal/dashboard` if logged in, else `/portal/login`. |
| `src/app/portal/login/page.tsx` | OAuth buttons (Google/FB) + email/password form. |
| `src/app/portal/register/page.tsx` | Same UI as login but registration messaging. |
| `src/app/portal/auth/callback/page.tsx` | OAuth code exchange → redirect to /onboarding if profile incomplete or /dashboard. |
| `src/app/portal/onboarding/page.tsx` | Modal-style page with 2 fields (phone + role). On submit, INSERT profile via RLS. |
| `src/app/portal/dashboard/page.tsx` | Role-based redirect: dealer → `/portal/dealer`, supervisor → `/portal/supervisor`, admin → `/portal/admin`. Pending → "đang chờ duyệt" page. |
| `src/app/portal/pending/page.tsx` | "Đăng ký đang chờ admin duyệt" message + logout. |
| `src/app/portal/profile/page.tsx` | View/edit own profile (full_name, phone), change password, sign out. |
| `src/app/portal/admin/registrations/page.tsx` | Admin queue: list profiles WHERE status='pending', approve/reject form. |
| `src/components/portal/OAuthButton.tsx` | Google + Facebook button variants (lucide icon + style). |
| `src/components/portal/EmailAuthForm.tsx` | Email + password form with magic-link toggle. |
| `src/components/portal/PortalShell.tsx` | Header (logo + user dropdown) + footer for portal pages. |
| `src/components/portal/PendingApprovalCard.tsx` | Shared "chờ duyệt" empty-state component. |
| `src/components/portal/RegistrationRow.tsx` | Single row in admin registrations table with inline form. |
| `supabase/migrations/20260522100000_profile_auto_create.sql` | Trigger on `auth.users` INSERT auto-creating `profiles` row with `status='pending'`. |
| `supabase/migrations/20260522100100_admin_approve_fn.sql` | `admin_approve_registration(profile_id, role, supervisor_id, commission_rule)` SECURITY DEFINER function. |
| `supabase/tests/07_profile_auto_create.sql` | pgTAP: signing up via auth.users creates pending profile. |
| `supabase/tests/08_admin_approve_fn.sql` | pgTAP: approve function sets role+status+supervisor+commission atomically; non-admin caller fails. |
| `tests/unit/portal/auth-context.test.tsx` | Vitest: session subscription updates context. |
| `tests/unit/portal/auth-guard.test.tsx` | Vitest: redirects to /login when no session. |
| `tests/unit/portal/EmailAuthForm.test.tsx` | Vitest: zod validation, email format, password length. |
| `tests/e2e/portal-register-flow.spec.ts` | Playwright: register (mocked OAuth) → onboarding → pending → admin approve → dashboard route resolves. |

---

## Prerequisites (one-time, before Task 1)

- Plan 1 branch ready: `git checkout portal-foundation` (or new branch from it).
- Supabase local stack running: `docker ps | grep supabase` shows 5+ containers.
- Boss has access to:
  - Google Cloud Console (https://console.cloud.google.com) with project create permission
  - Facebook Developer portal (https://developers.facebook.com) with app create permission

---

## Task 1: Branch + dependency install

**Files:**
- Modify: `package.json`
- Create: `.env.example`

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
git checkout portal-foundation
git checkout -b portal-auth
```

- [ ] **Step 2: Install Supabase + form deps**

```bash
npm install @supabase/supabase-js@^2 @supabase/ssr@^0 react-hook-form@^7 sonner@^2 lucide-react@^0.500.0
```

Expected: `package.json` updated, `package-lock.json` updated, no peer dependency errors.

- [ ] **Step 3: Install shadcn/ui components needed**

```bash
npx shadcn@latest add button card input form dialog table toast dropdown-menu
```

Expected: components added under `src/components/ui/`. If `components.json` doesn't exist, run `npx shadcn@latest init` first and pick: Default style, Slate base color, CSS variables yes.

- [ ] **Step 4: Create .env.example with local Supabase keys placeholders**

Create `.env.example`:

```bash
# Supabase (portal)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_LOCAL_ANON_KEY_HERE

# OAuth (Plan 2 task 4 fills these — server-side only)
SUPABASE_AUTH_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_GOOGLE_SECRET=
SUPABASE_AUTH_FACEBOOK_CLIENT_ID=
SUPABASE_AUTH_FACEBOOK_SECRET=
```

- [ ] **Step 5: Populate real .env.local from supabase status**

```bash
echo "NEXT_PUBLIC_SUPABASE_URL=$(supabase status -o env | grep API_URL | cut -d'=' -f2 | tr -d '\"')" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d'=' -f2 | tr -d '\"')" >> .env.local
cat .env.local
```

Expected: 2 env vars set with actual local URL + anon key.

- [ ] **Step 6: Verify .env.local is gitignored**

```bash
grep -E "^\.env\.local$|^\.env$" .gitignore || echo ".env.local" >> .gitignore
git check-ignore -v .env.local
```

Expected: shows `.gitignore:<line>:.env.local .env.local`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore src/components/ui/ components.json
git commit -m "feat(portal): install Supabase + shadcn/ui deps for /portal/* auth"
```

---

## Task 2: Supabase browser client + types

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/portal-types.ts`
- Create: `tests/unit/portal/supabase-client.test.ts`

- [ ] **Step 1: Write failing client test**

Create `tests/unit/portal/supabase-client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getSupabaseClient } from '@/lib/supabase';

describe('getSupabaseClient', () => {
  it('returns same singleton instance on repeated calls', () => {
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
  });

  it('exposes auth helpers', () => {
    const client = getSupabaseClient();
    expect(typeof client.auth.signInWithOAuth).toBe('function');
    expect(typeof client.auth.signOut).toBe('function');
    expect(typeof client.from).toBe('function');
  });
});
```

- [ ] **Step 2: Run, expect fail (module not found)**

```bash
npx vitest run tests/unit/portal/supabase-client.test.ts
```

Expected: fail with "Failed to resolve import '@/lib/supabase'".

- [ ] **Step 3: Write client factory**

Create `src/lib/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  cached = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
```

- [ ] **Step 4: Write portal types**

Create `src/lib/portal-types.ts`:

```ts
export type ProfileRole = 'dealer' | 'supervisor' | 'admin';
export type ProfileStatus = 'pending' | 'active' | 'suspended';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: ProfileRole | null;
  status: ProfileStatus;
  supervisor_id: string | null;
  business_name: string | null;
  business_address: string | null;
  id_number: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  base_price: string; // numeric serialized as string
  active: boolean;
  created_at: string;
}

export interface CommissionRule {
  id: string;
  dealer_id: string;
  model_id: string | null;
  commission_type: 'fixed' | 'percent';
  rate_value: string;
  effective_from: string;
  effective_to: string | null;
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
npx vitest run tests/unit/portal/supabase-client.test.ts
```

Expected: 2/2 pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/portal-types.ts tests/unit/portal/supabase-client.test.ts
git commit -m "feat(portal): Supabase browser client singleton + DB types"
```

---

## Task 3: Profile auto-creation trigger (DB)

**Files:**
- Create: `supabase/migrations/20260522100000_profile_auto_create.sql`
- Create: `supabase/tests/07_profile_auto_create.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/07_profile_auto_create.sql`:

```sql
BEGIN;
SELECT plan(3);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'newuser@example.com',
    '{"full_name":"New User","avatar_url":"https://lh3/avatar.png"}'::jsonb
);

SELECT results_eq(
    $$SELECT count(*)::int FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY[1],
    'profile row auto-created on auth.users INSERT'
);

SELECT results_eq(
    $$SELECT status::text FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY['pending'],
    'auto-created profile has status=pending'
);

SELECT results_eq(
    $$SELECT full_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY['New User'],
    'full_name copied from raw_user_meta_data'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect 3 failures**

```bash
supabase db reset && supabase test db 2>&1 | grep -E "not ok|07_profile"
```

- [ ] **Step 3: Write trigger migration**

Create `supabase/migrations/20260522100000_profile_auto_create.sql`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url',
        'pending'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db 2>&1 | tail -8
```

Expected: 7 files / 66 assertions / Result: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260522100000_profile_auto_create.sql supabase/tests/07_profile_auto_create.sql
git commit -m "feat(portal): auto-create profile row on auth.users INSERT (status=pending)"
```

---

## Task 4: Admin approval function (DB)

**Files:**
- Create: `supabase/migrations/20260522100100_admin_approve_fn.sql`
- Create: `supabase/tests/08_admin_approve_fn.sql`

- [ ] **Step 1: Write failing pgTAP test**

Create `supabase/tests/08_admin_approve_fn.sql`:

```sql
BEGIN;
SELECT plan(5);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sv@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com');

INSERT INTO public.profiles (id, role, status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin', 'active'),
    ('00000000-0000-0000-0000-000000000002', 'supervisor', 'active'),
    ('00000000-0000-0000-0000-000000000003', NULL, 'pending');

INSERT INTO public.product_models (id, code, name, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 50000000);

-- Call as admin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT public.admin_approve_registration(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'dealer'::profile_role,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'fixed'::commission_type,
    5000000,
    NULL
);

RESET ROLE;
SELECT results_eq(
    $$SELECT role::text FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000003'$$,
    ARRAY['dealer'],
    'role set to dealer'
);
SELECT results_eq(
    $$SELECT status::text FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000003'$$,
    ARRAY['active'],
    'status set to active'
);
SELECT results_eq(
    $$SELECT supervisor_id::text FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000003'$$,
    ARRAY['00000000-0000-0000-0000-000000000002'],
    'supervisor_id assigned'
);
SELECT results_eq(
    $$SELECT count(*)::int FROM public.dealer_commissions WHERE dealer_id = '00000000-0000-0000-0000-000000000003'$$,
    ARRAY[1],
    'commission rule created'
);

-- Non-admin caller must fail
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    $$SELECT public.admin_approve_registration(
        '00000000-0000-0000-0000-000000000003'::uuid,
        'dealer'::profile_role,
        NULL,
        'fixed'::commission_type,
        1000000,
        NULL)$$,
    NULL,
    'admin_approve_registration: caller is not admin',
    'non-admin callers rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run, expect failures (function not defined)**

```bash
supabase db reset && supabase test db 2>&1 | grep -E "not ok|08_admin"
```

- [ ] **Step 3: Write function migration**

Create `supabase/migrations/20260522100100_admin_approve_fn.sql`:

```sql
CREATE OR REPLACE FUNCTION public.admin_approve_registration(
    p_profile_id UUID,
    p_role profile_role,
    p_supervisor_id UUID,
    p_commission_type commission_type,
    p_rate_value NUMERIC,
    p_model_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_approve_registration: caller is not admin';
    END IF;

    IF p_role = 'dealer' AND p_supervisor_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_supervisor_id AND role = 'supervisor') THEN
            RAISE EXCEPTION 'admin_approve_registration: supervisor_id % is not a supervisor', p_supervisor_id;
        END IF;
    ELSIF p_role <> 'dealer' AND p_supervisor_id IS NOT NULL THEN
        RAISE EXCEPTION 'admin_approve_registration: only dealers can have supervisor_id';
    END IF;

    UPDATE public.profiles
    SET role = p_role,
        status = 'active',
        supervisor_id = CASE WHEN p_role = 'dealer' THEN p_supervisor_id ELSE NULL END,
        approved_at = now(),
        approved_by = auth.uid()
    WHERE id = p_profile_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_approve_registration: profile % not found or not pending', p_profile_id;
    END IF;

    IF p_role = 'dealer' THEN
        INSERT INTO public.dealer_commissions
            (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
        VALUES
            (p_profile_id, p_model_id, p_commission_type, p_rate_value, CURRENT_DATE, auth.uid());
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_registration TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_registration(
    p_profile_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_reject_registration: caller is not admin';
    END IF;

    UPDATE public.profiles
    SET status = 'suspended',
        approved_at = now(),
        approved_by = auth.uid()
    WHERE id = p_profile_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_reject_registration: profile % not found or not pending', p_profile_id;
    END IF;

    PERFORM public.write_audit('reject_registration', 'profiles', p_profile_id, NULL,
        jsonb_build_object('reason', p_reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_registration TO authenticated;
```

- [ ] **Step 4: Apply + verify**

```bash
supabase db reset
supabase test db 2>&1 | tail -8
```

Expected: 8 files / 71 assertions / Result: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260522100100_admin_approve_fn.sql supabase/tests/08_admin_approve_fn.sql
git commit -m "feat(portal): admin_approve_registration + admin_reject_registration RPC"
```

---

## Task 5: [BOSS MANUAL] OAuth provider setup

This task requires Boss to perform external setup. Sen Coder cannot do this. Instructions for Boss:

**Google Cloud Console:**

1. Go to https://console.cloud.google.com → select project (or create new "dailongai-portal").
2. APIs & Services → OAuth consent screen → External → fill: app name "Đại Long Portal", support email, developer email.
3. Add scopes: `openid`, `email`, `profile`.
4. Test users: add admin@dailongai.com.
5. Credentials → Create Credentials → OAuth client ID → Web application:
   - Name: "Đại Long Portal (local + prod)"
   - Authorized JavaScript origins: `http://localhost:3000`, `https://dailongai.com`
   - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`, `https://<PROD_SUPABASE_REF>.supabase.co/auth/v1/callback` (Plan 4 fills prod).
6. Copy Client ID + Client Secret → paste into `.env.local`:

```bash
SUPABASE_AUTH_GOOGLE_CLIENT_ID=<paste>
SUPABASE_AUTH_GOOGLE_SECRET=<paste>
```

**Facebook Developer:**

1. Go to https://developers.facebook.com/apps → Create App → type "Consumer" (or "Business") → name "Đại Long Portal".
2. Add Product: "Facebook Login".
3. Settings → Basic: fill privacy URL = `https://dailongai.com/dieu-khoan`, App Domains = `localhost`, `dailongai.com`.
4. Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`, `https://<PROD_SUPABASE_REF>.supabase.co/auth/v1/callback`
   - Client OAuth Login: ON
   - Web OAuth Login: ON
5. App Review → Permissions: request `email` + `public_profile` (default approved for dev/test).
6. Copy App ID + App Secret → paste into `.env.local`:

```bash
SUPABASE_AUTH_FACEBOOK_CLIENT_ID=<paste>
SUPABASE_AUTH_FACEBOOK_SECRET=<paste>
```

**Boss output to Sen Coder:** confirm both providers configured + paste env values into `.env.local`. Sen Coder takes over at Task 6.

- [ ] **Step 1: Boss confirms OAuth apps created**
- [ ] **Step 2: Boss pastes 4 secrets into `.env.local`**
- [ ] **Step 3: Verify .env.local has all 4 secrets**

```bash
grep -E "GOOGLE_CLIENT_ID|GOOGLE_SECRET|FACEBOOK_CLIENT_ID|FACEBOOK_SECRET" .env.local | wc -l
```

Expected: `4`.

---

## Task 6: Enable OAuth in Supabase + verify auth flow

**Files:**
- Modify: `supabase/config.toml`

- [ ] **Step 1: Enable Google + Facebook in config.toml**

Edit `supabase/config.toml` `[auth.external.google]`:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"

[auth.external.facebook]
enabled = true
client_id = "env(SUPABASE_AUTH_FACEBOOK_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_FACEBOOK_SECRET)"
```

- [ ] **Step 2: Restart Supabase stack to pick up new config**

```bash
supabase stop && supabase start
```

Expected: stack starts, no auth provider error in logs.

- [ ] **Step 3: Verify provider config loaded**

```bash
curl -s http://127.0.0.1:54321/auth/v1/settings | python3 -m json.tool | head -30
```

Expected: `external` section shows `google: {enabled: true}` and `facebook: {enabled: true}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(portal): enable Google + Facebook OAuth providers in Supabase"
```

---

## Task 7: Auth context provider

**Files:**
- Create: `src/lib/auth-context.tsx`
- Create: `tests/unit/portal/auth-context.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/portal/auth-context.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

vi.mock('@/lib/supabase', () => {
  const listeners: Array<(event: string, session: unknown) => void> = [];
  return {
    getSupabaseClient: () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      __listeners: listeners,
    }),
  };
});

function Probe() {
  const { session, loading } = useAuth();
  return <div data-testid="probe">{loading ? 'loading' : session ? 'authed' : 'anon'}</div>;
}

describe('AuthProvider', () => {
  it('starts in loading state then resolves to anon when no session', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(getByTestId('probe').textContent).toBe('loading');
    await waitFor(() => expect(getByTestId('probe').textContent).toBe('anon'));
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/unit/portal/auth-context.test.tsx
```

- [ ] **Step 3: Write the provider**

Create `src/lib/auth-context.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import type { Profile } from './portal-types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    setProfile((data as Profile) ?? null);
  };

  const refresh = async () => {
    const { data } = await getSupabaseClient().auth.getSession();
    setSession(data.session);
    await fetchProfile(data.session?.user.id);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();
    const { data } = getSupabaseClient().auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await fetchProfile(s?.user.id);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run tests/unit/portal/auth-context.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-context.tsx tests/unit/portal/auth-context.test.tsx
git commit -m "feat(portal): AuthProvider context with session + profile state"
```

---

## Task 8: Portal layout + index redirect

**Files:**
- Create: `src/app/portal/layout.tsx`
- Create: `src/app/portal/page.tsx`
- Create: `src/components/portal/PortalShell.tsx`

- [ ] **Step 1: Write portal layout**

Create `src/app/portal/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Write index redirect page**

Create `src/app/portal/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function PortalIndex() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/portal/login');
    } else if (!profile || profile.status === 'pending' || !profile.role) {
      router.replace('/portal/onboarding');
    } else {
      router.replace('/portal/dashboard');
    }
  }, [loading, session, profile, router]);

  return (
    <div className="flex h-screen items-center justify-center text-slate-500">
      Đang kiểm tra phiên đăng nhập…
    </div>
  );
}
```

- [ ] **Step 3: Write PortalShell**

Create `src/components/portal/PortalShell.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export function PortalShell({ children, title }: { children: ReactNode; title?: string }) {
  const router = useRouter();
  const { profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/portal/login');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <Link href="/portal" className="font-semibold text-slate-900">
          Đại Long Portal
        </Link>
        <div className="flex items-center gap-3">
          {profile && <span className="text-sm text-slate-600">{profile.full_name ?? profile.email}</span>}
          {profile && <Button variant="ghost" size="sm" onClick={handleSignOut}>Đăng xuất</Button>}
        </div>
      </header>
      <main className="flex-1 px-6 py-6">
        {title && <h1 className="mb-4 text-2xl font-semibold">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify build + tsc**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/portal/layout.tsx src/app/portal/page.tsx src/components/portal/PortalShell.tsx
git commit -m "feat(portal): portal layout with AuthProvider + index role-based redirect"
```

---

## Task 9: Register + Login pages

**Files:**
- Create: `src/components/portal/OAuthButton.tsx`
- Create: `src/components/portal/EmailAuthForm.tsx`
- Create: `src/app/portal/login/page.tsx`
- Create: `src/app/portal/register/page.tsx`
- Create: `tests/unit/portal/EmailAuthForm.test.tsx`

- [ ] **Step 1: Write OAuthButton**

Create `src/components/portal/OAuthButton.tsx`:

```tsx
'use client';

import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function OAuthButton({ provider }: { provider: 'google' | 'facebook' }) {
  const label = provider === 'google' ? 'Tiếp tục với Google' : 'Tiếp tục với Facebook';
  const handle = async () => {
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/portal/auth/callback` },
    });
    if (error) toast.error(error.message);
  };
  return (
    <Button onClick={handle} variant="outline" className="w-full" size="lg">
      {label}
    </Button>
  );
}
```

- [ ] **Step 2: Write failing EmailAuthForm test**

Create `tests/unit/portal/EmailAuthForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmailAuthForm } from '@/components/portal/EmailAuthForm';

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('EmailAuthForm', () => {
  it('shows validation error for short password on register', async () => {
    render(<EmailAuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/mật khẩu/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /đăng ký/i }));
    await waitFor(() => expect(screen.getByText(/ít nhất 8 ký tự/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run test, expect fail**

```bash
npx vitest run tests/unit/portal/EmailAuthForm.test.tsx
```

- [ ] **Step 4: Write EmailAuthForm**

Create `src/components/portal/EmailAuthForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
});

export function EmailAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next: typeof errors = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0] === 'email') next.email = i.message;
        if (i.path[0] === 'password') next.password = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    const client = getSupabaseClient();
    const { error } = mode === 'login'
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/portal/auth/callback` },
        });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else if (mode === 'register') {
      toast.success('Kiểm tra email để xác thực tài khoản');
    } else {
      window.location.assign('/portal');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Mật khẩu</label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
npx vitest run tests/unit/portal/EmailAuthForm.test.tsx
```

- [ ] **Step 6: Write login + register pages**

Create `src/app/portal/login/page.tsx`:

```tsx
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { OAuthButton } from '@/components/portal/OAuthButton';
import { EmailAuthForm } from '@/components/portal/EmailAuthForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <h1 className="text-center text-2xl font-semibold">Đăng nhập Đại Long Portal</h1>
        <div className="space-y-3">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          hoặc
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <EmailAuthForm mode="login" />
        <p className="text-center text-sm text-slate-500">
          Chưa có tài khoản? <Link href="/portal/register" className="text-blue-600 hover:underline">Đăng ký</Link>
        </p>
      </Card>
    </div>
  );
}
```

Create `src/app/portal/register/page.tsx`:

```tsx
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { OAuthButton } from '@/components/portal/OAuthButton';
import { EmailAuthForm } from '@/components/portal/EmailAuthForm';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <h1 className="text-center text-2xl font-semibold">Đăng ký Đại lý</h1>
        <p className="text-center text-sm text-slate-500">Chọn cách đăng ký nhanh nhất</p>
        <div className="space-y-3">
          <OAuthButton provider="google" />
          <OAuthButton provider="facebook" />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          hoặc
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <EmailAuthForm mode="register" />
        <p className="text-center text-sm text-slate-500">
          Đã có tài khoản? <Link href="/portal/login" className="text-blue-600 hover:underline">Đăng nhập</Link>
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Verify tsc**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/portal/OAuthButton.tsx src/components/portal/EmailAuthForm.tsx src/app/portal/login src/app/portal/register tests/unit/portal/EmailAuthForm.test.tsx
git commit -m "feat(portal): /portal/login + /portal/register pages (OAuth + email)"
```

---

## Task 10: Auth callback handler

**Files:**
- Create: `src/app/portal/auth/callback/page.tsx`

- [ ] **Step 1: Write callback page**

Create `src/app/portal/auth/callback/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.getSession();
      if (error) {
        toast.error(error.message);
        router.replace('/portal/login');
        return;
      }
      if (data.session) {
        router.replace('/portal');
      } else {
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const { error: exchErr } = await client.auth.exchangeCodeForSession(code);
          if (exchErr) {
            toast.error(exchErr.message);
            router.replace('/portal/login');
            return;
          }
          router.replace('/portal');
        } else {
          router.replace('/portal/login');
        }
      }
    })();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-slate-500">
      Đang hoàn tất đăng nhập…
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/auth/callback
git commit -m "feat(portal): /portal/auth/callback OAuth code exchange handler"
```

---

## Task 11: Onboarding page (2 field form)

**Files:**
- Create: `src/app/portal/onboarding/page.tsx`
- Create: `tests/unit/portal/onboarding-form.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/portal/onboarding-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '@/app/portal/onboarding/page';

const updateMock = vi.fn().mockResolvedValue({ data: {}, error: null });
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: { id: 'u1', status: 'pending', role: null, phone: null },
    loading: false,
    refresh: refreshMock,
  }),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      update: () => ({ eq: updateMock }),
    }),
  }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('OnboardingPage', () => {
  it('rejects invalid Vietnam phone format', async () => {
    render(<OnboardingPage />);
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /hoàn tất/i }));
    await waitFor(() => expect(screen.getByText(/sđt không hợp lệ/i)).toBeInTheDocument());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('submits valid SĐT + role', async () => {
    render(<OnboardingPage />);
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), { target: { value: '0901234567' } });
    fireEvent.click(screen.getByLabelText(/đại lý/i));
    fireEvent.click(screen.getByRole('button', { name: /hoàn tất/i }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('u1'));
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/unit/portal/onboarding-form.test.tsx
```

- [ ] **Step 3: Write onboarding page**

Create `src/app/portal/onboarding/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const phoneSchema = z.string().regex(/^0\d{9,10}$/, 'SĐT không hợp lệ (ví dụ: 0901234567)');

export default function OnboardingPage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const [phone, setPhone] = useState('');
  const [requestedRole, setRequestedRole] = useState<'dealer' | 'supervisor'>('dealer');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.status === 'active') router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? 'SĐT không hợp lệ');
      return;
    }
    setPhoneError('');
    setSubmitting(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ phone, business_name: requestedRole === 'supervisor' ? '[Mong muốn: Supervisor]' : '[Mong muốn: Dealer]' })
      .eq('id', session!.user.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Đã ghi nhận, đang chờ admin duyệt');
    await refresh();
    router.replace('/portal/pending');
  };

  if (loading || !session) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <h1 className="text-center text-2xl font-semibold">Hoàn tất hồ sơ</h1>
        <p className="text-center text-sm text-slate-500">Còn 2 thông tin cuối cùng</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">Số điện thoại</label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" />
            {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Loại tài khoản mong muốn</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="role" checked={requestedRole === 'dealer'} onChange={() => setRequestedRole('dealer')} />
                <span>Đại lý phân phối</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="role" checked={requestedRole === 'supervisor'} onChange={() => setRequestedRole('supervisor')} />
                <span>Supervisor (quản lý nhiều đại lý)</span>
              </label>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Đang gửi…' : 'Hoàn tất'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run tests/unit/portal/onboarding-form.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/app/portal/onboarding tests/unit/portal/onboarding-form.test.tsx
git commit -m "feat(portal): /portal/onboarding 2-field form (SĐT + role declaration)"
```

---

## Task 12: Pending + dashboard placeholder

**Files:**
- Create: `src/app/portal/pending/page.tsx`
- Create: `src/app/portal/dashboard/page.tsx`
- Create: `src/components/portal/PendingApprovalCard.tsx`

- [ ] **Step 1: Write PendingApprovalCard**

Create `src/components/portal/PendingApprovalCard.tsx`:

```tsx
import { Card } from '@/components/ui/card';

export function PendingApprovalCard() {
  return (
    <Card className="mx-auto max-w-md space-y-3 p-8 text-center">
      <h2 className="text-xl font-semibold">Đang chờ admin duyệt</h2>
      <p className="text-sm text-slate-600">
        Hồ sơ đăng ký đã được gửi tới đội Đại Long. Boss/admin sẽ duyệt trong giờ làm việc và thông báo qua email + Zalo OA.
      </p>
    </Card>
  );
}
```

- [ ] **Step 2: Write pending page**

Create `src/app/portal/pending/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { PendingApprovalCard } from '@/components/portal/PendingApprovalCard';

export default function PendingPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.status === 'active') router.replace('/portal/dashboard');
  }, [loading, session, profile, router]);

  if (loading || !session) return null;

  return (
    <PortalShell>
      <PendingApprovalCard />
    </PortalShell>
  );
}
```

- [ ] **Step 3: Write dashboard placeholder**

Create `src/app/portal/dashboard/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';

export default function DashboardPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/portal/login');
      return;
    }
    if (!profile) return;
    if (profile.status !== 'active' || !profile.role) {
      router.replace('/portal/pending');
      return;
    }
    if (profile.role === 'admin') router.replace('/portal/admin/registrations');
    // Plan 3 wires /portal/dealer + /portal/supervisor
  }, [loading, session, profile, router]);

  if (loading || !session || !profile) return null;

  return (
    <PortalShell title="Dashboard">
      <p className="text-slate-500">
        {profile.role === 'dealer' && 'Dealer dashboard (Plan 3).'}
        {profile.role === 'supervisor' && 'Supervisor dashboard (Plan 3).'}
        {profile.role === 'admin' && 'Đang chuyển sang admin queue…'}
      </p>
    </PortalShell>
  );
}
```

- [ ] **Step 4: Verify tsc**

```bash
npx tsc --noEmit 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/PendingApprovalCard.tsx src/app/portal/pending src/app/portal/dashboard
git commit -m "feat(portal): /portal/pending + /portal/dashboard placeholder + role redirect"
```

---

## Task 13: Admin registrations queue

**Files:**
- Create: `src/components/portal/RegistrationRow.tsx`
- Create: `src/app/portal/admin/registrations/page.tsx`

- [ ] **Step 1: Write RegistrationRow**

Create `src/components/portal/RegistrationRow.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Profile, ProductModel, ProfileRole } from '@/lib/portal-types';

export function RegistrationRow({
  profile,
  supervisors,
  models,
  onResolved,
}: {
  profile: Profile;
  supervisors: Profile[];
  models: ProductModel[];
  onResolved: () => void;
}) {
  const [role, setRole] = useState<ProfileRole>('dealer');
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [commissionType, setCommissionType] = useState<'fixed' | 'percent'>('fixed');
  const [rateValue, setRateValue] = useState('5000000');
  const [modelId, setModelId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_approve_registration', {
      p_profile_id: profile.id,
      p_role: role,
      p_supervisor_id: role === 'dealer' && supervisorId ? supervisorId : null,
      p_commission_type: commissionType,
      p_rate_value: Number(rateValue),
      p_model_id: modelId || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Đã duyệt ${profile.email}`);
      onResolved();
    }
  };

  const reject = async () => {
    const reason = window.prompt('Lý do từ chối?');
    if (!reason) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc('admin_reject_registration', {
      p_profile_id: profile.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã từ chối');
      onResolved();
    }
  };

  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-2">
        <div className="text-sm font-medium">{profile.full_name ?? '(không tên)'}</div>
        <div className="text-xs text-slate-500">{profile.email}</div>
        <div className="text-xs text-slate-500">{profile.phone ?? '—'}</div>
        <div className="text-xs italic text-slate-500">{profile.business_name ?? ''}</div>
      </td>
      <td className="px-3 py-2">
        <select value={role} onChange={(e) => setRole(e.target.value as ProfileRole)} className="rounded border px-2 py-1 text-sm">
          <option value="dealer">Dealer</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-3 py-2">
        {role === 'dealer' ? (
          <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="">— Không gán SV —</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
            ))}
          </select>
        ) : '—'}
      </td>
      <td className="px-3 py-2">
        {role === 'dealer' ? (
          <div className="flex items-center gap-2">
            <select value={commissionType} onChange={(e) => setCommissionType(e.target.value as 'fixed' | 'percent')} className="rounded border px-1 py-1 text-xs">
              <option value="fixed">Fixed (VND)</option>
              <option value="percent">% giá</option>
            </select>
            <Input value={rateValue} onChange={(e) => setRateValue(e.target.value)} className="w-28" />
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="rounded border px-1 py-1 text-xs">
              <option value="">Tất cả model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.code}</option>
              ))}
            </select>
          </div>
        ) : '—'}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" disabled={busy} onClick={approve}>Duyệt</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={reject}>Từ chối</Button>
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Write admin registrations page**

Create `src/app/portal/admin/registrations/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { RegistrationRow } from '@/components/portal/RegistrationRow';
import type { Profile, ProductModel } from '@/lib/portal-types';

export default function RegistrationsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [pending, setPending] = useState<Profile[]>([]);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    setFetching(true);
    const client = getSupabaseClient();
    const [{ data: p }, { data: sv }, { data: m }] = await Promise.all([
      client.from('profiles').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      client.from('profiles').select('*').eq('role', 'supervisor').eq('status', 'active'),
      client.from('product_models').select('*').eq('active', true).order('code'),
    ]);
    setPending((p as Profile[]) ?? []);
    setSupervisors((sv as Profile[]) ?? []);
    setModels((m as ProductModel[]) ?? []);
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
    <PortalShell title="Đăng ký chờ duyệt">
      {fetching ? (
        <p className="text-slate-500">Đang tải…</p>
      ) : pending.length === 0 ? (
        <p className="text-slate-500">Không có đăng ký mới.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg bg-white text-left text-sm shadow">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Hồ sơ</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Supervisor</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <RegistrationRow
                key={p.id}
                profile={p}
                supervisors={supervisors}
                models={models}
                onResolved={refresh}
              />
            ))}
          </tbody>
        </table>
      )}
    </PortalShell>
  );
}
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/RegistrationRow.tsx src/app/portal/admin/registrations
git commit -m "feat(portal): /portal/admin/registrations queue with approve/reject inline"
```

---

## Task 14: Profile page

**Files:**
- Create: `src/app/portal/profile/page.tsx`

- [ ] **Step 1: Write profile page**

Create `src/app/portal/profile/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { PortalShell } from '@/components/portal/PortalShell';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [loading, session, profile, router]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã cập nhật');
      await refresh();
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã đổi mật khẩu');
      setNewPassword('');
    }
  };

  if (loading || !session || !profile) return null;

  return (
    <PortalShell title="Tài khoản">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Thông tin</h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm">Email</label>
              <Input id="email" value={profile.email ?? ''} disabled />
            </div>
            <div>
              <label htmlFor="full_name" className="mb-1 block text-sm">Họ tên</label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm">Số điện thoại</label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>Lưu</Button>
          </form>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Đổi mật khẩu</h2>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label htmlFor="new_password" className="mb-1 block text-sm">Mật khẩu mới</label>
              <Input id="new_password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>Đổi mật khẩu</Button>
          </form>
        </Card>
      </div>
    </PortalShell>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/profile
git commit -m "feat(portal): /portal/profile self-edit + password change"
```

---

## Task 15: E2E Playwright register → approve → dashboard

**Files:**
- Create: `tests/e2e/portal-register-flow.spec.ts`

- [ ] **Step 1: Write E2E test**

Create `tests/e2e/portal-register-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('register → onboarding → admin approve → dashboard', async ({ page, context }) => {
  const testEmail = `e2e-${Date.now()}@dailongai.com`;
  const testPassword = 'TestPass123!';

  // 1. Register via email/password
  await page.goto('/portal/register');
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/mật khẩu/i).fill(testPassword);
  await page.getByRole('button', { name: /đăng ký/i }).click();
  await expect(page.getByText(/kiểm tra email/i)).toBeVisible({ timeout: 5000 });

  // 2. Force-confirm email via service role + login
  const admin = createClient(SB_URL, SB_SERVICE);
  const { data: users } = await admin.auth.admin.listUsers();
  const newUser = users.users.find((u) => u.email === testEmail);
  expect(newUser).toBeDefined();
  await admin.auth.admin.updateUserById(newUser!.id, { email_confirm: true });

  const client = createClient(SB_URL, SB_ANON);
  await client.auth.signInWithPassword({ email: testEmail, password: testPassword });
  await context.addCookies([]); // ensure browser picks up storage state via local Supabase client
  await page.goto('/portal/login');
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/mật khẩu/i).fill(testPassword);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/portal\/onboarding/, { timeout: 5000 });

  // 3. Onboarding form
  await page.getByLabel(/số điện thoại/i).fill('0901234567');
  await page.getByRole('button', { name: /hoàn tất/i }).click();
  await page.waitForURL(/\/portal\/pending/, { timeout: 5000 });

  // 4. Admin approves via RPC (bypass UI for speed)
  const { error: approveErr } = await admin.rpc('admin_approve_registration', {
    p_profile_id: newUser!.id,
    p_role: 'dealer',
    p_supervisor_id: null,
    p_commission_type: 'percent',
    p_rate_value: 8,
    p_model_id: null,
  });
  expect(approveErr).toBeNull();

  // 5. Reload pending page → should redirect to dashboard
  await page.reload();
  await page.waitForURL(/\/portal\/dashboard/, { timeout: 5000 });
  await expect(page.getByText(/dealer dashboard/i)).toBeVisible();

  // Cleanup
  await admin.auth.admin.deleteUser(newUser!.id);
});
```

- [ ] **Step 2: Add service role key to .env.local for E2E**

```bash
echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d'=' -f2 | tr -d '\"')" >> .env.local
```

- [ ] **Step 3: Start Next.js dev server in background**

```bash
npm run dev &
DEV_PID=$!
sleep 5
```

- [ ] **Step 4: Run Playwright test**

```bash
npx playwright test tests/e2e/portal-register-flow.spec.ts 2>&1 | tail -15
kill $DEV_PID
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/portal-register-flow.spec.ts .env.local.example  # NOT .env.local
git commit -m "test(portal): E2E register → onboarding → admin approve → dashboard flow"
```

---

## Task 16: Verification Gate (CLAUDE.md §8.5)

**Files:** None — verification + reporting only.

**Why this exists:** Plan 2 is a chain of ≥2 code tasks (2 DB migrations, 5 components, 6 pages, multiple unit + E2E tests). Per CLAUDE.md §8.5, before claiming done Sen Coder MUST invoke `superpowers:verification-before-completion` and run stack-appropriate verify commands with output as evidence.

- [ ] **Step 1: Invoke verification skill**

Run `Skill` tool with `skill: superpowers:verification-before-completion`. Follow the loaded checklist.

- [ ] **Step 2: Run full pgTAP suite from cold reset**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
supabase db reset 2>&1 | tail -3
supabase test db 2>&1 | tee /tmp/plan2-pgtap.log | tail -10
```

Expected: 8 files / 71+ assertions / Result: PASS. Paste last 10 lines.

- [ ] **Step 3: Run Vitest unit suite for portal**

```bash
npx vitest run tests/unit/portal/ 2>&1 | tee /tmp/plan2-vitest.log | tail -10
```

Expected: 0 failed. Paste last 10 lines.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | tee /tmp/plan2-tsc.log | tail -5
```

Expected: 0 errors. Paste.

- [ ] **Step 5: Playwright E2E**

```bash
npm run dev &
DEV_PID=$!
sleep 5
npx playwright test tests/e2e/portal-register-flow.spec.ts 2>&1 | tee /tmp/plan2-e2e.log | tail -10
kill $DEV_PID
```

Expected: 1 passed. Paste.

- [ ] **Step 6: Manual browser smoke (`run` skill or by hand)**

Optional but recommended: open http://localhost:3000/portal/register in browser, walk through:
1. Click "Tiếp tục với Google" — should redirect to Google OAuth (will fail in local without prod redirect; OK to skip if .env.local OAuth not wired)
2. Use email form to register a test account, confirm email manually via Supabase studio (http://127.0.0.1:54323 → Auth → Users → confirm)
3. Log in → land on /portal/onboarding → fill SĐT 0901234567 → submit
4. Land on /portal/pending
5. Open new tab, log in as admin (seed: admin@dailongai.com), go to /portal/admin/registrations
6. See test account, click "Duyệt" → confirmation toast
7. Back to test account tab, reload → redirect to /portal/dashboard

- [ ] **Step 7: Git status + log check**

```bash
git status
git log --oneline portal-auth ^portal-foundation 2>/dev/null | head -20
```

Expected: working tree clean, ≥14 commits ahead of portal-foundation. Paste.

- [ ] **Step 8: Final report with evidence**

Only after Steps 2–7 produce passing tool output, post to Boss:

1. Verbatim `tail -10 /tmp/plan2-pgtap.log` (Step 2)
2. Verbatim `tail -10 /tmp/plan2-vitest.log` (Step 3)
3. tsc output (Step 4)
4. Playwright result (Step 5)
5. Git log summary (Step 7)
6. One-sentence conclusion: "Plan 2 — Auth & Onboarding done, all pgTAP + Vitest + Playwright + tsc pass on cold state."

If ANY step fails or produces unexpected output, DO NOT claim done. Diagnose, fix, re-run.

---

## Self-Review Notes

- **Spec coverage**: OAuth Google + Facebook ✅, email fallback ✅, onboarding 2-field ✅, admin approval queue ✅, profile auto-create trigger ✅, admin_approve_registration RPC ✅, profile management ✅, RLS gates write paths (Plan 1 already done).
- **Out of scope (Plan 3)**: dealer dashboard, order form, admin order approval queue, supervisor team view, reports.
- **Out of scope (Plan 4)**: notification dispatch (Telegram + Zalo OA), sales documents page, mobile-polish pass, production deploy.
- **Naming consistency**: `admin_approve_registration` + `admin_reject_registration` + `handle_new_user` — stable. `getSupabaseClient()` singleton across all client code.
- **Known limitation**: E2E test mocks OAuth via direct admin RPC + email/password; real OAuth flow requires live Google/Facebook redirect that can't run in headless CI. Plan 4 may add a separate manual UAT checklist.
- **Static export compatibility**: every `/portal/**` page is `'use client'`, hydrates client-side, calls Supabase JS. Build still produces static HTML shells; Cloudflare Pages serves them; React mounts on load. Tested pattern by other Next.js 16 + Supabase static export projects.
