BEGIN;
SELECT plan(7);

SELECT has_table('public', 'commission_tiers', 'commission_tiers table exists');
SELECT has_column('public', 'commission_tiers', 'min_units', 'has min_units');
SELECT has_column('public', 'commission_tiers', 'percent', 'has percent');
SELECT results_eq(
    'SELECT count(*)::int FROM public.commission_tiers WHERE active = true',
    ARRAY[3],
    'Tier A seeded with 3 active tiers (15/20/25)'
);

-- Seed dealer with NO override → falls to global tier
TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000001','authenticated','authenticated','admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000003','authenticated','authenticated','d1@dailongai.com');
INSERT INTO public.profiles (id, role, status) VALUES
    ('00000000-0000-0000-0000-000000000001','admin','active'),
    ('00000000-0000-0000-0000-000000000003','dealer','active')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;
INSERT INTO public.product_models (id, code, name, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001','ZD-A','Zhi Dun A',50000000);

-- First sale of the year: 0 prior units → Tier 1 15%
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-001','K','0900000000',50000000,'2026-03-01');
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE id='20000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts WHERE order_id='20000000-0000-0000-0000-000000000001' AND recipient_role='dealer'$$,
    ARRAY['7500000.00'],
    'tier 1: 15% of 50M = 7.5M (0 prior units)'
);

-- Bump dealer to 100 prior approved units by inserting 99 more approved orders + 1 new
DO $$
DECLARE i INT;
BEGIN
  FOR i IN 2..100 LOOP
    INSERT INTO public.orders (dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date, status, approved_at, approved_by)
    VALUES ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-'||lpad(i::text,3,'0'),'K','0900000000',50000000,'2026-03-02','approved',now(),'00000000-0000-0000-0000-000000000001');
  END LOOP;
END $$;
-- Now 100 prior units → next approval should be Tier 2 (20%)
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-101','K','0900000000',50000000,'2026-03-03');
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE id='20000000-0000-0000-0000-000000000002';
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts WHERE order_id='20000000-0000-0000-0000-000000000002' AND recipient_role='dealer'$$,
    ARRAY['10000000.00'],
    'tier 2: 20% of 50M = 10M (100 prior units)'
);

-- Per-dealer override beats tier
INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES ('00000000-0000-0000-0000-000000000003', NULL, 'percent', 30, '2026-01-01', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date)
VALUES ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','T-102','K','0900000000',50000000,'2026-03-04');
UPDATE public.orders SET status='approved', approved_at=now(), approved_by='00000000-0000-0000-0000-000000000001'
WHERE id='20000000-0000-0000-0000-000000000003';
SELECT results_eq(
    $$SELECT amount::text FROM public.commission_payouts WHERE order_id='20000000-0000-0000-0000-000000000003' AND recipient_role='dealer'$$,
    ARRAY['15000000.00'],
    'override 30% of 50M = 15M beats tier'
);

SELECT * FROM finish();
ROLLBACK;
