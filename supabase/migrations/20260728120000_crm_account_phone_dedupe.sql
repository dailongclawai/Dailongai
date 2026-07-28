-- Chống trùng khách theo số điện thoại.
--
-- Vì sao cần: hoa hồng staff và thưởng bắn khách chéo đều bám vào crm_accounts.
-- Hai nhân viên nhập cùng một số là tạo ra hai khách riêng, tới lúc chốt deal thì
-- cả hai cùng đòi hoa hồng và admin không có căn cứ để xử.
--
-- Vì sao dùng trigger chứ không phải UNIQUE INDEX: dữ liệu prod có thể đã trùng
-- sẵn, unique index sẽ làm migration chết giữa chừng. Trigger chỉ chặn bản ghi
-- MỚI; các cặp trùng cũ giữ nguyên và tra được qua view crm_account_phone_duplicates
-- để admin dọn tay.

-- Chuẩn hoá: bỏ mọi ký tự không phải số, quy +84/84 về 0. IMMUTABLE để đánh index được.
CREATE OR REPLACE FUNCTION public.crm_normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NULLIF(
        CASE
            WHEN d LIKE '840%' AND length(d) = 12 THEN '0' || substr(d, 4)
            WHEN d LIKE '84%'  AND length(d) = 11 THEN '0' || substr(d, 3)
            ELSE d
        END, '')
    FROM (SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) AS x(d);
$$;

CREATE INDEX IF NOT EXISTS idx_crm_accounts_phone_norm
    ON public.crm_accounts (public.crm_normalize_phone(phone))
    WHERE phone IS NOT NULL;

-- SECURITY DEFINER: guard phải nhìn thấy TOÀN BỘ khách, không chỉ phần RLS cho
-- người đang ghi thấy. Nếu chạy dưới quyền người gọi thì nhân viên A không thấy
-- khách của nhân viên B và guard sẽ cho qua — đúng cái ta muốn chặn.
CREATE OR REPLACE FUNCTION public.crm_account_phone_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_norm text;
    v_dup  record;
BEGIN
    v_norm := public.crm_normalize_phone(NEW.phone);
    IF v_norm IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT a.code, a.name, p.full_name AS owner_name
    INTO v_dup
    FROM public.crm_accounts a
    LEFT JOIN public.profiles p ON p.id = a.owner_id
    WHERE a.id <> NEW.id
      AND public.crm_normalize_phone(a.phone) = v_norm
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Số % đã thuộc khách "%" (%), nhân viên phụ trách: %',
            v_norm, v_dup.name, COALESCE(v_dup.code, '—'), COALESCE(v_dup.owner_name, '—')
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_accounts_phone_guard ON public.crm_accounts;
CREATE TRIGGER crm_accounts_phone_guard
BEFORE INSERT OR UPDATE OF phone ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.crm_account_phone_guard();

-- Tra cứu trước khi nhập: trả về khách đã tồn tại kèm tên người phụ trách để
-- nhân viên biết phải xin bắn khách từ ai. SECURITY DEFINER vì mục đích của hàm
-- chính là nhìn xuyên RLS; bù lại chỉ trả đúng 5 cột tối thiểu, không trả email,
-- địa chỉ hay ghi chú của khách người khác.
CREATE OR REPLACE FUNCTION public.crm_lookup_phones(p_phones text[])
RETURNS TABLE (
    phone_norm text,
    account_id uuid,
    code       text,
    name       text,
    owner_id   uuid,
    owner_name text,
    is_mine    boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.current_role() NOT IN ('staff', 'admin') THEN
        RAISE EXCEPTION 'Chỉ nhân viên kinh doanh và quản trị được tra cứu số điện thoại';
    END IF;

    RETURN QUERY
    SELECT DISTINCT ON (n.norm)
        n.norm,
        a.id,
        a.code,
        a.name,
        a.owner_id,
        p.full_name,
        a.owner_id = auth.uid()
    FROM (
        SELECT DISTINCT public.crm_normalize_phone(x) AS norm
        FROM unnest(COALESCE(p_phones, '{}'::text[])) AS x
    ) n
    JOIN public.crm_accounts a ON public.crm_normalize_phone(a.phone) = n.norm
    LEFT JOIN public.profiles p ON p.id = a.owner_id
    WHERE n.norm IS NOT NULL
    ORDER BY n.norm, a.created_at;
END;
$$;

-- Dọn dữ liệu trùng có từ trước trigger. security_invoker nên chỉ admin (thấy mọi
-- dòng) mới đọc ra cặp trùng; staff thấy đúng phần của mình nên view trống.
CREATE OR REPLACE VIEW public.crm_account_phone_duplicates
WITH (security_invoker = true) AS
SELECT
    public.crm_normalize_phone(phone) AS phone_norm,
    count(*)                          AS account_count,
    array_agg(id ORDER BY created_at) AS account_ids,
    array_agg(name ORDER BY created_at) AS account_names
FROM public.crm_accounts
WHERE public.crm_normalize_phone(phone) IS NOT NULL
GROUP BY 1
HAVING count(*) > 1;

GRANT SELECT ON public.crm_account_phone_duplicates TO authenticated;

REVOKE EXECUTE ON FUNCTION public.crm_account_phone_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_lookup_phones(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_lookup_phones(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_lookup_phones(text[]) TO authenticated;
