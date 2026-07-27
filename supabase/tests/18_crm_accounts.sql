BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','s1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='supervisor', status='active' WHERE id='00000000-0000-0000-0000-0000000000a1';
UPDATE public.profiles SET role='dealer', status='active', supervisor_id='00000000-0000-0000-0000-0000000000a1' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d2';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- d1 tạo 1 khách hàng
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (name, phone, source, owner_id)
VALUES ('Cô Lan', '0901000001', 'zalo', '00000000-0000-0000-0000-0000000000d1');

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

-- 6. supervisor thấy khách của dealer trong nhánh
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'supervisor sees account owned by dealer in own branch'
);

-- 7. supervisor cũng thấy liên hệ của nhánh
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_contacts$$,
    ARRAY[1],
    'supervisor sees contact owned by dealer in own branch'
);

-- 8. admin thấy tất cả
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'admin sees all accounts'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
