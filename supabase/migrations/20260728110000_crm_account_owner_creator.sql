-- Admin cần thấy khách hàng do nhân viên nào QUẢN LÝ và do nhân viên nào TẠO RA.
-- Hai thứ này khác nhau sau khi bắn khách chéo: owner_id đổi sang người nhận,
-- còn người tạo ban đầu thì trước đây không lưu ở đâu trên bản ghi.

ALTER TABLE public.crm_accounts
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

COMMENT ON COLUMN public.crm_accounts.created_by IS
    'Nhân viên tạo bản ghi. KHÔNG đổi khi bắn khách chéo (owner_id mới đổi).';

-- Bản ghi cũ: coi người tạo là chủ sở hữu hiện tại (chưa có handover nào lúc này).
UPDATE public.crm_accounts SET created_by = owner_id WHERE created_by IS NULL;

CREATE OR REPLACE FUNCTION public.crm_set_account_created_by()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by := COALESCE(auth.uid(), NEW.owner_id);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_set_account_created_by() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_accounts_set_created_by ON public.crm_accounts;
CREATE TRIGGER crm_accounts_set_created_by
BEFORE INSERT ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.crm_set_account_created_by();

-- Danh bạ mở rộng cho cả admin: bản ghi có thể do admin tạo, và tên admin cũng
-- cần hiện được trên bảng. Dropdown bắn khách không bị ảnh hưởng vì nó lọc theo
-- staff_segment, mà admin thì staff_segment NULL.
CREATE OR REPLACE VIEW public.crm_staff_directory AS
SELECT
    p.id,
    p.full_name,
    p.email,
    p.staff_segment
FROM public.profiles p
WHERE p.role IN ('staff', 'admin')
  AND p.status = 'active'
  AND public.crm_role_allowed();

GRANT SELECT ON public.crm_staff_directory TO authenticated;

-- Bảng khách hàng kèm tên người quản lý + người tạo.
-- security_invoker = true để RLS của crm_accounts vẫn lọc dòng cho người gọi;
-- tên người thì lấy qua crm_staff_directory (RLS của profiles không cho staff
-- đọc profile của staff khác). LEFT JOIN để không bao giờ mất dòng.
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
    )                AS was_handed_over
FROM public.crm_accounts a
LEFT JOIN public.crm_staff_directory o ON o.id = a.owner_id
LEFT JOIN public.crm_staff_directory c ON c.id = a.created_by;

GRANT SELECT ON public.crm_account_list TO authenticated;
