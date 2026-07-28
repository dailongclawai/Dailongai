BEGIN;
SELECT plan(9);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000005c','authenticated','authenticated','staff.b2c@dailongai.com');
UPDATE public.profiles SET role='staff', status='active', staff_segment='b2c', full_name='Nhân viên B2C' WHERE id='00000000-0000-0000-0000-00000000005c';

-- 1. danh mục lý do được nạp sẵn
SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_lost_reasons WHERE active$$,
    ARRAY[7],
    'danh mục lý do mất có 7 mục hoạt động'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-00000000005c';

INSERT INTO public.crm_accounts (id, name, phone, owner_id)
VALUES ('20000000-0000-0000-0000-0000000000a1', 'Chị Hoa', '0912345678',
        '00000000-0000-0000-0000-00000000005c');

INSERT INTO public.crm_opportunities (id, account_id, pipeline, stage_id, name, amount, owner_id)
VALUES ('30000000-0000-0000-0000-0000000000b1',
        '20000000-0000-0000-0000-0000000000a1', 'b2c_device',
        (SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=1),
        'Máy laser cho chị Hoa', 15000000, '00000000-0000-0000-0000-00000000005c');

-- 2. chuyển sang giai đoạn thua mà không chọn lý do — phải bị chặn
SELECT throws_ok(
    $$UPDATE public.crm_opportunities
      SET stage_id=(SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='lost')
      WHERE id='30000000-0000-0000-0000-0000000000b1'$$,
    NULL, NULL,
    'chuyển sang giai đoạn thua mà thiếu lý do thì bị chặn'
);

-- 3. lý do riêng của pipeline B2B không dùng được cho cơ hội B2C
SELECT throws_ok(
    $$UPDATE public.crm_opportunities
      SET stage_id=(SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='lost'),
          lost_reason_id=(SELECT id FROM public.crm_lost_reasons WHERE pipeline='b2b_dealer')
      WHERE id='30000000-0000-0000-0000-0000000000b1'$$,
    NULL, NULL,
    'lý do dành riêng cho B2B không dùng được cho cơ hội B2C'
);

-- 4. có lý do hợp lệ thì chuyển được
SELECT lives_ok(
    $$UPDATE public.crm_opportunities
      SET stage_id=(SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='lost'),
          lost_reason_id=(SELECT id FROM public.crm_lost_reasons WHERE name='Giá cao'),
          lost_notes='Khách so với hàng Trung Quốc rẻ hơn 30%'
      WHERE id='30000000-0000-0000-0000-0000000000b1'$$,
    'chọn lý do hợp lệ thì chuyển sang thua được'
);

-- 5. đóng cơ hội thì đóng dấu thời điểm
SELECT isnt(
    (SELECT closed_at FROM public.crm_opportunities WHERE id='30000000-0000-0000-0000-0000000000b1'),
    NULL, 'cơ hội thua được đóng dấu closed_at'
);

-- 6. bảng kanban trả về tên lý do đã chuẩn hoá, không phải chữ tự do
SELECT results_eq(
    $$SELECT lost_reason_name, lost_notes FROM public.crm_opportunity_board
      WHERE id='30000000-0000-0000-0000-0000000000b1'$$,
    $$VALUES ('Giá cao'::text, 'Khách so với hàng Trung Quốc rẻ hơn 30%'::text)$$,
    'crm_opportunity_board trả tên lý do chuẩn hoá kèm ghi chú'
);

-- 7. kéo ngược về giai đoạn đang mở thì xoá sạch lý do và ghi chú thua
UPDATE public.crm_opportunities
SET stage_id=(SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND sort_order=2)
WHERE id='30000000-0000-0000-0000-0000000000b1';
SELECT results_eq(
    $$SELECT lost_reason_id, lost_notes, closed_at FROM public.crm_opportunities
      WHERE id='30000000-0000-0000-0000-0000000000b1'$$,
    $$VALUES (NULL::uuid, NULL::text, NULL::timestamptz)$$,
    'kéo ngược về giai đoạn mở thì xoá lý do, ghi chú và closed_at'
);

-- 8. dữ liệu thua từ TRƯỚC migration (chưa có lý do) vẫn phải sửa được.
-- Guard chỉ soát lúc đổi giai đoạn nên đặt lại lý do về NULL mà giữ nguyên
-- giai đoạn sẽ tạo đúng tình trạng của dữ liệu cũ.
UPDATE public.crm_opportunities
SET stage_id=(SELECT id FROM public.crm_stages WHERE pipeline='b2c_device' AND forecast='lost'),
    lost_reason_id=(SELECT id FROM public.crm_lost_reasons WHERE name='Mất liên lạc')
WHERE id='30000000-0000-0000-0000-0000000000b1';
UPDATE public.crm_opportunities SET lost_reason_id=NULL
WHERE id='30000000-0000-0000-0000-0000000000b1';

SELECT lives_ok(
    $$UPDATE public.crm_opportunities SET notes='bổ sung ghi chú sau'
      WHERE id='30000000-0000-0000-0000-0000000000b1'$$,
    'cơ hội thua cũ chưa có lý do vẫn sửa được các trường khác'
);

-- 9. nhân viên không được tự thêm lý do vào danh mục
SELECT throws_ok(
    $$INSERT INTO public.crm_lost_reasons (name, sort_order) VALUES ('Lý do tự chế', 99)$$,
    NULL, NULL,
    'nhân viên không được thêm lý do vào danh mục (chỉ admin)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
