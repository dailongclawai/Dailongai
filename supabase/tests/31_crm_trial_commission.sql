BEGIN;
SELECT plan(11);

-- Boss chốt 29/07/2026: khách dùng thử 30 ngày thì phải hết 30 ngày mà khách
-- KHÔNG trả lại máy, nhân viên mới được nhận hoa hồng. Bán đứt thì chi ngay.

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
VALUES ('a2000000-0000-0000-0000-000000000001','ZHIDUN-CEO','Máy laser ZhiDun', 29500000);

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1','Chị Hoa','0912345678','00000000-0000-0000-0000-00000000005c'),
       ('20000000-0000-0000-0000-0000000000a2','Anh Nam','0987654321','00000000-0000-0000-0000-00000000005c');

-- Cơ hội 1: khách dùng thử 30 ngày. Cơ hội 2: bán đứt.
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, model_id, quantity, amount, owner_id, trial_days)
SELECT '30000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM public.crm_stages WHERE sort_order=6),
       'Chị Hoa - dùng thử','a2000000-0000-0000-0000-000000000001',2, 59000000,
       '00000000-0000-0000-0000-00000000005c', 30;
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, model_id, quantity, amount, owner_id)
SELECT '30000000-0000-0000-0000-0000000000a2','20000000-0000-0000-0000-0000000000a2',
       (SELECT id FROM public.crm_stages WHERE sort_order=6),
       'Anh Nam - bán đứt','a2000000-0000-0000-0000-000000000001',1, 29500000,
       '00000000-0000-0000-0000-00000000005c';

-- 1. Bảng kanban hiện số máy và hoa hồng dự kiến ngay từ khi mới theo khách
SELECT results_eq(
    $$SELECT quantity, expected_commission FROM public.crm_opportunity_board
      WHERE id='30000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES (2::smallint, 5900000::numeric)$$,
    'kanban hiện 2 máy và hoa hồng dự kiến 5.900.000 (10% của 59 triệu)'
);

-- 2. Số ngày dùng thử hiện ra để nhân viên biết đang treo bao lâu
SELECT results_eq(
    $$SELECT trial_days FROM public.crm_opportunity_board
      WHERE id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[30::smallint],
    'kanban hiện số ngày dùng thử'
);

INSERT INTO public.orders
    (id, dealer_id, model_id, serial_number, customer_name, customer_phone,
     sale_price, quantity, sale_date, status, approved_by, approved_at)
VALUES
 ('a3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1',
  'a2000000-0000-0000-0000-000000000001','SN-T-001','Chị Hoa','0912345678',
  59000000,2,'2026-07-29','approved','00000000-0000-0000-0000-0000000000c1',now()),
 ('a3000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000d1',
  'a2000000-0000-0000-0000-000000000001','SN-T-002','Anh Nam','0987654321',
  29500000,1,'2026-07-29','approved','00000000-0000-0000-0000-0000000000c1',now());
UPDATE public.crm_opportunities SET order_id='a3000000-0000-0000-0000-000000000001'
 WHERE id='30000000-0000-0000-0000-0000000000a1';
UPDATE public.crm_opportunities SET order_id='a3000000-0000-0000-0000-000000000002'
 WHERE id='30000000-0000-0000-0000-0000000000a2';

UPDATE public.orders SET status='paid' WHERE id IN
 ('a3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000002');

-- 3. Bán đứt: chi được ngay
SELECT results_eq(
    $$SELECT status FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a2'$$,
    ARRAY['payable'::text],
    'bán đứt thì hoa hồng payable ngay khi khách thanh toán'
);

-- 4. Dùng thử: bị treo lại
SELECT results_eq(
    $$SELECT status FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['pending'::text],
    'khách đang dùng thử thì hoa hồng bị treo ở pending'
);

-- 5. Mốc đủ điều kiện đúng 30 ngày kể từ lúc thanh toán
SELECT ok(
    (SELECT eligible_at::date FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1')
    = (now() + interval '30 days')::date,
    'mốc đủ điều kiện đúng 30 ngày sau khi thanh toán'
);

-- 6. Số tiền vẫn ghi đủ ngay, chỉ là chưa được chi
SELECT results_eq(
    $$SELECT amount FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[5900000::numeric(14,2)],
    'tiền ghi nhận đủ 5.900.000 ngay, chỉ chưa tới lúc chi'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';

-- 7. Chưa hết hạn thì admin cũng KHÔNG chi được
SELECT throws_ok(
    $$SELECT public.admin_pay_staff_commission(
        (SELECT id FROM public.crm_staff_commissions
          WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'), 'CK-SOM')$$,
    'P0001',
    NULL,
    'còn trong thời gian dùng thử thì admin cũng không chi được'
);

-- 8. Chưa tới hạn thì lệnh giải phóng không đụng gì
SELECT results_eq(
    $$SELECT public.crm_release_due_commissions()$$,
    ARRAY[0],
    'chưa tới hạn thì không dòng nào được giải phóng'
);

-- 9. Hết 30 ngày mà khách không trả máy → giải phóng được
RESET ROLE;
UPDATE public.crm_staff_commissions
   SET eligible_at = now() - interval '1 minute'
 WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT public.crm_release_due_commissions()$$,
    ARRAY[1],
    'hết hạn dùng thử thì hoa hồng được giải phóng sang payable'
);

-- 10. Giải phóng xong thì chi được
SELECT lives_ok(
    $$SELECT public.admin_pay_staff_commission(
        (SELECT id FROM public.crm_staff_commissions
          WHERE opportunity_id='30000000-0000-0000-0000-0000000000a1'), 'CK-DUNGTHU-01')$$,
    'hết hạn dùng thử, khách giữ máy thì nhân viên nhận được hoa hồng'
);

-- 11. Khách trả lại máy (đơn bị huỷ) → hoa hồng mất theo
RESET ROLE;
UPDATE public.orders SET status='voided', voided_at=now()
 WHERE id='a3000000-0000-0000-0000-000000000002';
SELECT results_eq(
    $$SELECT status FROM public.crm_staff_commissions
      WHERE opportunity_id='30000000-0000-0000-0000-0000000000a2'$$,
    ARRAY['void'::text],
    'khách trả lại máy thì hoa hồng bị huỷ theo đơn'
);

SELECT * FROM finish();
ROLLBACK;
