-- Ba việc Boss chốt 01/08/2026 sau khi rà backlog:
--   1. Phân loại cơ sở cho khách tổ chức, và siết dải chiết khấu 15–20% xuống
--      chỉ còn đại lý phân phối. Bệnh viện mua về dùng trả giá niêm yết.
--   2. Dòng thời gian trên hồ sơ khách.
--   3. Danh sách cơ hội đứng yên / quá hạn để nhân viên khỏi bỏ quên.
--
-- Cả hai khung nhìn đều KHÔNG security_invoker mà tự lọc bằng crm_owner_visible,
-- vì chúng phải đọc audit_log (chính sách hiện tại chỉ cho quản trị). Cách này
-- lộ đúng dòng của khách mà người xem vốn đã có quyền, thay vì nới RLS audit_log.

-- ── 1. Loại cơ sở ────────────────────────────────────────────────────────────
ALTER TABLE public.crm_accounts
    ADD COLUMN IF NOT EXISTS org_type text
        CHECK (org_type IS NULL OR org_type IN
            ('benh_vien_cong', 'benh_vien_tu', 'phong_kham', 'spa', 'dai_ly', 'khac'));

COMMENT ON COLUMN public.crm_accounts.org_type IS
    'Loại cơ sở của khách tổ chức. Chỉ dai_ly (đại lý phân phối) mới được hưởng dải chiết khấu; nơi khác mua về dùng nên trả giá niêm yết.';

-- Khách tổ chức đã có từ trước thì coi như đại lý phân phối, giữ nguyên cách
-- tính giá cũ. Production hiện có 0 dòng loại này nên thực tế không đụng gì.
UPDATE public.crm_accounts
   SET org_type = 'dai_ly'
 WHERE kind = 'dealer_prospect' AND org_type IS NULL;

ALTER TABLE public.crm_settings
    ADD COLUMN IF NOT EXISTS followup_stale_days smallint NOT NULL DEFAULT 7
        CHECK (followup_stale_days > 0 AND followup_stale_days <= 90);

COMMENT ON COLUMN public.crm_settings.followup_stale_days IS
    'Bao nhiêu ngày không ai động tới thì coi cơ hội là đang đứng yên.';

-- ── Dải giá chỉ áp cho đại lý phân phối ──────────────────────────────────────
-- Thay bản ở 20260801020000: thêm điều kiện org_type = 'dai_ly'.
CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_forecast    text;
    v_stage       text;
    v_kind        text;
    v_org         text;
    v_dealer_unit numeric(14,2);
    v_base_unit   numeric(14,2);
    v_floor       numeric(14,2);
    v_ceiling     numeric(14,2);
    v_min_disc    numeric(5,4);
BEGIN
    SELECT forecast, name INTO v_forecast, v_stage
    FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_forecast IS NULL THEN
        RAISE EXCEPTION 'crm_opportunities: stage_id % không tồn tại', NEW.stage_id;
    END IF;

    IF NEW.code IS NULL THEN
        NEW.code := 'CH-' || lpad(nextval('public.crm_opportunity_code_seq')::text, 6, '0');
    END IF;

    IF v_forecast IN ('won', 'lost') THEN
        NEW.closed_at := COALESCE(NEW.closed_at, now());
    ELSE
        NEW.closed_at := NULL;
        NEW.lost_notes := NULL;
        NEW.lost_reason_id := NULL;
    END IF;

    IF NEW.lost_reason_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.crm_lost_reasons r
        WHERE r.id = NEW.lost_reason_id AND r.active
    ) THEN
        RAISE EXCEPTION 'crm_opportunities: lý do mất không hợp lệ';
    END IF;

    IF v_forecast = 'lost' AND NEW.lost_reason_id IS NULL
       AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
        RAISE EXCEPTION 'crm_opportunities: phải chọn lý do mất khi chuyển sang giai đoạn "%"', v_stage;
    END IF;

    IF NEW.amount > 0 AND NEW.model_id IS NOT NULL THEN
        SELECT kind, org_type INTO v_kind, v_org
          FROM public.crm_accounts WHERE id = NEW.account_id;

        -- Chỉ đại lý phân phối mới có dải chiết khấu. Bệnh viện, phòng khám,
        -- spa mua về dùng thì như khách cá nhân: giá niêm yết, không soát.
        IF v_kind = 'dealer_prospect' AND v_org = 'dai_ly' THEN
            SELECT dealer_price, base_price INTO v_dealer_unit, v_base_unit
              FROM public.product_models WHERE id = NEW.model_id;

            IF v_dealer_unit IS NOT NULL THEN
                v_floor := round(v_dealer_unit * COALESCE(NEW.quantity, 1), 2);
                IF NEW.amount < v_floor THEN
                    RAISE EXCEPTION
                        'Giá bán cho đại lý phân phối không được thấp hơn sàn % đ (% máy × % đ)',
                        to_char(v_floor, 'FM999,999,999,999'),
                        COALESCE(NEW.quantity, 1),
                        to_char(v_dealer_unit, 'FM999,999,999,999');
                END IF;

                SELECT dealer_discount_min INTO v_min_disc FROM public.crm_settings WHERE id;
                v_ceiling := GREATEST(
                    round(v_base_unit * (1 - COALESCE(v_min_disc, 0)) * COALESCE(NEW.quantity, 1), 2),
                    v_floor
                );
                IF NEW.amount > v_ceiling THEN
                    RAISE EXCEPTION
                        'Đại lý phân phối phải được chiết khấu ít nhất %, giá không được cao hơn % đ (% máy × % đ)',
                        rtrim(to_char(COALESCE(v_min_disc, 0) * 100, 'FM999999.99'), '.') || '%',
                        to_char(v_ceiling, 'FM999,999,999,999'),
                        COALESCE(NEW.quantity, 1),
                        to_char(round(v_ceiling / COALESCE(NEW.quantity, 1), 2), 'FM999,999,999,999');
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC;

-- ── 2. Dòng thời gian của một khách ──────────────────────────────────────────
DROP VIEW IF EXISTS public.crm_account_timeline;
CREATE VIEW public.crm_account_timeline AS
SELECT * FROM (
    -- Hoạt động gắn thẳng vào khách hoặc vào cơ hội của khách.
    SELECT
        COALESCE(ac.account_id, op.account_id)    AS account_id,
        COALESCE(ac.done_at, ac.due_at, ac.created_at) AS at,
        'activity'::text                          AS entry,
        ac.kind::text                             AS sub_kind,
        ac.subject                                AS title,
        ac.notes                                  AS detail,
        COALESCE(d.full_name, d.email)            AS who,
        a.owner_id                                AS visible_owner
    FROM public.crm_activities ac
    LEFT JOIN public.crm_opportunities op ON op.id = ac.opportunity_id
    JOIN public.crm_accounts a ON a.id = COALESCE(ac.account_id, op.account_id)
    LEFT JOIN public.crm_staff_directory d ON d.id = ac.owner_id

    UNION ALL

    -- Mỗi lần cơ hội của khách đổi giai đoạn.
    SELECT
        op.account_id,
        al.created_at,
        'stage',
        NULL,
        op.name,
        COALESCE(sb.name, '?') || ' → ' || COALESCE(sa.name, '?'),
        COALESCE(d.full_name, d.email),
        a.owner_id
    FROM public.audit_log al
    JOIN public.crm_opportunities op ON op.id = al.target_id
    JOIN public.crm_accounts a       ON a.id = op.account_id
    LEFT JOIN public.crm_stages sb   ON sb.id = (al.before ->> 'stage_id')::uuid
    LEFT JOIN public.crm_stages sa   ON sa.id = (al.after  ->> 'stage_id')::uuid
    LEFT JOIN public.crm_staff_directory d ON d.id = al.actor_id
    WHERE al.action = 'crm_stage_change' AND al.target_table = 'crm_opportunities'
) t
WHERE public.crm_owner_visible(t.visible_owner)
ORDER BY at DESC NULLS LAST;

GRANT SELECT ON public.crm_account_timeline TO authenticated;

-- ── 3. Cơ hội đứng yên hoặc quá hạn ──────────────────────────────────────────
DROP VIEW IF EXISTS public.crm_followup_due;
CREATE VIEW public.crm_followup_due AS
SELECT
    op.id,
    op.code,
    op.name,
    op.account_id,
    a.name                                   AS account_name,
    s.name                                   AS stage_name,
    op.amount,
    op.expected_close_date,
    la.last_at                               AS last_activity_at,
    GREATEST(0, (current_date - COALESCE(la.last_at::date, op.created_at::date)))::int AS days_idle,
    CASE WHEN op.expected_close_date < current_date THEN 'overdue' ELSE 'stale' END    AS reason,
    COALESCE(d.full_name, d.email)           AS owner_name
FROM public.crm_opportunities op
JOIN public.crm_stages s   ON s.id = op.stage_id AND s.forecast = 'open'
JOIN public.crm_accounts a ON a.id = op.account_id
CROSS JOIN public.crm_settings cfg
LEFT JOIN public.crm_staff_directory d ON d.id = op.owner_id
LEFT JOIN LATERAL (
    SELECT max(COALESCE(ac.done_at, ac.due_at, ac.created_at)) AS last_at
    FROM public.crm_activities ac
    WHERE ac.opportunity_id = op.id OR ac.account_id = op.account_id
) la ON true
WHERE public.crm_owner_visible(op.owner_id)
  AND (
        op.expected_close_date < current_date
     OR COALESCE(la.last_at::date, op.created_at::date) < current_date - cfg.followup_stale_days
  )
ORDER BY op.expected_close_date;

GRANT SELECT ON public.crm_followup_due TO authenticated;

-- ── Khung nhìn danh sách khách phải lộ thêm org_type ─────────────────────────
-- crm_account_list liệt kê cột tường minh nên thêm cột vào bảng là chưa đủ.
-- DROP rồi tạo lại vì CREATE OR REPLACE VIEW không chèn được cột vào giữa.
DROP VIEW IF EXISTS public.crm_account_list;
CREATE VIEW public.crm_account_list
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
    a.org_type,
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
    public.crm_account_status(a.id) AS status_label,
    a.stage_id,
    COALESCE(agg.total_quantity, 0)      AS total_quantity,
    COALESCE(agg.expected_commission, 0) AS expected_commission,
    COALESCE(agg.open_deals, 0)          AS open_deals
FROM public.crm_accounts a
LEFT JOIN public.crm_staff_directory o ON o.id = a.owner_id
LEFT JOIN public.crm_staff_directory c ON c.id = a.created_by
LEFT JOIN LATERAL (
    SELECT
        sum(op.quantity)::int                              AS total_quantity,
        round(sum(op.amount) * max(cfg.staff_rate), 2)     AS expected_commission,
        count(*) FILTER (WHERE st.forecast = 'open')::int  AS open_deals
    FROM public.crm_opportunities op
    JOIN public.crm_stages st ON st.id = op.stage_id
    CROSS JOIN public.crm_settings cfg
    WHERE op.account_id = a.id
      AND st.forecast <> 'lost'
) agg ON true;

GRANT SELECT ON public.crm_account_list TO authenticated;
