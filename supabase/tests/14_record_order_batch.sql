BEGIN;
SELECT plan(4);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';
INSERT INTO public.product_models (id, code, name, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001','ZD-A','Zhi Dun A',50000000);

-- Dealer records a 3-machine order in one checkout
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT results_eq(
    $$SELECT public.record_order_batch('Khach','0901234567',NULL,'2026-05-22',NULL,
        '[{"model_id":"10000000-0000-0000-0000-000000000001","serial_number":"B-001","sale_price":50000000},
          {"model_id":"10000000-0000-0000-0000-000000000001","serial_number":"B-002","sale_price":50000000},
          {"model_id":"10000000-0000-0000-0000-000000000001","serial_number":"B-003","sale_price":50000000}]'::jsonb)$$,
    ARRAY[3],
    'batch returns count of machines recorded'
);
SELECT results_eq(
    $$SELECT count(*)::int FROM public.orders WHERE dealer_id='00000000-0000-0000-0000-0000000000d1' AND status='pending'$$,
    ARRAY[3],
    'three pending order rows created for the dealer'
);

-- Duplicate serial inside a batch is atomic: nothing extra inserted
SELECT throws_ok(
    $$SELECT public.record_order_batch('Khach2','0902222222',NULL,'2026-05-22',NULL,
        '[{"model_id":"10000000-0000-0000-0000-000000000001","serial_number":"B-100","sale_price":50000000},
          {"model_id":"10000000-0000-0000-0000-000000000001","serial_number":"B-100","sale_price":50000000}]'::jsonb)$$,
    NULL, NULL,
    'duplicate serial within batch rejected'
);
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.orders WHERE serial_number='B-100'$$,
    ARRAY[0],
    'failed batch inserted nothing (atomic)'
);

SELECT * FROM finish();
ROLLBACK;
