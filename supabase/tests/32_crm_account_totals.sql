BEGIN;
SELECT plan(9);

-- Boss báo 29/07/2026: bảng Khách hàng phải hiện số máy khách đặt và hoa hồng dự
-- kiến của nhân viên cho khách đó. Cộng dồn từ cơ hội, bỏ qua cơ hội đã thua.

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff2@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c', full_name='Nhân viên 1' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b', full_name='Nhân viên 2' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='admin', status='active', full_name='Boss'       WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1','Chị Hoa','0912345678','00000000-0000-0000-0000-00000000005c');

-- 1. khách chưa có cơ hội nào thì về 0, không phải NULL
SELECT results_eq(
    $$SELECT total_quantity, expected_commission, open_deals
      FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (0, 0::numeric, 0)$$,
    'khách chưa có cơ hội thì các con số về 0 chứ không rỗng'
);

-- cơ hội 1: 2 máy, 59 triệu
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, quantity, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=3),
       'Đợt 1 - 2 máy', 2, 59000000, '00000000-0000-0000-0000-00000000005c';

-- 2. cộng đúng số máy và hoa hồng 10%
SELECT results_eq(
    $$SELECT total_quantity, expected_commission
      FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (2, 5900000::numeric)$$,
    '2 máy, hoa hồng dự kiến 5.900.000'
);

-- cơ hội 2: thêm 1 máy, 29,5 triệu
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, quantity, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=5),
       'Đợt 2 - 1 máy', 1, 29500000, '00000000-0000-0000-0000-00000000005c';

-- 3. nhiều cơ hội thì cộng dồn
SELECT results_eq(
    $$SELECT total_quantity, expected_commission
      FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (3, 8850000::numeric)$$,
    'hai cơ hội cộng dồn thành 3 máy và 8.850.000'
);

-- 4. đếm đúng số cơ hội đang mở
SELECT results_eq(
    $$SELECT open_deals FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[2],
    'đang có 2 cơ hội mở'
);

-- cơ hội 3: thua
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, quantity, amount, owner_id, lost_reason_id)
SELECT '30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE forecast='lost'),
       'Đợt 3 - hỏng ăn', 5, 147500000, '00000000-0000-0000-0000-00000000005c',
       (SELECT id FROM public.crm_lost_reasons WHERE name='Giá cao');

-- 5. cơ hội đã thua KHÔNG được cộng vào
SELECT results_eq(
    $$SELECT total_quantity, expected_commission
      FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (3, 8850000::numeric)$$,
    'cơ hội đã thua không được cộng vào số máy lẫn hoa hồng'
);

-- 6. cơ hội đã hoàn thành vẫn được tính
UPDATE public.crm_opportunities
   SET stage_id = (SELECT id FROM public.crm_stages WHERE forecast='won')
 WHERE id='30000000-0000-0000-0000-000000000002';
SELECT results_eq(
    $$SELECT total_quantity, expected_commission, open_deals
      FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (3, 8850000::numeric, 1)$$,
    'cơ hội đã hoàn thành vẫn tính vào tổng, nhưng không còn là cơ hội mở'
);

-- 7. đổi tỉ lệ hoa hồng thì con số dự kiến đổi theo
RESET ROLE;
UPDATE public.crm_settings SET staff_rate = 0.2000;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
SELECT results_eq(
    $$SELECT expected_commission FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[17700000::numeric],
    'đổi tỉ lệ sang 20% thì hoa hồng dự kiến đổi theo'
);
RESET ROLE;
UPDATE public.crm_settings SET staff_rate = 0.1000;
SET LOCAL ROLE authenticated;

-- 8. nhân viên khác không thấy khách này, nên cũng không thấy con số nào
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
SELECT is_empty(
    $$SELECT 1 FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    'nhân viên khác không thấy khách của người ta (RLS vẫn kín)'
);

-- 9. admin thấy đủ tổng của khách đó
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT total_quantity, expected_commission
      FROM public.crm_account_list WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (3, 8850000::numeric)$$,
    'admin thấy đủ tổng số máy và hoa hồng dự kiến'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
