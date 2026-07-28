BEGIN;
SELECT plan(12);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','s1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='supervisor', status='active' WHERE id='00000000-0000-0000-0000-0000000000a1';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-0000000000d2';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- d1 tạo 1 khách hàng
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (id, name, phone, source, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '0901000001', 'zalo', '00000000-0000-0000-0000-0000000000d1');

-- 1. auto code KH-xxxxxx
SELECT matches(
    (SELECT code FROM public.crm_accounts WHERE name='Cô Lan'),
    '^KH-\d{6}$',
    'account code auto-generated as KH-######'
);

-- 2. chủ sở hữu thấy bản ghi của mình
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'dealer d1 sees own account'
);

-- 3. d1 thêm liên hệ cho khách đó
INSERT INTO public.crm_contacts (account_id, full_name, phone, is_primary, owner_id)
SELECT id, 'Cô Lan', '0901000001', true, '00000000-0000-0000-0000-0000000000d1'
FROM public.crm_accounts WHERE name='Cô Lan';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_contacts$$,
    ARRAY[1],
    'dealer d1 sees own contact'
);

-- 4. dealer khác nhánh không thấy gì
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[0],
    'unrelated dealer d2 sees no account (RLS isolation)'
);

-- 5. d2 không sửa được bản ghi của d1
SELECT results_eq(
    $$WITH u AS (UPDATE public.crm_accounts SET name='Hack' RETURNING 1)
      SELECT count(*)::int FROM u$$,
    ARRAY[0],
    'dealer d2 cannot update d1 account'
);

-- 6. Boss chốt 28/07/2026: CRM chỉ mở cho staff + admin ⇒ supervisor KHÔNG thấy gì.
-- (Trước đây assertion này kỳ vọng supervisor thấy khách của nhánh; luật đã đổi.)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[0],
    'supervisor is locked out of CRM accounts (staff-only rule)'
);

-- 7. supervisor cũng không thấy liên hệ
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_contacts$$,
    ARRAY[0],
    'supervisor is locked out of CRM contacts (staff-only rule)'
);

-- 8. admin thấy tất cả
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'admin sees all accounts'
);

-- 9. dealer khác nhánh không thấy liên hệ nào (contacts isolation, giống #4)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_contacts$$,
    ARRAY[0],
    'unrelated dealer d2 sees no contact (RLS isolation)'
);

-- 10. supervisor đọc được khách của nhánh nhưng không được sửa
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$WITH u AS (UPDATE public.crm_accounts SET name='SV sửa' RETURNING 1)
      SELECT count(*)::int FROM u$$,
    ARRAY[0],
    'supervisor cannot update branch account (read-only)'
);

-- 11. d2 không chèn được liên hệ vào khách của d1 dù tự nhận owner_id là mình
-- (account id lấy thẳng từ fixture vì d2 không SELECT được account của d1)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT throws_ok(
    $$INSERT INTO public.crm_contacts (account_id, full_name, owner_id)
      VALUES ('20000000-0000-0000-0000-000000000001', 'Chen ngang', '00000000-0000-0000-0000-0000000000d2')$$,
    '42501'
);

-- 12. d2 không tạo được crm_accounts với owner_id giả mạo thành d1
SELECT throws_ok(
    $$INSERT INTO public.crm_accounts (name, owner_id)
      VALUES ('Giả mạo', '00000000-0000-0000-0000-0000000000d1')$$,
    '42501'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
