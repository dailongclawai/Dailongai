BEGIN;
SELECT plan(6);

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

INSERT INTO public.product_models (id, code, name, base_price) VALUES
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

-- Approve order A
UPDATE public.orders
SET status = 'approved',
    approved_at = now(),
    approved_by = '00000000-0000-0000-0000-000000000001'
WHERE id = '20000000-0000-0000-0000-000000000001';

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

-- Idempotency: re-approve → no duplicate payout
UPDATE public.orders SET status = 'paid' WHERE id = '20000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.commission_payouts WHERE order_id = '20000000-0000-0000-0000-000000000001'$$,
    ARRAY[2],
    'transition approved->paid does not re-trigger payout'
);

SELECT * FROM finish();
ROLLBACK;
