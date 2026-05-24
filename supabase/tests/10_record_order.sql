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
