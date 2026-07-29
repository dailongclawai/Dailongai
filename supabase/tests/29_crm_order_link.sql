BEGIN;
SELECT plan(10);

-- Boss chốt 29/07/2026: đại lý và bán lẻ chỉ khác giá, hoa hồng vẫn 10% giá trị
-- đơn. Mắt xích còn thiếu là gắn đơn hàng vào cơ hội — không gắn thì trigger
-- không biết cơ hội nào để ghi hoa hồng.

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff2@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','dealer@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff',  status='active', staff_segment='b2c', full_name='Nhân viên 1' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff',  status='active', staff_segment='b2b', full_name='Nhân viên 2' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- 1. giá đại lý là tuỳ chọn, để trống nghĩa là mua bằng giá niêm yết
INSERT INTO public.product_models (id, code, name, base_price, dealer_price)
VALUES ('a2000000-0000-0000-0000-000000000001', 'JG-668', 'Máy laser ZhiDun', 29500000, 24000000);
SELECT results_eq(
    $$SELECT base_price, dealer_price FROM public.product_models
      WHERE code='JG-668'$$,
    $$VALUES (29500000::numeric(14,2), 24000000::numeric(14,2))$$,
    'model lưu được cả giá niêm yết lẫn giá đại lý'
);

-- 2. giá đại lý phải dương
SELECT throws_ok(
    $$UPDATE public.product_models SET dealer_price = 0 WHERE code='JG-668'$$,
    '23514',
    NULL,
    'giá đại lý không được bằng 0 hay âm'
);

INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status)
VALUES
  ('a3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',
   'a2000000-0000-0000-0000-000000000001','SN-L-001','Chị Hoa','0912345678',
   29500000,1,'2026-07-29','pending'),
  ('a3000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000d1',
   'a2000000-0000-0000-0000-000000000001','SN-L-002','Khách lạ','0988888888',
   29500000,1,'2026-07-28','pending');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1','Chị Hoa','0912345678',
        '00000000-0000-0000-0000-00000000005c');
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=6),
       'Chị Hoa - 1 máy', 29500000, '00000000-0000-0000-0000-00000000005c';

-- 3. nhân viên không đọc thẳng bảng orders được, nhưng tra qua hàm thì thấy
SELECT is_empty(
    $$SELECT 1 FROM public.orders$$,
    'nhân viên không đọc được bảng đơn hàng (RLS vẫn kín)'
);

-- 4. hàm trả về đơn chưa ai nhận, đơn trùng số điện thoại xếp trước
SELECT results_eq(
    $$SELECT serial_number, phone_matches
      FROM public.crm_orders_for_account('20000000-0000-0000-0000-0000000000a1')$$,
    $$VALUES ('SN-L-001'::text, true), ('SN-L-002'::text, false)$$,
    'đơn trùng số điện thoại của khách được xếp lên đầu'
);

-- 5. gắn đơn vào cơ hội
SELECT lives_ok(
    $$SELECT public.crm_link_order('30000000-0000-0000-0000-0000000000a1',
                                   'a3000000-0000-0000-0000-000000000001')$$,
    'người phụ trách gắn được đơn vào cơ hội của mình'
);
SELECT results_eq(
    $$SELECT order_id FROM public.crm_opportunities
      WHERE id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['a3000000-0000-0000-0000-000000000001'::uuid],
    'cơ hội đã nhận đơn'
);

-- 6. đơn đã gắn thì biến khỏi danh sách chọn
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_orders_for_account('20000000-0000-0000-0000-0000000000a1')$$,
    ARRAY[1],
    'đơn đã gắn không còn hiện trong danh sách chọn'
);

-- 7. nhân viên khác không gắn đơn vào cơ hội của người ta
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
SELECT throws_ok(
    $$SELECT public.crm_link_order('30000000-0000-0000-0000-0000000000a1',
                                   'a3000000-0000-0000-0000-000000000002')$$,
    'P0001',
    NULL,
    'nhân viên khác không gắn được đơn vào cơ hội của người ta'
);

-- 8. một đơn không gắn được cho hai cơ hội — nếu không hai người cùng ăn hoa hồng
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a2','20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=6),
       'Cơ hội thứ hai', 29500000, '00000000-0000-0000-0000-00000000005c';
SELECT throws_ok(
    $$SELECT public.crm_link_order('30000000-0000-0000-0000-0000000000a2',
                                   'a3000000-0000-0000-0000-000000000001')$$,
    'P0001',
    NULL,
    'một đơn không gắn được cho hai cơ hội'
);

-- 9. gắn xong, khách thanh toán thì hoa hồng 10% chạy đúng — mắt xích khép kín
RESET ROLE;
UPDATE public.orders
   SET status='approved', approved_by='00000000-0000-0000-0000-0000000000c1', approved_at=now()
 WHERE id='a3000000-0000-0000-0000-000000000001';
UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT staff_id, amount FROM public.crm_staff_commissions$$,
    $$VALUES ('00000000-0000-0000-0000-00000000005c'::uuid, 2950000::numeric(14,2))$$,
    'gắn đơn xong, khách trả tiền thì hoa hồng 10% vào đúng người'
);

SELECT * FROM finish();
ROLLBACK;
