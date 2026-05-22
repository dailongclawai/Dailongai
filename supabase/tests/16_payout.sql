BEGIN;
SELECT plan(8);

-- Setup
TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

-- Insert users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.com',  '$2a$10$placeholder', NOW(), '{}'),
  ('d0000000-0000-0000-0000-000000000001', 'dealer1@test.com', '$2a$10$placeholder', NOW(), '{}'),
  ('d0000000-0000-0000-0000-000000000002', 'dealer2@test.com', '$2a$10$placeholder', NOW(), '{}');

INSERT INTO public.profiles (id, email, role, status, full_name)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.com',   'admin',  'active', 'Admin'),
  ('d0000000-0000-0000-0000-000000000001', 'dealer1@test.com', 'dealer', 'active', 'Đại Lý 1'),
  ('d0000000-0000-0000-0000-000000000002', 'dealer2@test.com', 'dealer', 'active', 'Đại Lý 2')
ON CONFLICT (id) DO UPDATE
  SET role=EXCLUDED.role, status=EXCLUDED.status, full_name=EXCLUDED.full_name;

INSERT INTO public.product_models (id, code, name, base_price, active)
VALUES ('a2000000-0000-0000-0000-000000000001', 'ZD-01', 'Zhi Dun Model', 50000000, true);

-- Insert order with status=approved (approved_by required by check constraint)
INSERT INTO public.orders
  (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date,
   status, approved_by, approved_at)
VALUES
  ('a3000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'a2000000-0000-0000-0000-000000000001',
   'TEST-001', 'Khách A', '0900000001', 50000000, '2026-05-22',
   'approved', 'a0000000-0000-0000-0000-000000000001', NOW());

-- Seed commission_tiers so calc_commission works
INSERT INTO public.commission_tiers (label, min_units, percent, active)
VALUES ('Tier 1', 0, 15, true)
ON CONFLICT DO NOTHING;

-- Manually insert payout rows (setup only, bypasses RLS as superuser)
INSERT INTO public.commission_payouts (id, order_id, recipient_id, recipient_role, amount, paid_at, payment_proof_url)
VALUES
  -- payout-01: pending (used for T1 admin process test)
  ('a4000000-0000-0000-0000-000000000001',
   'a3000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'dealer', 7500000, NULL, NULL),
  -- payout-02: pending (used for T6 non-admin test)
  ('a4000000-0000-0000-0000-000000000002',
   'a3000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'dealer', 7500000, NULL, NULL),
  -- payout-50: already paid (used for T5 double-processing test)
  ('a4000000-0000-0000-0000-000000000050',
   'a3000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'dealer', 3000000, NOW(), 'PRE-PAID-REF'),
  -- payout-99: dealer2 (used for T8 RLS test)
  ('a4000000-0000-0000-0000-000000000099',
   'a3000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000002',
   'dealer', 1000000, NULL, NULL)
ON CONFLICT DO NOTHING;

-- T1: Admin can process a pending payout
SET LOCAL "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.admin_process_payout(
       'a4000000-0000-0000-0000-000000000001',
       'TCB-REF-20260522'
     ) $$,
  'T1: admin can process a pending payout'
);

-- T2: paid_at is now set on the payout
SELECT isnt(
  (SELECT paid_at FROM public.commission_payouts WHERE id = 'a4000000-0000-0000-0000-000000000001'),
  NULL,
  'T2: paid_at set after processing'
);

-- T3: payment_proof_url matches the ref passed in
SELECT is(
  (SELECT payment_proof_url FROM public.commission_payouts WHERE id = 'a4000000-0000-0000-0000-000000000001'),
  'TCB-REF-20260522',
  'T3: payment_proof_url stored correctly'
);

-- T4: A portal_message was sent to the dealer
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.portal_messages
    WHERE recipient_id = 'd0000000-0000-0000-0000-000000000001'
      AND subject = 'Hoa hồng đã được chuyển khoản'
  ),
  'T4: inbox notification sent to dealer after payout'
);

-- T5: Calling admin_process_payout on pre-paid payout (payout-50) raises exception
-- throws_ok(sql, errcode, message, description) — use NULL, NULL to match any exception
SELECT throws_ok(
  $$ SELECT public.admin_process_payout(
       'a4000000-0000-0000-0000-000000000050',
       'DUPE-REF'
     ) $$,
  NULL, NULL,
  'T5: double-processing pre-paid payout raises exception'
);

-- T6: Non-admin cannot call admin_process_payout
RESET ROLE;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.admin_process_payout(
       'a4000000-0000-0000-0000-000000000002',
       'HACK'
     ) $$,
  NULL, NULL,
  'T6: non-admin calling process_payout raises exception'
);

-- T7: Dealer can select own payouts via RLS
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.commission_payouts
    WHERE recipient_id = 'd0000000-0000-0000-0000-000000000001'
  ),
  'T7: dealer can select own commission_payouts'
);

-- T8: Dealer cannot see other dealer's payouts (a4000000-99 belongs to dealer2)
SELECT is(
  (SELECT count(*)::int FROM public.commission_payouts
   WHERE recipient_id = 'd0000000-0000-0000-0000-000000000002'),
  0,
  'T8: dealer cannot see other dealer payouts'
);

SELECT * FROM finish();
ROLLBACK;
