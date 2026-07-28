-- Danh bạ staff cho luồng bắn khách chéo.
--
-- Vì sao cần view: RLS của public.profiles chỉ cho đọc chính mình (profiles_select_self),
-- nhánh của supervisor, hoặc admin. Staff KHÔNG đọc được profile của staff khác, nên UI
-- không liệt kê được người nhận (smoke test 28/07/2026 phát hiện dropdown rỗng).
--
-- Cố tình KHÔNG dùng security_invoker: view chạy bằng quyền chủ sở hữu để đọc xuyên RLS,
-- nhưng chỉ lộ ĐÚNG 4 cột cần cho việc chọn người nhận (không có số tài khoản, CCCD,
-- địa chỉ…) và chỉ trả dòng khi người gọi là staff/admin.

CREATE OR REPLACE VIEW public.crm_staff_directory AS
SELECT
    p.id,
    p.full_name,
    p.email,
    p.staff_segment
FROM public.profiles p
WHERE p.role = 'staff'
  AND p.status = 'active'
  AND public.crm_role_allowed();

GRANT SELECT ON public.crm_staff_directory TO authenticated;
