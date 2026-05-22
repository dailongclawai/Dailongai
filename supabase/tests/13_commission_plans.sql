BEGIN;
SELECT plan(6);

SELECT has_table('public', 'commission_plans', 'commission_plans catalog exists');
SELECT ok(
    (SELECT count(*) FROM public.commission_plans WHERE active) >= 3,
    'at least 3 active plans seeded'
);
SELECT ok(
    EXISTS (SELECT 1 FROM public.commission_plans WHERE commission_type = 'fixed' AND active)
    AND EXISTS (SELECT 1 FROM public.commission_plans WHERE commission_type = 'percent' AND active),
    'catalog has both percent and fixed plans'
);

TRUNCATE public.profiles CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000b1','authenticated','authenticated','sup@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d9','authenticated','authenticated','d9@dailongai.com');
UPDATE public.profiles SET role='supervisor', status='active', supervisor_id=NULL WHERE id='00000000-0000-0000-0000-0000000000b1';
UPDATE public.profiles SET role='dealer', status='active', supervisor_id='00000000-0000-0000-0000-0000000000b1' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active', supervisor_id=NULL WHERE id='00000000-0000-0000-0000-0000000000d9';

-- Supervisor assigns a percent plan to a dealer under them
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000b1';
SELECT lives_ok(
    $$SELECT public.supervisor_set_commission('00000000-0000-0000-0000-0000000000d1'::uuid,
        (SELECT id FROM public.commission_plans WHERE commission_type='percent' AND active ORDER BY rate_value LIMIT 1))$$,
    'supervisor sets a plan for own dealer'
);
RESET ROLE;
SELECT results_eq(
    $$SELECT commission_type::text FROM public.dealer_commissions WHERE dealer_id='00000000-0000-0000-0000-0000000000d1' ORDER BY created_at DESC LIMIT 1$$,
    ARRAY['percent'],
    'dealer_commissions override written from the chosen plan'
);

-- Supervisor cannot set commission for a dealer not under them
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000b1';
SELECT throws_ok(
    $$SELECT public.supervisor_set_commission('00000000-0000-0000-0000-0000000000d9'::uuid,
        (SELECT id FROM public.commission_plans WHERE active LIMIT 1))$$,
    NULL, NULL,
    'supervisor cannot set commission for a dealer outside their branch'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
