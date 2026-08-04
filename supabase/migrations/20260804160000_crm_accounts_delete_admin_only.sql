-- Siết quyền xoá khách về quản trị (Boss chốt 04/08/2026).
--
-- Policy cũ (20260728100200) cho nhân viên xoá bất kỳ khách nào mình sở hữu.
-- Giao diện không có nút xoá, nhưng portal dùng Supabase client phía trình duyệt
-- nên gọi thẳng REST API là xoá được. Mà mọi khoá ngoại trỏ về crm_accounts đều
-- ON DELETE CASCADE: xoá một khách là cuốn theo liên hệ, cơ hội, hoạt động, bàn
-- giao, bằng chứng KPI và cả crm_staff_commissions — tức xoá luôn dấu vết hoa
-- hồng đã phát sinh. Từ nay chỉ quản trị xoá được.
DROP POLICY IF EXISTS crm_accounts_delete ON public.crm_accounts;
CREATE POLICY crm_accounts_delete ON public.crm_accounts
    FOR DELETE TO authenticated
    USING (public.current_role() = 'admin');
