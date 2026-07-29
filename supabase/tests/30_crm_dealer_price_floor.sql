BEGIN;
SELECT plan(7);

-- Boss chốt 29/07/2026: giá đại lý được chiết khấu tối đa 20% so với 29.500.000,
-- tức sàn 23.600.000. Cơ hội bán cho đại lý không được ghi thấp hơn sàn.
-- Bán lẻ không bị chặn.

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff1@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c', full_name='Nhân viên 1'
 WHERE id='00000000-0000-0000-0000-00000000005c';

INSERT INTO public.product_models (id, code, name, base_price, dealer_price)
VALUES ('a2000000-0000-0000-0000-000000000001','JG-668','Máy laser ZhiDun', 29500000, 23600000);

-- 1. sàn đúng bằng 29.500.000 trừ 20%
SELECT results_eq(
    $$SELECT round(base_price * 0.8, 2) = dealer_price FROM public.product_models WHERE code='JG-668'$$,
    ARRAY[true],
    'giá đại lý 23.600.000 đúng bằng giá niêm yết trừ 20%'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, kind, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000d1','Đại lý Miền Bắc','dealer_prospect',
        '00000000-0000-0000-0000-00000000005c'),
       ('20000000-0000-0000-0000-0000000000b1','Chị Hoa','customer',
        '00000000-0000-0000-0000-00000000005c');

-- 2. bán cho đại lý đúng sàn thì qua
SELECT lives_ok(
    $$INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, model_id, quantity, amount, owner_id)
      SELECT '30000000-0000-0000-0000-0000000000d1','20000000-0000-0000-0000-0000000000d1',
             (SELECT id FROM public.crm_stages WHERE sort_order=1),
             'Đại lý - 1 máy','a2000000-0000-0000-0000-000000000001',1, 23600000,
             '00000000-0000-0000-0000-00000000005c'$$,
    'bán cho đại lý đúng sàn 23.600.000 thì lưu được'
);

-- 3. thấp hơn sàn 1 đồng cũng bị chặn
SELECT throws_ok(
    $$UPDATE public.crm_opportunities SET amount = 23599999
      WHERE id='30000000-0000-0000-0000-0000000000d1'$$,
    'P0001',
    NULL,
    'thấp hơn sàn dù chỉ 1 đồng vẫn bị chặn'
);

-- 4. sàn nhân theo số lượng
SELECT throws_ok(
    $$UPDATE public.crm_opportunities SET quantity = 3, amount = 60000000
      WHERE id='30000000-0000-0000-0000-0000000000d1'$$,
    'P0001',
    NULL,
    '3 máy thì sàn là 70.800.000, ghi 60 triệu bị chặn'
);
SELECT lives_ok(
    $$UPDATE public.crm_opportunities SET quantity = 3, amount = 70800000
      WHERE id='30000000-0000-0000-0000-0000000000d1'$$,
    '3 máy đúng sàn 70.800.000 thì qua'
);

-- 5. bán lẻ KHÔNG bị chặn — Boss chưa đặt sàn cho kênh này
SELECT lives_ok(
    $$INSERT INTO public.crm_opportunities (account_id, stage_id, name, model_id, quantity, amount, owner_id)
      SELECT '20000000-0000-0000-0000-0000000000b1',
             (SELECT id FROM public.crm_stages WHERE sort_order=1),
             'Chị Hoa - giảm sâu','a2000000-0000-0000-0000-000000000001',1, 10000000,
             '00000000-0000-0000-0000-00000000005c'$$,
    'khách bán lẻ không bị chặn sàn'
);

-- 6. model chưa đặt giá đại lý thì không chặn gì cả
-- (bảng sản phẩm chỉ admin ghi được nên phải đổi quyền, chạy dưới staff sẽ không ăn)
SET LOCAL ROLE postgres;
UPDATE public.product_models SET dealer_price = NULL WHERE code='JG-668';
SET LOCAL ROLE authenticated;
SELECT lives_ok(
    $$UPDATE public.crm_opportunities SET amount = 1000
      WHERE id='30000000-0000-0000-0000-0000000000d1'$$,
    'chưa đặt giá đại lý thì không có sàn để chặn'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
