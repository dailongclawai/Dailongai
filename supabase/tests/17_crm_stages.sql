BEGIN;
SELECT plan(6);

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

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- 5. dealer cannot update crm_stages
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT results_eq(
    $$WITH u AS (UPDATE public.crm_stages SET probability = 11
                 WHERE pipeline='b2c_device' AND sort_order=1 RETURNING 1)
      SELECT count(*)::int FROM u$$,
    ARRAY[0],
    'dealer cannot update crm_stages'
);

-- 6. admin can update crm_stages
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$WITH u AS (UPDATE public.crm_stages SET probability = 11
                 WHERE pipeline='b2c_device' AND sort_order=1 RETURNING 1)
      SELECT count(*)::int FROM u$$,
    ARRAY[1],
    'admin can update crm_stages'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
