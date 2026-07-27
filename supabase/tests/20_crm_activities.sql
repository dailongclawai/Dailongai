BEGIN;
SELECT plan(6);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d2';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '00000000-0000-0000-0000-0000000000d1');

-- fixture cho test 6: cơ hội của d1 trên pipeline b2c_device, giai đoạn đầu
INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'b2c_device',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=1),
       'Cô Lan - 1 máy',
       29500000,
       '00000000-0000-0000-0000-0000000000d1';

-- 1. hoạt động không gắn khách/cơ hội bị chặn (CHECK violation = SQLSTATE 23514)
-- Dạng 2 tham số throws_ok(query, errcode); không truyền NULL để tránh nhập nhằng overload.
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, owner_id)
      VALUES ('call', 'Gọi lung tung', '00000000-0000-0000-0000-0000000000d1')$$,
    '23514'
);

-- 2. hoạt động gắn khách hàng thì tạo được
INSERT INTO public.crm_activities (kind, subject, due_at, account_id, owner_id)
VALUES ('call', 'Gọi tư vấn lần 1', now() + interval '1 day',
        '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1');
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_activities$$,
    ARRAY[1],
    'owner sees own activity'
);

-- 3. kind lạ bị chặn (CHECK violation = SQLSTATE 23514)
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, account_id, owner_id)
      VALUES ('email', 'Sai kind', '20000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-0000000000d1')$$,
    '23514'
);

-- 4. dealer khác không thấy
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_activities$$,
    ARRAY[0],
    'unrelated dealer sees no activity'
);

-- 5. d2 không tạo được hoạt động gắn vào khách của d1 dù tự nhận owner_id là mình
-- (account id lấy thẳng từ fixture vì d2 không SELECT được account của d1)
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, account_id, owner_id)
      VALUES ('call', 'Chen ngang qua account', '20000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-0000000000d2')$$,
    '42501'
);

-- 6. d2 không tạo được hoạt động gắn vào cơ hội của d1 dù tự nhận owner_id là mình
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, opportunity_id, owner_id)
      VALUES ('call', 'Chen ngang qua opportunity', '30000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-0000000000d2')$$,
    '42501'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
