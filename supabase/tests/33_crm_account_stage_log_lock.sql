BEGIN;
SELECT plan(9);

-- Boss chốt 01/08/2026: mỗi lần đổi trạng thái khách phải có nhật ký để biết
-- nằm ở một bước bao lâu mới sang bước kế. Và khi đã "Hoàn thành đơn" hoặc
-- "Không mua" thì khoá lại, không đổi được nữa.

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c', full_name='Nhân viên 1' WHERE id='00000000-0000-0000-0000-00000000005c';
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

INSERT INTO public.product_models (id, code, name, base_price)
VALUES ('a2000000-0000-0000-0000-000000000001', 'JG-668', 'Máy laser ZhiDun', 29500000);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Chị Hoa', '0912345678',
        '00000000-0000-0000-0000-00000000005c');

-- 1. chưa đổi lần nào thì mốc vào trạng thái là lúc đưa khách vào danh sách
SELECT results_eq(
    $$SELECT stage_since = created_at FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[true],
    'khách chưa đổi trạng thái thì stage_since bằng ngày đưa vào danh sách'
);

-- audit_log chỉ cho admin đọc, nên mọi khẳng định về nhật ký phải đọc bằng quyền
-- chủ sở hữu. Nhân viên xem nhật ký qua view timeline chứ không đọc bảng thẳng.
RESET ROLE;

-- 2. chưa đổi lần nào thì chưa có nhật ký
SELECT is(
    (SELECT count(*)::int FROM public.audit_log
      WHERE action='crm_stage_change' AND target_table='crm_accounts'
        AND target_id='20000000-0000-0000-0000-0000000000a1'),
    0,
    'chưa đổi trạng thái thì chưa ghi nhật ký'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

-- 3. đổi trạng thái thì ghi đúng một dòng nhật ký
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Đã liên hệ')
 WHERE id='20000000-0000-0000-0000-0000000000a1';

RESET ROLE;
SELECT is(
    (SELECT count(*)::int FROM public.audit_log
      WHERE action='crm_stage_change' AND target_table='crm_accounts'
        AND target_id='20000000-0000-0000-0000-0000000000a1'),
    1,
    'đổi trạng thái ghi đúng một dòng nhật ký'
);

-- 4. nhật ký lưu đủ giai đoạn trước và sau
SELECT results_eq(
    $$SELECT (SELECT name FROM public.crm_stages WHERE id=(before->>'stage_id')::uuid),
             (SELECT name FROM public.crm_stages WHERE id=(after ->>'stage_id')::uuid)
        FROM public.audit_log
       WHERE action='crm_stage_change' AND target_table='crm_accounts'
         AND target_id='20000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES ('Mới tiếp nhận'::text, 'Đã liên hệ'::text)$$,
    'nhật ký lưu đủ giai đoạn trước và sau'
);

-- 5. mốc vào trạng thái bám đúng dòng nhật ký gần nhất.
--    So bằng dấu bằng chứ không so lớn hơn: trong cùng một giao dịch thì now()
--    không nhích, nên "lớn hơn ngày tạo" sẽ sai oan dù mã chạy đúng.
--    Vẫn đang ở quyền chủ sở hữu để đọc được audit_log ở vế phải.
SELECT results_eq(
    $$SELECT stage_since = (SELECT max(created_at) FROM public.audit_log
                             WHERE action='crm_stage_change'
                               AND target_table='crm_accounts'
                               AND target_id='20000000-0000-0000-0000-0000000000a1')
        FROM public.crm_account_list
       WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[true],
    'stage_since bám đúng mốc ghi nhật ký gần nhất'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

-- 6. giai đoạn đang mở thì chưa khoá
SELECT results_eq(
    $$SELECT stage_locked FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[false],
    'giai đoạn đang mở thì chưa khoá'
);

-- 7. sang "Hoàn thành đơn" thì cờ khoá bật
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Hoàn thành đơn')
 WHERE id='20000000-0000-0000-0000-0000000000a1';

SELECT results_eq(
    $$SELECT stage_locked FROM public.crm_account_list
      WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    ARRAY[true],
    'sang Hoàn thành đơn thì cờ khoá bật'
);

-- 8. đã khoá thì đổi thẳng bị chặn
SELECT throws_ok(
    $$UPDATE public.crm_accounts
         SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Đang tư vấn')
       WHERE id='20000000-0000-0000-0000-0000000000a1'$$,
    '23514',
    NULL,
    'khách đã Hoàn thành đơn thì không đổi trạng thái được nữa'
);

-- 9. khách "Không mua" cũng bị khoá
INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a2', 'Anh Nam', '0912345679',
        '00000000-0000-0000-0000-00000000005c');
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Không mua')
 WHERE id='20000000-0000-0000-0000-0000000000a2';

SELECT throws_ok(
    $$UPDATE public.crm_accounts
         SET stage_id = (SELECT id FROM public.crm_stages WHERE name='Đã liên hệ')
       WHERE id='20000000-0000-0000-0000-0000000000a2'$$,
    '23514',
    NULL,
    'khách Không mua cũng bị khoá trạng thái'
);

SELECT * FROM finish();
ROLLBACK;
