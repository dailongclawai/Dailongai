-- Nhật ký đổi trạng thái khách + khoá trạng thái cuối.
--
-- 1. Mỗi lần trạng thái khách đổi thì ghi vào audit_log, dùng lại đúng action
--    'crm_stage_change' như bên cơ hội để dòng thời gian đọc chung một chỗ.
-- 2. Khách đã "Hoàn thành đơn" (won) hoặc "Không mua" (lost) thì khoá trạng thái.
-- 3. crm_account_list thêm stage_since và stage_locked để bảng khách hiện được
--    "ở trạng thái này bao lâu rồi" mà không phải truy vấn thêm.
-- 4. crm_account_timeline gộp thêm lịch sử đổi trạng thái của chính khách.

-- ── 1. Ghi nhật ký ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_account_audit_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    PERFORM public.write_audit(
        'crm_stage_change',
        'crm_accounts',
        NEW.id,
        jsonb_build_object('stage_id', OLD.stage_id),
        jsonb_build_object('stage_id', NEW.stage_id)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_accounts_audit_stage ON public.crm_accounts;
CREATE TRIGGER crm_accounts_audit_stage
    AFTER UPDATE OF stage_id ON public.crm_accounts
    FOR EACH ROW
    WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
    EXECUTE FUNCTION public.crm_account_audit_stage();

-- ── 2. Khoá trạng thái cuối ───────────────────────────────────────────────────
-- Người dùng đổi thẳng thì báo lỗi cho biết. Nhưng khi lệnh đến từ một trigger
-- khác (cơ hội kéo trạng thái khách đi theo) thì chỉ lặng lẽ giữ nguyên — báo lỗi
-- ở đó sẽ làm hỏng cả thao tác trên cơ hội, mà lỗi lại không phải của người dùng.
CREATE OR REPLACE FUNCTION public.crm_account_stage_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_forecast_cu text;
    v_ten_cu      text;
BEGIN
    SELECT forecast, name INTO v_forecast_cu, v_ten_cu
      FROM public.crm_stages WHERE id = OLD.stage_id;

    IF v_forecast_cu IS NULL OR v_forecast_cu NOT IN ('won', 'lost') THEN
        RETURN NEW;
    END IF;

    IF pg_trigger_depth() > 1 THEN
        NEW.stage_id := OLD.stage_id;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Khách đã ở trạng thái "%" nên không đổi được nữa.', v_ten_cu
        USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS crm_accounts_stage_lock ON public.crm_accounts;
CREATE TRIGGER crm_accounts_stage_lock
    BEFORE UPDATE OF stage_id ON public.crm_accounts
    FOR EACH ROW
    WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
    EXECUTE FUNCTION public.crm_account_stage_lock();

-- ── 3. Lấy mốc vào trạng thái hiện tại ────────────────────────────────────────
-- audit_log chỉ cho admin đọc, mà crm_account_list chạy bằng quyền người gọi.
-- Đọc thẳng trong view thì nhân viên nhận rỗng và mốc thời gian sai. Bọc bằng
-- SECURITY DEFINER giống nếp crm_account_status đang dùng ngay trong view này.
CREATE OR REPLACE FUNCTION public.crm_account_stage_since(p_account_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT COALESCE(
        (SELECT max(al.created_at)
           FROM audit_log al
          WHERE al.action = 'crm_stage_change'
            AND al.target_table = 'crm_accounts'
            AND al.target_id = p_account_id),
        (SELECT a.created_at FROM crm_accounts a WHERE a.id = p_account_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.crm_account_stage_since(uuid) TO authenticated;

-- ── 4. Bảng khách: từ lúc nào ở trạng thái này, có bị khoá không ──────────────
CREATE OR REPLACE VIEW public.crm_account_list
WITH (security_invoker = true) AS
SELECT a.id,
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
    a.org_type,
    a.referrer_profile_id,
    a.linked_profile_id,
    a.owner_id,
    a.created_by,
    a.notes,
    a.created_at,
    a.updated_at,
    o.full_name AS owner_name,
    o.email AS owner_email,
    o.staff_segment AS owner_segment,
    c.full_name AS creator_name,
    c.email AS creator_email,
    (EXISTS ( SELECT 1
           FROM crm_handovers h
          WHERE h.account_id = a.id)) AS was_handed_over,
    crm_account_status(a.id) AS status_label,
    a.stage_id,
    COALESCE(agg.total_quantity, 0) AS total_quantity,
    COALESCE(agg.expected_commission, 0::numeric) AS expected_commission,
    COALESCE(agg.open_deals, 0) AS open_deals,
    -- Cột mới phải nằm cuối: CREATE OR REPLACE VIEW không cho chèn vào giữa.
    crm_account_stage_since(a.id) AS stage_since,
    COALESCE(st.forecast IN ('won', 'lost'), false) AS stage_locked
   FROM crm_accounts a
     LEFT JOIN crm_staff_directory o ON o.id = a.owner_id
     LEFT JOIN crm_staff_directory c ON c.id = a.created_by
     LEFT JOIN crm_stages st ON st.id = a.stage_id
     LEFT JOIN LATERAL ( SELECT sum(op.quantity)::integer AS total_quantity,
            round(sum(op.amount) * max(cfg.staff_rate), 2) AS expected_commission,
            count(*) FILTER (WHERE st2.forecast = 'open'::text)::integer AS open_deals
           FROM crm_opportunities op
             JOIN crm_stages st2 ON st2.id = op.stage_id
             CROSS JOIN crm_settings cfg
          WHERE op.account_id = a.id AND st2.forecast <> 'lost'::text) agg ON true;

GRANT SELECT ON public.crm_account_list TO authenticated;

-- ── 5. Dòng thời gian gộp thêm đổi trạng thái của khách ──────────────────────
-- View này CỐ Ý không bật security_invoker: nó chạy bằng quyền chủ sở hữu để đọc
-- được audit_log, và tự lọc bằng crm_owner_visible ở cuối. Bật lên là mất sạch
-- các dòng đổi trạng thái vì nhân viên không có quyền trên audit_log.
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
    -- Đổi trạng thái của chính khách hàng.
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
) t
WHERE crm_owner_visible(visible_owner)
ORDER BY at DESC NULLS LAST;

GRANT SELECT ON public.crm_account_timeline TO authenticated;
