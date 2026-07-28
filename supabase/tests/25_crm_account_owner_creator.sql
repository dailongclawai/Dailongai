BEGIN;
SELECT plan(7);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c', full_name='Nhân viên B2C' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b', full_name='Nhân viên B2B' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='admin',  status='active', full_name='Boss' WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_accounts (id, name, kind, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách của B2C', 'dealer_prospect',
        '00000000-0000-0000-0000-00000000005c');

-- 1. created_by tự điền = người đang đăng nhập
SELECT results_eq(
    $$SELECT created_by FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['00000000-0000-0000-0000-00000000005c'::uuid],
    'created_by tự điền theo người tạo'
);

-- 2. bảng danh sách trả về tên người quản lý và người tạo
SELECT results_eq(
    $$SELECT owner_name, creator_name FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES ('Nhân viên B2C'::text, 'Nhân viên B2C'::text)$$,
    'crm_account_list có tên người quản lý + người tạo'
);

-- 3. chưa bắn khách thì was_handed_over = false
SELECT results_eq(
    $$SELECT was_handed_over FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[false],
    'khách chưa từng được chuyển'
);

-- bắn khách sang B2B
SELECT public.staff_handover_account(
    '20000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-00000000005b', 'Chuyển sang B2B');

-- 4. sau khi bắn: người quản lý đổi, người tạo GIỮ NGUYÊN
SELECT results_eq(
    $$SELECT owner_name, creator_name FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES ('Nhân viên B2B'::text, 'Nhân viên B2C'::text)$$,
    'sau khi bắn khách: quản lý đổi sang B2B, người tạo vẫn là B2C'
);

-- 5. cờ đã từng chuyển bật lên
SELECT results_eq(
    $$SELECT was_handed_over FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[true],
    'cờ was_handed_over bật sau khi chuyển'
);

-- 6. admin thấy đủ tên cả hai bên
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT owner_name, creator_name FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES ('Nhân viên B2B'::text, 'Nhân viên B2C'::text)$$,
    'admin thấy tên người quản lý và người tạo'
);

-- 7. admin tạo khách thì created_by là admin, và tên admin cũng hiện
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000c2', 'Khách do admin tạo',
        '00000000-0000-0000-0000-0000000000c1');
SELECT results_eq(
    $$SELECT creator_name FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000c2'$$,
    ARRAY['Boss'::text],
    'khách do admin tạo hiện đúng tên admin'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
