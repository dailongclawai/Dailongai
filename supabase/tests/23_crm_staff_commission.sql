BEGIN;
SELECT plan(9);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách B2C', '00000000-0000-0000-0000-00000000005c');

-- cơ hội B2C ở giai đoạn mở
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a1',
       '20000000-0000-0000-0000-0000000000a1', 'b2c_device',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=1),
       'Khách B2C - 1 máy', 29500000, '00000000-0000-0000-0000-00000000005c';

-- 1. chưa thắng thì chưa có hoa hồng
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[0],
    'cơ hội đang mở chưa sinh hoa hồng'
);

-- 2. thắng B2C -> 20% của 15tr = 3.000.000
UPDATE public.crm_opportunities
   SET stage_id = (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='won')
 WHERE id = '30000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1' AND role_in_deal='closer'$$,
    ARRAY[3000000::numeric(14,2)],
    'staff B2C chốt deal nhận 20% của 15tr = 3.000.000'
);

-- 3. trạng thái ban đầu là pending
SELECT results_eq(
    $$SELECT status FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['pending'],
    'hoa hồng mới sinh ở trạng thái pending'
);

-- 4. snapshot giá cơ sở và tỷ lệ
SELECT results_eq(
    $$SELECT base_price, rate FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (15000000::numeric(14,2), 0.2000::numeric(5,4))$$,
    'dòng hoa hồng snapshot giá cơ sở + tỷ lệ'
);

-- 5. staff B2B thắng deal B2B -> 10% của 15tr = 1.500.000
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000b1', 'Đại lý tiềm năng', '00000000-0000-0000-0000-00000000005b');
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000b1',
       '20000000-0000-0000-0000-0000000000b1', 'b2b_dealer',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND forecast='won'),
       'Ký hợp tác đại lý', 0, '00000000-0000-0000-0000-00000000005b';
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'$$,
    ARRAY[1500000::numeric(14,2)],
    'staff B2B chốt deal nhận 10% của 15tr = 1.500.000'
);

-- 6. staff chỉ thấy hoa hồng của mình
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[1],
    'staff B2B chỉ thấy 1 dòng của mình'
);

-- 7. admin duyệt -> payable
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT public.admin_confirm_staff_deal('30000000-0000-0000-0000-0000000000a1', NULL)$$,
    ARRAY[1],
    'admin duyệt chuyển 1 dòng sang payable'
);

-- 8. chi khi chưa payable thì bị chặn
SELECT throws_ok(
    $$SELECT public.admin_pay_staff_commission(
        (SELECT id FROM public.crm_staff_commissions
          WHERE opportunity_id='30000000-0000-0000-0000-0000000000b1'), 'TEST')$$,
    'P0001'
);

-- 9. duyệt rồi chi được -> paid
SELECT lives_ok(
    $$SELECT public.admin_pay_staff_commission(
        (SELECT id FROM public.crm_staff_commissions
          WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'), 'CK-001')$$,
    'admin chi được dòng đã duyệt'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
