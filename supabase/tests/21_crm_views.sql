BEGIN;
SELECT plan(3);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c' WHERE id='00000000-0000-0000-0000-0000000000d2';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.crm_opportunities (id, account_id, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       (SELECT id FROM public.crm_stages WHERE sort_order=2),
       'Cô Lan - 1 máy', 29500000, '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_activities (kind, subject, account_id, owner_id)
VALUES ('task', 'Gửi tài liệu', '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000d1');

-- 1. board view trả tên khách + tên giai đoạn + tỷ lệ
SELECT results_eq(
    $$SELECT account_name, stage_name, probability
      FROM public.crm_opportunity_board
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    $$VALUES ('Cô Lan', 'Đã liên hệ', 25::smallint)$$,
    'crm_opportunity_board joins account name, stage name and probability'
);

-- 2. activity inbox trả tên khách
SELECT results_eq(
    $$SELECT account_name FROM public.crm_activity_inbox WHERE subject='Gửi tài liệu'$$,
    ARRAY['Cô Lan'],
    'crm_activity_inbox joins account name'
);

-- 3. view tôn trọng RLS của bảng gốc (security_invoker)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_opportunity_board$$,
    ARRAY[0],
    'board view is empty for unrelated dealer (security_invoker respected)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
