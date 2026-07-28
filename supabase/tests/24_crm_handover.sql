BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005d','authenticated','authenticated','staff.b2c2@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005d';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_accounts (id, name, kind, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách hoá ra là đại lý',
        'dealer_prospect', '00000000-0000-0000-0000-00000000005c');

-- 1. không bắn được sang staff CÙNG mảng
SELECT throws_ok(
    $$SELECT public.staff_handover_account(
        '20000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000005d', NULL)$$,
    'P0001'
);

-- 2. bắn sang staff mảng đối diện thì được
SELECT lives_ok(
    $$SELECT public.staff_handover_account(
        '20000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000005b', 'Khách này mở phòng khám, chuyển B2B')$$,
    'staff B2C bắn khách sang staff B2B'
);

-- 3. chủ sở hữu khách đã đổi
SELECT results_eq(
    $$SELECT owner_id FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['00000000-0000-0000-0000-00000000005b'::uuid],
    'khách chuyển sang chủ mới'
);

-- 4. người bắn vẫn theo dõi được khách đó
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[1],
    'người bắn khách vẫn đọc được khách đã chuyển'
);

-- 5. người nhận chốt deal -> 3 dòng hoa hồng (1 closer + 2 referrer)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000b1',
       '20000000-0000-0000-0000-0000000000a1', 'b2b_dealer',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND forecast='won'),
       'Chốt hợp tác', 0, '00000000-0000-0000-0000-00000000005b';
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'$$,
    ARRAY[3],
    'deal có chuyển khách sinh 3 dòng: 1 closer + 2 thưởng'
);

-- 6. thưởng chia đôi: 5% của 15tr = 750k, mỗi người 375k
SELECT results_eq(
    $$SELECT DISTINCT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'
        AND role_in_deal='referrer'$$,
    ARRAY[375000::numeric(14,2)],
    'mỗi người nhận 375.000 (5% của 15tr chia đôi)'
);

-- 7. người chốt vẫn ăn đủ 10%, không bị trừ
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'
        AND role_in_deal='closer'$$,
    ARRAY[1500000::numeric(14,2)],
    'thưởng chéo cộng thêm, không trừ vào hoa hồng người chốt'
);

-- 8. handover đã tất toán, deal thứ hai KHÔNG thưởng nữa
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000b2',
       '20000000-0000-0000-0000-0000000000a1', 'b2b_dealer',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND forecast='won'),
       'Máy thứ hai', 0, '00000000-0000-0000-0000-00000000005b';
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b2'
        AND role_in_deal='referrer'$$,
    ARRAY[0],
    'thưởng chuyển khách chỉ tính một lần'
);

SELECT * FROM finish();
ROLLBACK;
