BEGIN;
SELECT plan(6);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-000000000001', 'Cô Lan', '0901000001', '00000000-0000-0000-0000-0000000000d1');

INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
SELECT '30000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'b2c_device',
       (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=1),
       'Cô Lan - 1 máy',
       29500000,
       '00000000-0000-0000-0000-0000000000d1';

-- 1. auto code CH-xxxxxx
SELECT matches(
    (SELECT code FROM public.crm_opportunities WHERE id='30000000-0000-0000-0000-000000000001'),
    '^CH-\d{6}$',
    'opportunity code auto-generated as CH-######'
);

-- 2. ngày kỳ vọng ngầm định = hôm nay + 15 ngày
SELECT results_eq(
    $$SELECT expected_close_date = current_date + 15
      FROM public.crm_opportunities WHERE id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[true],
    'expected_close_date defaults to today + 15 days'
);

-- 3. cơ hội đang mở thì closed_at NULL
SELECT results_eq(
    $$SELECT closed_at IS NULL FROM public.crm_opportunities
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[true],
    'open stage leaves closed_at NULL'
);

-- 4. không được gán giai đoạn của pipeline khác
-- Dùng dạng 2 tham số throws_ok(query, errcode). RAISE EXCEPTION mặc định là P0001.
-- KHÔNG truyền NULL vào throws_ok: Postgres sẽ báo "function is not unique" vì nhập nhằng overload.
SELECT throws_ok(
    $$UPDATE public.crm_opportunities
      SET stage_id = (SELECT id FROM public.crm_stages WHERE pipeline='b2b_dealer' AND sort_order=1)
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    'P0001'
);

-- 5. chuyển sang giai đoạn won thì tự đóng
UPDATE public.crm_opportunities
SET stage_id = (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='won')
WHERE id='30000000-0000-0000-0000-000000000001';
SELECT results_eq(
    $$SELECT closed_at IS NOT NULL FROM public.crm_opportunities
      WHERE id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[true],
    'moving to a won stage sets closed_at'
);

-- 6. đổi giai đoạn ghi audit_log
RESET ROLE;
SELECT results_eq(
    $$SELECT count(*)::int FROM public.audit_log
      WHERE action='crm_stage_change' AND target_id='30000000-0000-0000-0000-000000000001'$$,
    ARRAY[1],
    'stage change writes one crm_stage_change audit row'
);

SELECT * FROM finish();
ROLLBACK;
