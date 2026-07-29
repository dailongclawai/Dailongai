BEGIN;
SELECT plan(10);

-- Mô hình Boss chốt 29/07/2026: hoa hồng 10% giá trị đơn hàng, chỉ phát sinh khi
-- đơn chuyển sang đã thanh toán. Không còn giá cơ sở, không chia B2C/B2B, không
-- còn thưởng bắn khách chéo.

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','dealer@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff',  status='active', staff_segment='b2c', full_name='Nhân viên 1' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='dealer', status='active', full_name='Đại lý' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active', full_name='Boss'   WHERE id='00000000-0000-0000-0000-0000000000c1';

INSERT INTO public.product_models (id, code, name, base_price)
VALUES ('a2000000-0000-0000-0000-000000000001', 'JG-668', 'Máy laser ZhiDun', 29500000);

INSERT INTO public.crm_accounts (id, name, owner_id, created_by)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Chị Hoa',
        '00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-00000000005c');

INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a1',
       '20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=6),   -- Chốt đơn
       'Chị Hoa - 1 máy', 29500000, '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status)
VALUES ('a3000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000d1',
        'a2000000-0000-0000-0000-000000000001',
        'SN-E2E-001', 'Chị Hoa', '0912345678', 29500000, 1, '2026-07-29', 'pending');

UPDATE public.crm_opportunities
   SET order_id = 'a3000000-0000-0000-0000-000000000001'
 WHERE id = '30000000-0000-0000-0000-0000000000a1';

-- 1. đơn mới tạo, chưa thanh toán thì chưa có đồng hoa hồng nào
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[0],
    'đơn chưa thanh toán thì chưa phát sinh hoa hồng'
);

-- 2. duyệt đơn thôi vẫn chưa tính — phải tới lúc khách trả tiền
UPDATE public.orders
   SET status='approved', approved_by='00000000-0000-0000-0000-0000000000c1', approved_at=now()
 WHERE id='a3000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[0],
    'đơn mới duyệt, chưa thanh toán: vẫn chưa có hoa hồng'
);

UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000001';

-- 3. đúng 10% giá trị đơn, chốt cứng giá trị đơn và tỉ lệ vào dòng
SELECT results_eq(
    $$SELECT order_value, rate, amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (29500000::numeric(14,2), 0.1000::numeric(5,4), 2950000::numeric(14,2))$$,
    'hoa hồng = 10% × 29.500.000 = 2.950.000'
);

-- 4. khách trả tiền rồi nên vào thẳng payable, không còn bước admin duyệt
SELECT results_eq(
    $$SELECT status FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['payable'::text],
    'khách trả tiền rồi thì dòng hoa hồng ở trạng thái payable ngay'
);

-- 5. ghi đúng người: chủ cơ hội
SELECT results_eq(
    $$SELECT staff_id FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['00000000-0000-0000-0000-00000000005c'::uuid],
    'hoa hồng ghi cho chủ cơ hội'
);

-- 6. cơ hội tự nhảy sang giai đoạn hoàn thành, khỏi lệch với đơn
SELECT results_eq(
    $$SELECT s.name FROM public.crm_opportunities o
      JOIN public.crm_stages s ON s.id=o.stage_id
      WHERE o.id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['Hoàn thành đơn'::text],
    'đơn thanh toán xong thì cơ hội tự sang Hoàn thành đơn'
);

-- 7. sửa đơn thêm lần nữa không nhân đôi hoa hồng
UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000001';
UPDATE public.orders SET notes='ghi chú thêm' WHERE id='a3000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[1],
    'sửa đơn nhiều lần vẫn chỉ một dòng hoa hồng'
);

-- 8. đơn không gắn cơ hội nào thì không sinh hoa hồng CRM
INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status, approved_by, approved_at)
VALUES ('a3000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-0000000000d1',
        'a2000000-0000-0000-0000-000000000001',
        'SN-E2E-002', 'Khách lẻ', '0987654321', 29500000, 1, '2026-07-29',
        'approved', '00000000-0000-0000-0000-0000000000c1', now());
UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000002';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[1],
    'đơn không gắn cơ hội: không phát sinh hoa hồng CRM'
);

-- 9. cơ hội do admin tự chốt thì không phát sinh hoa hồng
INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status, approved_by, approved_at)
VALUES ('a3000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-0000000000d1',
        'a2000000-0000-0000-0000-000000000001',
        'SN-E2E-003', 'Khách admin', '0911111111', 29500000, 1, '2026-07-29',
        'approved', '00000000-0000-0000-0000-0000000000c1', now());
INSERT INTO public.crm_accounts (id, name, owner_id, created_by)
VALUES ('20000000-0000-0000-0000-0000000000c2', 'Khách của admin',
        '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id, order_id)
SELECT '30000000-0000-0000-0000-0000000000c2',
       '20000000-0000-0000-0000-0000000000c2',
       (SELECT id FROM public.crm_stages WHERE sort_order=6),
       'Admin tự chốt', 29500000, '00000000-0000-0000-0000-0000000000c1',
       'a3000000-0000-0000-0000-000000000003';
UPDATE public.orders SET status='paid' WHERE id='a3000000-0000-0000-0000-000000000003';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[1],
    'admin tự chốt hộ thì không phát sinh hoa hồng nhân viên'
);

-- 10. admin chi tiền: payable -> paid
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT public.admin_pay_staff_commission(
    (SELECT id FROM public.crm_staff_commissions LIMIT 1), 'CK-20260729-01');
SELECT results_eq(
    $$SELECT status, payment_ref FROM public.crm_staff_commissions LIMIT 1$$,
    $$VALUES ('paid'::text, 'CK-20260729-01'::text)$$,
    'admin chi xong thì dòng chuyển sang paid kèm mã chuyển khoản'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
