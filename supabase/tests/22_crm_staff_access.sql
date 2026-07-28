BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- 1. cấu hình mặc định đúng con số Boss chốt
SELECT results_eq(
    $$SELECT base_price, staff_rate_b2c, staff_rate_b2b, crossover_bonus_rate
      FROM public.crm_settings$$,
    $$VALUES (15000000::numeric(14,2), 0.2000::numeric(5,4), 0.1000::numeric(5,4), 0.0500::numeric(5,4))$$,
    'crm_settings mặc định: 15tr, 20%, 10%, 5%'
);

-- 2. admin gán được vai trò staff
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT lives_ok(
    $$SELECT public.admin_set_staff('00000000-0000-0000-0000-00000000005c', 'b2c')$$,
    'admin gán được staff b2c'
);
SELECT public.admin_set_staff('00000000-0000-0000-0000-00000000005b', 'b2b');

-- 3. dealer KHÔNG gán được staff
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT throws_ok(
    $$SELECT public.admin_set_staff('00000000-0000-0000-0000-0000000000d1', 'b2c')$$,
    'P0001'
);

-- 4. mảng phụ trách sai bị chặn
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT throws_ok(
    $$SELECT public.admin_set_staff('00000000-0000-0000-0000-00000000005c', 'b2x')$$,
    'P0001'
);

-- 5. staff tạo được khách hàng
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách của staff B2C',
        '00000000-0000-0000-0000-00000000005c');
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[1],
    'staff thấy khách của mình'
);

-- 6. ĐẠI LÝ không đọc được CRM nữa
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts$$,
    ARRAY[0],
    'dealer không đọc được crm_accounts'
);

-- 7. ĐẠI LÝ không ghi được CRM nữa
SELECT throws_ok(
    $$INSERT INTO public.crm_accounts (name, owner_id)
      VALUES ('Đại lý chen ngang', '00000000-0000-0000-0000-0000000000d1')$$,
    '42501'
);

-- 8. staff không phải admin thì báo cáo tổng hợp trả rỗng
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_report$$,
    ARRAY[0],
    'staff không xem được báo cáo tổng hợp'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
