BEGIN;
SELECT plan(6);

-- Hermetic: clear any seed data so test fixtures load cleanly. ROLLBACK restores.
TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'd2@dailongai.com');

INSERT INTO public.profiles (id, full_name, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'Supervisor 1', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'Dealer 1', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'Dealer 2', 'dealer', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, role=EXCLUDED.role, status=EXCLUDED.status, supervisor_id=EXCLUDED.supervisor_id;

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
    $$SELECT count(*)::int FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000004'$$,
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

-- Test as anon (must clear JWT claim, otherwise auth.uid() leaks from prior SET)
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT results_eq(
    'SELECT count(*)::int FROM public.profiles',
    ARRAY[0],
    'anon sees nothing'
);

-- Dealer cannot UPDATE role of self (RLS denies via WITH CHECK)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT throws_ok(
    $$UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-000000000003'$$,
    NULL,
    NULL,
    'dealer cannot escalate role'
);

SELECT * FROM finish();
ROLLBACK;
