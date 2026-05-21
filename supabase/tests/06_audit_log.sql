BEGIN;
SELECT plan(3);

-- Hermetic: clear any seed data so test fixtures load cleanly. ROLLBACK restores.
TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com');
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
SET LOCAL "request.jwt.claim.sub" = '';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.audit_log
       WHERE target_table = 'orders' AND action = 'approve_order'$$,
    ARRAY[1],
    'audit row created on order approval'
);

-- audit_log immutable: UPDATE/DELETE must fail
SELECT throws_ok(
    $$UPDATE public.audit_log SET action = 'tampered' WHERE target_table = 'orders'$$,
    NULL,
    NULL,
    'audit_log UPDATE blocked'
);
SELECT throws_ok(
    $$DELETE FROM public.audit_log WHERE target_table = 'orders'$$,
    NULL,
    NULL,
    'audit_log DELETE blocked'
);

SELECT * FROM finish();
ROLLBACK;
