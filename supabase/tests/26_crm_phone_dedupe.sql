BEGIN;
SELECT plan(10);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005b','authenticated','authenticated','staff.b2b@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','dealer@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c', full_name='Nhân viên B2C' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2b', full_name='Nhân viên B2B' WHERE id='00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role='dealer', status='active', full_name='Đại lý' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='admin',  status='active', full_name='Boss' WHERE id='00000000-0000-0000-0000-0000000000c1';

-- 1. chuẩn hoá: mọi cách viết của cùng một số phải ra một chuỗi
SELECT results_eq(
    $$SELECT DISTINCT public.crm_normalize_phone(p)
      FROM (VALUES ('0912345678'),('0912 345 678'),('+84912345678'),
                   ('84912345678'),('091-234-5678')) v(p)$$,
    ARRAY['0912345678'::text],
    'mọi cách viết +84/0/dấu cách quy về cùng một số'
);

-- 2. chuỗi không có chữ số nào thì trả NULL (không coi là trùng)
SELECT is(
    public.crm_normalize_phone('abc'), NULL::text,
    'chuỗi không chứa chữ số trả NULL'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Chị Hoa', '0912345678',
        '00000000-0000-0000-0000-00000000005c');

-- 3. cùng nhân viên, số khác thì vẫn tạo được
SELECT lives_ok(
    $$INSERT INTO public.crm_accounts (id, name, phone, owner_id)
      VALUES ('20000000-0000-0000-0000-0000000000a2','Anh Nam','0987654321',
              '00000000-0000-0000-0000-00000000005c')$$,
    'số khác thì tạo bình thường'
);

-- 4. cập nhật chính khách đó, giữ nguyên số — guard không được tự chặn chính nó
SELECT lives_ok(
    $$UPDATE public.crm_accounts SET phone='0912345678', name='Chị Hoa (sửa)'
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    'sửa chính khách đó mà giữ nguyên số thì không bị chặn'
);

-- 5. nhân viên KHÁC nhập lại cùng số, viết dạng +84 — phải bị chặn
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005b';
SELECT throws_ok(
    $$INSERT INTO public.crm_accounts (name, phone, owner_id)
      VALUES ('Cũng chị Hoa','+84912345678','00000000-0000-0000-0000-00000000005b')$$,
    NULL, NULL,
    'nhân viên khác nhập trùng số (dạng +84) bị chặn'
);

-- 6. RLS che khách của người khác, nhưng guard vẫn phải bắt được trùng
SELECT is_empty(
    $$SELECT 1 FROM public.crm_accounts WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    'nhân viên B2B không đọc được khách của B2C (RLS vẫn kín)'
);

-- 7. tra cứu xuyên RLS: biết khách đã có và ai đang phụ trách
SELECT results_eq(
    $$SELECT name, owner_name, is_mine FROM public.crm_lookup_phones(ARRAY['0912345678'])$$,
    $$VALUES ('Chị Hoa (sửa)'::text, 'Nhân viên B2C'::text, false)$$,
    'crm_lookup_phones trả tên khách + người phụ trách, is_mine=false'
);

-- 8. tra cứu nhiều số một lần (dùng cho nhập hàng loạt), số chưa có thì không trả dòng
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_lookup_phones(
        ARRAY['0912345678','0987654321','0900000000'])$$,
    ARRAY[2],
    'tra nhiều số một lần, chỉ trả những số đã tồn tại'
);

-- 9. đại lý không được phép tra cứu
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT throws_ok(
    $$SELECT * FROM public.crm_lookup_phones(ARRAY['0912345678'])$$,
    NULL, NULL,
    'đại lý gọi crm_lookup_phones bị từ chối'
);

-- 10. admin thấy được cặp trùng còn sót từ trước (nạp thẳng, bỏ qua trigger)
SET LOCAL ROLE postgres;
ALTER TABLE public.crm_accounts DISABLE TRIGGER crm_accounts_phone_guard;
INSERT INTO public.crm_accounts (name, phone, owner_id)
VALUES ('Bản trùng cũ', '0912345678', '00000000-0000-0000-0000-00000000005b');
ALTER TABLE public.crm_accounts ENABLE TRIGGER crm_accounts_phone_guard;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT phone_norm, account_count::int FROM public.crm_account_phone_duplicates$$,
    $$VALUES ('0912345678'::text, 2)$$,
    'admin thấy cặp trùng cũ qua crm_account_phone_duplicates'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
