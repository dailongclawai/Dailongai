BEGIN;
SELECT plan(5);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005d','authenticated','authenticated','staff.b2c2@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-00000000005d';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';
INSERT INTO public.crm_accounts (id, name, kind, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Khách hoá ra là đại lý',
        'dealer_prospect', '00000000-0000-0000-0000-00000000005c');

-- 1. không bắn được sang staff CÙNG mảng
SELECT throws_ok(
    $$SELECT public.staff_handover_account(
        '20000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000005d', NULL)$$,
    'P0001'
);

-- 2. bắn sang staff mảng đối diện thì được
SELECT lives_ok(
    $$SELECT public.staff_handover_account(
        '20000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000005b', 'Khách này mở phòng khám, chuyển B2B')$$,
    'staff B2C bắn khách sang staff B2B'
);

-- 3. chủ sở hữu khách đã đổi
SELECT results_eq(
    $$SELECT owner_id FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY['00000000-0000-0000-0000-00000000005b'::uuid],
    'khách chuyển sang chủ mới'
);

-- 4. người bắn vẫn theo dõi được khách đó
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_accounts
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[1],
    'người bắn khách vẫn đọc được khách đã chuyển'
);

-- 5. Boss chốt 29/07/2026: bỏ hẳn thưởng bắn khách chéo. Chuyển khách vẫn chạy,
-- nhưng không sinh thêm đồng hoa hồng nào cho cả người giao lẫn người nhận.
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_staff_commissions$$,
    ARRAY[0],
    'bắn khách không còn kèm tiền thưởng'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
