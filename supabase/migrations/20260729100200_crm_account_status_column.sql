-- Thêm cột trạng thái vào danh sách khách hàng.
--
-- Bảng khách hàng thay cột "Nhân viên phụ trách" bằng "Trạng thái"; giá trị suy
-- tự động từ giai đoạn cơ hội mới nhất và đơn hàng gắn với nó, nên nhân viên
-- không phải cập nhật ở hai nơi và hai nơi không bao giờ lệch nhau.
--
-- Các cột owner_name / creator_name giữ nguyên: giao diện thôi không hiện chúng
-- ở bảng nữa, nhưng ngăn kéo chi tiết và báo cáo admin vẫn cần.

CREATE OR REPLACE VIEW public.crm_account_list
WITH (security_invoker = true) AS
SELECT
    a.id,
    a.code,
    a.kind,
    a.name,
    a.is_individual,
    a.phone,
    a.email,
    a.zalo_phone,
    a.tax_code,
    a.province,
    a.address,
    a.source,
    a.referrer_profile_id,
    a.linked_profile_id,
    a.owner_id,
    a.created_by,
    a.notes,
    a.created_at,
    a.updated_at,
    o.full_name      AS owner_name,
    o.email          AS owner_email,
    o.staff_segment  AS owner_segment,
    c.full_name      AS creator_name,
    c.email          AS creator_email,
    EXISTS (
        SELECT 1 FROM public.crm_handovers h
        WHERE h.account_id = a.id
    )                AS was_handed_over,
    public.crm_account_status(a.id) AS status_label
FROM public.crm_accounts a
LEFT JOIN public.crm_staff_directory o ON o.id = a.owner_id
LEFT JOIN public.crm_staff_directory c ON c.id = a.created_by;

GRANT SELECT ON public.crm_account_list TO authenticated;
