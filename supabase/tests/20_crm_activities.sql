BEGIN;
SELECT plan(9);

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

-- fixture của d2 cho các test 7-9 (tạo trong lúc còn đóng vai d2)
INSERT INTO public.crm_accounts (id, name, owner_id)
VALUES ('20000000-0000-0000-0000-000000000002', 'Khách của d2', '00000000-0000-0000-0000-0000000000d2');
INSERT INTO public.crm_contacts (id, account_id, full_name, owner_id)
VALUES ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
        'Liên hệ của d2', '00000000-0000-0000-0000-0000000000d2');

-- 7. d1 không gắn được liên hệ của d2 vào hoạt động của mình (chốt chặn contact_id)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT throws_ok(
    $$INSERT INTO public.crm_activities (kind, subject, account_id, contact_id, owner_id)
      VALUES ('call', 'Mượn liên hệ của người khác',
              '20000000-0000-0000-0000-000000000001',
              '21000000-0000-0000-0000-000000000002',
              '00000000-0000-0000-0000-0000000000d1')$$,
    '42501'
);

-- 8. d1 không chuyển được hoạt động của mình sang khách của d2 (UPDATE re-point)
SELECT throws_ok(
    $$UPDATE public.crm_activities
      SET account_id = '20000000-0000-0000-0000-000000000002'
      WHERE subject = 'Gọi tư vấn lần 1'$$,
    '42501'
);

-- 9. view crm_activity_inbox tôn trọng RLS: d2 không thấy hoạt động của d1
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_activity_inbox$$,
    ARRAY[0],
    'unrelated dealer sees no row in crm_activity_inbox (security_invoker)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
