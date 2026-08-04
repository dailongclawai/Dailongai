-- Nhật ký sửa thông tin CRM + khoá nhật ký chăm sóc.
--
-- Boss chốt 04/08/2026: không mở nút xoá khách cho nhân viên. Đổi lại, mọi lần
-- sửa thông tin quan trọng đều để lại vết, nhật ký chăm sóc không viết lại được
-- sau 30 phút, và cả hai đều hiện trên dòng thời gian của khách — minh bạch có
-- sức răn đe hơn cấm đoán, mà nhân viên trung thực cũng có cái để tự bảo vệ.
--
-- 1. Trigger ghi audit_log ('crm_field_change') khi trường quan trọng đổi giá
--    trị. Dùng lại write_audit + audit_log bất biến sẵn có, không dựng bảng mới.
-- 2. crm_activities: nhân viên hết quyền xoá; nội dung khoá sau 30 phút, chỉ còn
--    tiến trình (done_at/outcome/due_at) là sửa được.
-- 3. crm_account_timeline gộp thêm ba nguồn log trên. Giá trị nhạy cảm (số điện
--    thoại, email, địa chỉ, ghi chú) chỉ hiện "đã cập nhật" — audit_log đầy đủ
--    vẫn nằm sau RLS admin-only như cũ.
--
-- Cố ý KHÔNG theo dõi owner_id và stage_id: chuyển giao khách đã có log
-- 'crm_handover', đổi giai đoạn đã có log 'crm_stage_change'. Ghi thêm chỉ làm
-- dòng thời gian mọc hai dòng cho cùng một việc.

-- ── 1. Nhật ký sửa trường ────────────────────────────────────────────────────
-- Danh sách cột truyền qua tham số trigger để một hàm dùng chung cho cả ba bảng.
CREATE OR REPLACE FUNCTION public.crm_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_old    jsonb := to_jsonb(OLD);
    v_new    jsonb := to_jsonb(NEW);
    v_before jsonb := '{}'::jsonb;
    v_after  jsonb := '{}'::jsonb;
    v_col    text;
BEGIN
    FOREACH v_col IN ARRAY TG_ARGV LOOP
        IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
            v_before := v_before || jsonb_build_object(v_col, v_old -> v_col);
            v_after  := v_after  || jsonb_build_object(v_col, v_new -> v_col);
        END IF;
    END LOOP;

    -- Câu UPDATE có chạm cột nhưng giá trị không đổi thì không ghi gì.
    IF v_after = '{}'::jsonb THEN
        RETURN NULL;
    END IF;

    PERFORM public.write_audit('crm_field_change', TG_TABLE_NAME, NEW.id, v_before, v_after);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_audit_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_accounts_audit_fields ON public.crm_accounts;
CREATE TRIGGER crm_accounts_audit_fields
    AFTER UPDATE OF name, phone, email, zalo_phone, tax_code, province, address,
                    source, org_type, kind
    ON public.crm_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_audit_fields(
        'name', 'phone', 'email', 'zalo_phone', 'tax_code', 'province', 'address',
        'source', 'org_type', 'kind');

DROP TRIGGER IF EXISTS crm_opportunities_audit_fields ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_audit_fields
    AFTER UPDATE OF name, amount, quantity, model_id, expected_close_date,
                    lost_reason_id, lost_notes, trial_days
    ON public.crm_opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_audit_fields(
        'name', 'amount', 'quantity', 'model_id', 'expected_close_date',
        'lost_reason_id', 'lost_notes', 'trial_days');

DROP TRIGGER IF EXISTS crm_activities_audit_fields ON public.crm_activities;
CREATE TRIGGER crm_activities_audit_fields
    AFTER UPDATE OF kind, subject, notes, due_at, done_at, outcome
    ON public.crm_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_audit_fields(
        'kind', 'subject', 'notes', 'due_at', 'done_at', 'outcome');

-- ── 2. Nhật ký chăm sóc không viết lại được ──────────────────────────────────
-- Xoá: chỉ còn quản trị. Nhân viên ghi nhầm thì ghi hoạt động mới đính chính,
-- không xoá dấu vết cũ.
DROP POLICY IF EXISTS crm_activities_delete ON public.crm_activities;
CREATE POLICY crm_activities_delete ON public.crm_activities
    FOR DELETE TO authenticated
    USING (public.current_role() = 'admin');

-- Sửa: 30 phút đầu để chữa lỗi gõ. Sau đó phần nội dung đóng băng, nhưng tiến
-- trình công việc (đến hạn, hoàn thành, kết quả) vẫn chạy bình thường — một
-- nhiệm vụ giao hôm nay hoàn thành tuần sau là chuyện thường.
-- owner_id cố ý không khoá: chuyển giao khách (crm_transfer_account) dời việc
-- chưa xong sang người mới, và RLS đã chặn nhân viên tự gán việc cho người khác.
CREATE OR REPLACE FUNCTION public.crm_activity_edit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF public.current_role() = 'admin' THEN
        RETURN NEW;
    END IF;

    IF now() > OLD.created_at + interval '30 minutes' AND (
           NEW.subject        IS DISTINCT FROM OLD.subject
        OR NEW.notes          IS DISTINCT FROM OLD.notes
        OR NEW.kind           IS DISTINCT FROM OLD.kind
        OR NEW.account_id     IS DISTINCT FROM OLD.account_id
        OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
        OR NEW.contact_id     IS DISTINCT FROM OLD.contact_id
        OR NEW.companion_id   IS DISTINCT FROM OLD.companion_id
    ) THEN
        RAISE EXCEPTION 'Nhật ký chăm sóc chỉ sửa được trong 30 phút đầu — hãy ghi một hoạt động mới thay vì sửa lại hoạt động cũ.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD.done_at IS NOT NULL
       AND now() > OLD.done_at + interval '30 minutes'
       AND (NEW.done_at IS DISTINCT FROM OLD.done_at OR NEW.outcome IS DISTINCT FROM OLD.outcome)
    THEN
        RAISE EXCEPTION 'Kết quả đã chốt quá 30 phút nên không sửa lại được — hãy ghi một hoạt động mới.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_activity_edit_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_activities_edit_guard ON public.crm_activities;
CREATE TRIGGER crm_activities_edit_guard
    BEFORE UPDATE ON public.crm_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_activity_edit_guard();

-- ── 3. Dòng thời gian đọc được nhật ký sửa ───────────────────────────────────
-- Nhãn tiếng Việt cho tên cột. Nhãn trung tính vì cùng một cột dùng ở nhiều
-- bảng (name là tên khách lẫn tên cơ hội) — tiêu đề dòng đã nói rõ đối tượng.
CREATE OR REPLACE FUNCTION public.crm_field_label(p_field text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
    SELECT CASE p_field
        WHEN 'name'                THEN 'Tên'
        WHEN 'phone'               THEN 'Điện thoại'
        WHEN 'email'               THEN 'Email'
        WHEN 'zalo_phone'          THEN 'Zalo'
        WHEN 'tax_code'            THEN 'Mã số thuế'
        WHEN 'province'            THEN 'Tỉnh/Thành'
        WHEN 'address'             THEN 'Địa chỉ'
        WHEN 'source'              THEN 'Nguồn'
        WHEN 'org_type'            THEN 'Loại tổ chức'
        WHEN 'kind'                THEN 'Loại'
        WHEN 'amount'              THEN 'Giá trị'
        WHEN 'quantity'            THEN 'Số lượng'
        WHEN 'model_id'            THEN 'Model máy'
        WHEN 'expected_close_date' THEN 'Ngày dự kiến chốt'
        WHEN 'lost_reason_id'      THEN 'Lý do thua'
        WHEN 'lost_notes'          THEN 'Ghi chú thua'
        WHEN 'trial_days'          THEN 'Số ngày dùng thử'
        WHEN 'subject'             THEN 'Tiêu đề'
        WHEN 'notes'               THEN 'Ghi chú'
        WHEN 'outcome'             THEN 'Kết quả'
        WHEN 'due_at'              THEN 'Hạn'
        WHEN 'done_at'             THEN 'Hoàn thành lúc'
        ELSE p_field
    END;
$$;

-- Trường chỉ báo "đã cập nhật", không phơi giá trị: dữ liệu cá nhân của khách,
-- ghi chú dài, và các khoá ngoại (uuid trần thì người đọc cũng không hiểu gì).
CREATE OR REPLACE FUNCTION public.crm_field_masked(p_field text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
    SELECT p_field IN ('phone', 'email', 'zalo_phone', 'address', 'tax_code',
                       'notes', 'lost_notes', 'outcome')
        OR right(p_field, 3) = '_id';
$$;

GRANT EXECUTE ON FUNCTION public.crm_field_label(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_field_masked(text) TO authenticated;

-- Gộp các trường đổi trong một lần lưu thành một dòng đọc được:
-- "Tên: Anh Ba → Anh Bảy; Điện thoại: đã cập nhật".
CREATE OR REPLACE FUNCTION public.crm_field_change_detail(p_before jsonb, p_after jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
    SELECT string_agg(
        public.crm_field_label(k.key) || ': ' ||
        CASE WHEN public.crm_field_masked(k.key) THEN 'đã cập nhật'
             ELSE COALESCE(NULLIF(p_before ->> k.key, ''), '—')
                  || ' → ' || COALESCE(NULLIF(p_after ->> k.key, ''), '—')
        END,
        '; ' ORDER BY k.key)
    FROM jsonb_each(p_after) k;
$$;

GRANT EXECUTE ON FUNCTION public.crm_field_change_detail(jsonb, jsonb) TO authenticated;

-- Vẫn cố ý KHÔNG bật security_invoker (phải đọc audit_log), tự lọc bằng
-- crm_owner_visible như cũ.
CREATE OR REPLACE VIEW public.crm_account_timeline AS
SELECT account_id, at, entry, sub_kind, title, detail, who, visible_owner
FROM (
    SELECT COALESCE(ac.account_id, op.account_id) AS account_id,
        COALESCE(ac.done_at, ac.due_at, ac.created_at) AS at,
        'activity'::text AS entry,
        ac.kind AS sub_kind,
        ac.subject AS title,
        ac.notes AS detail,
        COALESCE(d.full_name, d.email) AS who,
        a.owner_id AS visible_owner
       FROM crm_activities ac
         LEFT JOIN crm_opportunities op ON op.id = ac.opportunity_id
         JOIN crm_accounts a ON a.id = COALESCE(ac.account_id, op.account_id)
         LEFT JOIN crm_staff_directory d ON d.id = ac.owner_id
    UNION ALL
    SELECT op.account_id,
        al.created_at,
        'stage'::text,
        NULL::text,
        op.name,
        (COALESCE(sb.name, '?'::text) || ' → '::text) || COALESCE(sa.name, '?'::text),
        COALESCE(d.full_name, d.email),
        a.owner_id
       FROM audit_log al
         JOIN crm_opportunities op ON op.id = al.target_id
         JOIN crm_accounts a ON a.id = op.account_id
         LEFT JOIN crm_stages sb ON sb.id = ((al.before ->> 'stage_id'::text)::uuid)
         LEFT JOIN crm_stages sa ON sa.id = ((al.after ->> 'stage_id'::text)::uuid)
         LEFT JOIN crm_staff_directory d ON d.id = al.actor_id
      WHERE al.action = 'crm_stage_change'::text
        AND al.target_table = 'crm_opportunities'::text
    UNION ALL
    -- Đổi trạng thái của chính khách hàng. Trigger đồng bộ làm khách và cơ hội
    -- đổi trong CÙNG một transaction (cùng created_at) — khi đó dòng cơ hội đã
    -- kể đủ câu chuyện, dòng khách chỉ là tiếng vọng nên bỏ.
    SELECT a.id,
        al.created_at,
        'stage'::text,
        'account'::text,
        a.name,
        (COALESCE(sb.name, '?'::text) || ' → '::text) || COALESCE(sa.name, '?'::text),
        COALESCE(d.full_name, d.email),
        a.owner_id
       FROM audit_log al
         JOIN crm_accounts a ON a.id = al.target_id
         LEFT JOIN crm_stages sb ON sb.id = ((al.before ->> 'stage_id'::text)::uuid)
         LEFT JOIN crm_stages sa ON sa.id = ((al.after ->> 'stage_id'::text)::uuid)
         LEFT JOIN crm_staff_directory d ON d.id = al.actor_id
      WHERE al.action = 'crm_stage_change'::text
        AND al.target_table = 'crm_accounts'::text
        AND NOT EXISTS (
            SELECT 1
            FROM audit_log al2
            JOIN crm_opportunities op2 ON op2.id = al2.target_id
            WHERE al2.action = 'crm_stage_change'::text
              AND al2.target_table = 'crm_opportunities'::text
              AND op2.account_id = a.id
              AND al2.created_at = al.created_at
        )
    UNION ALL
    -- Sửa thông tin khách
    SELECT a.id,
        al.created_at,
        'field'::text,
        'account'::text,
        a.name,
        public.crm_field_change_detail(al.before, al.after),
        COALESCE(d.full_name, d.email),
        a.owner_id
       FROM audit_log al
         JOIN crm_accounts a ON a.id = al.target_id
         LEFT JOIN crm_staff_directory d ON d.id = al.actor_id
      WHERE al.action = 'crm_field_change'::text
        AND al.target_table = 'crm_accounts'::text
    UNION ALL
    -- Sửa thông tin cơ hội
    SELECT op.account_id,
        al.created_at,
        'field'::text,
        'opportunity'::text,
        op.name,
        public.crm_field_change_detail(al.before, al.after),
        COALESCE(d.full_name, d.email),
        a.owner_id
       FROM audit_log al
         JOIN crm_opportunities op ON op.id = al.target_id
         JOIN crm_accounts a ON a.id = op.account_id
         LEFT JOIN crm_staff_directory d ON d.id = al.actor_id
      WHERE al.action = 'crm_field_change'::text
        AND al.target_table = 'crm_opportunities'::text
    UNION ALL
    -- Sửa nhật ký chăm sóc
    SELECT COALESCE(ac.account_id, op.account_id),
        al.created_at,
        'field'::text,
        'activity'::text,
        ac.subject,
        public.crm_field_change_detail(al.before, al.after),
        COALESCE(d.full_name, d.email),
        a.owner_id
       FROM audit_log al
         JOIN crm_activities ac ON ac.id = al.target_id
         LEFT JOIN crm_opportunities op ON op.id = ac.opportunity_id
         JOIN crm_accounts a ON a.id = COALESCE(ac.account_id, op.account_id)
         LEFT JOIN crm_staff_directory d ON d.id = al.actor_id
      WHERE al.action = 'crm_field_change'::text
        AND al.target_table = 'crm_activities'::text
) t
WHERE crm_owner_visible(visible_owner)
ORDER BY at DESC NULLS LAST;

GRANT SELECT ON public.crm_account_timeline TO authenticated;
