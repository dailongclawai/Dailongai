BEGIN;
SELECT plan(8);

-- Boss chốt 29/07/2026: trạng thái khách hàng do NHÂN VIÊN TỰ CHỌN, lấy từ cùng
-- danh mục giai đoạn với cơ hội. Khách mới mặc định ở đầu chuỗi. Riêng lúc khách
-- thanh toán xong thì hệ thống đẩy sang giai đoạn hoàn thành — mốc có thật từ
-- bảng đơn hàng.
-- Boss sửa luật 01/08/2026: tới "Hoàn thành đơn" hoặc "Không mua" là chốt sổ,
-- khoá trạng thái, nhân viên KHÔNG đổi lại được nữa (xem test 33).

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

-- 1. khách mới nhập tự vào giai đoạn đầu, không cần tạo cơ hội trước
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Mới tiếp nhận'::text],
    'khách mới nhập mặc định ở giai đoạn đầu chuỗi'
);

-- 2. nhân viên tự chọn giai đoạn khác, không cần cơ hội nào
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Đã liên hệ')
 WHERE id='20000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Đã liên hệ'::text],
    'nhân viên tự chọn được giai đoạn khi chưa có cơ hội nào'
);

-- 3. chọn nhảy cóc tới giai đoạn xa cũng được, không bị ép đi tuần tự
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Đàm phán giá')
 WHERE id='20000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Đàm phán giá'::text],
    'chọn tự do, không ép đi tuần tự từng bước'
);

-- 4. tạo cơ hội ở giai đoạn KHÁC không được đè lên lựa chọn của nhân viên
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a1',
       '20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=1),
       'Chị Hoa - 1 máy', 29500000, '00000000-0000-0000-0000-00000000005c';
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Đàm phán giá'::text],
    'cơ hội ở giai đoạn khác không ghi đè lựa chọn của nhân viên'
);

-- 5. chỉ chọn được giai đoạn có trong danh mục
SELECT throws_ok(
    $$UPDATE public.crm_accounts
      SET stage_id='00000000-0000-0000-0000-0000000000ff'
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    '23503',
    NULL,
    'không gán được giai đoạn không tồn tại'
);

-- gắn đơn rồi cho khách thanh toán
RESET ROLE;
INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status, approved_by, approved_at)
VALUES ('a3000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000d1',
        'a2000000-0000-0000-0000-000000000001',
        'SN-ST-001', 'Chị Hoa', '0912345678', 29500000, 1, '2026-07-29',
        'approved', '00000000-0000-0000-0000-0000000000c1', now());
UPDATE public.crm_opportunities
   SET order_id='a3000000-0000-0000-0000-000000000001'
 WHERE id='30000000-0000-0000-0000-0000000000a1';
UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

-- 6. khách trả tiền: hệ thống đẩy sang chặng cuối, khỏi phải nhớ sửa tay
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Hoàn thành đơn'::text],
    'khách thanh toán xong thì trạng thái tự sang Hoàn thành đơn'
);

-- 7. Boss đổi luật 01/08/2026: tới "Hoàn thành đơn" hoặc "Không mua" là chốt sổ,
--    khoá luôn. Trước đó (29/07) nhân viên còn đổi lại được — nay thì không.
SELECT throws_ok(
    $$UPDATE public.crm_accounts
         SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Đang tư vấn')
       WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    '23514',
    NULL,
    'đã Hoàn thành đơn thì nhân viên không đổi lại được nữa'
);

-- 8. nhân viên khác không sửa được trạng thái khách không phải của mình
RESET ROLE;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff2@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b' WHERE id='00000000-0000-0000-0000-00000000005b';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Không mua')
 WHERE id='20000000-0000-0000-0000-0000000000a1';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
SELECT results_eq(
    $$SELECT status_label FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Hoàn thành đơn'::text],
    'nhân viên khác không sửa được trạng thái khách của người ta (RLS chặn)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
