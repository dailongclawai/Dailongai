BEGIN;
SELECT plan(8);

-- Cột "Trạng thái" trên bảng khách hàng suy tự động: ưu tiên trạng thái đơn hàng
-- gắn với cơ hội mới nhất, không có đơn thì lấy tên giai đoạn, chưa có cơ hội nào
-- thì báo rõ là chưa có.

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','dealer@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff',  status='active', staff_segment='b2c', full_name='Nhân viên 1' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

INSERT INTO public.product_models (id, code, name, base_price)
VALUES ('a2000000-0000-0000-0000-000000000001', 'JG-668', 'Máy laser ZhiDun', 29500000);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Chị Hoa', '0912345678',
        '00000000-0000-0000-0000-00000000005c');

-- 1. khách vừa nhập, chưa có cơ hội nào
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Chưa có cơ hội'::text],
    'khách chưa có cơ hội thì báo rõ chưa có'
);

INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a1',
       '20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=1),
       'Chị Hoa - 1 máy', 29500000, '00000000-0000-0000-0000-00000000005c';

-- 2. có cơ hội thì lấy tên giai đoạn
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Mới tiếp nhận'::text],
    'lấy tên giai đoạn của cơ hội mới nhất'
);

-- 3. kéo cơ hội đi tiếp thì trạng thái chạy theo
UPDATE public.crm_opportunities
   SET stage_id=(SELECT id FROM public.crm_stages WHERE sort_order=4)
 WHERE id='30000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Đã trải nghiệm máy'::text],
    'đổi giai đoạn thì trạng thái đổi theo, không phải cập nhật tay'
);

-- gắn đơn hàng
RESET ROLE;
INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status)
VALUES ('a3000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000d1',
        'a2000000-0000-0000-0000-000000000001',
        'SN-ST-001', 'Chị Hoa', '0912345678', 29500000, 1, '2026-07-29', 'pending');
UPDATE public.crm_opportunities
   SET order_id='a3000000-0000-0000-0000-000000000001'
 WHERE id='30000000-0000-0000-0000-0000000000a1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

-- 4. có đơn thì trạng thái đơn được ưu tiên hơn giai đoạn
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Chờ duyệt đơn'::text],
    'có đơn rồi thì trạng thái đơn được ưu tiên'
);

RESET ROLE;
UPDATE public.orders
   SET status='approved', approved_by='00000000-0000-0000-0000-0000000000c1', approved_at=now()
 WHERE id='a3000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

-- 5. đơn được duyệt
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Đã duyệt đơn'::text],
    'đơn duyệt xong thì trạng thái là Đã duyệt đơn'
);

RESET ROLE;
UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

-- 6. khách thanh toán: chặng cuối của chuỗi
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Hoàn thành đơn'::text],
    'khách thanh toán xong thì trạng thái là Hoàn thành đơn'
);

-- 7. nhân viên kinh doanh KHÔNG đọc được bảng orders, nhưng vẫn thấy đúng trạng thái
SELECT is_empty(
    $$SELECT 1 FROM public.orders WHERE id='a3000000-0000-0000-0000-000000000001'$$,
    'nhân viên không đọc được bảng đơn hàng (RLS vẫn kín)'
);

-- 8. admin cũng thấy đúng trạng thái đó
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Hoàn thành đơn'::text],
    'admin thấy cùng một trạng thái'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
