BEGIN;
SELECT plan(5);

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'd2@dailongai.com');

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
