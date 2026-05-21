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
    ('00000000-0000-0000-0000-000000000003', NULL, 'pending')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;

INSERT INTO public.product_models (id, code, name, base_price)
VALUES ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 50000000);

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
SET LOCAL "request.jwt.claim.sub" = '';

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
