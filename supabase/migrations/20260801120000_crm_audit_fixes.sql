-- Vá theo audit CRM sáng 01/08/2026 (Boss duyệt "sửa hết"):
--
-- 1. crm_staff_report đếm tiền sai: join thẳng cơ hội × hoa hồng vào cùng một
--    GROUP BY nên sum(amount) bị nhân theo số cơ hội (1 nhân viên 2 cơ hội +
--    300k hoa hồng → báo 600k). Tách hai nhánh thành sub-aggregate rồi mới join.
--    Nhân tiện thêm cột amount_pending vì trang Báo cáo có sẵn tiêu đề đó mà
--    view không có số — bảng đang lệch nguyên một cột.
-- 2. crm_opportunity_board thêm cột notes: drawer sửa cơ hội không đọc được ghi
--    chú cũ nên mỗi lần bấm Lưu là ghi đè null — sửa xong ở đây thì giao diện
--    prefill được và hết mất dữ liệu.
-- 3. crm_account_timeline: mỗi lần đổi trạng thái sinh hai dòng (cơ hội + khách
--    cùng một transaction nên cùng created_at). Giữ dòng của cơ hội — nó nêu tên
--    thương vụ — và bỏ dòng của khách khi trùng thời điểm.
-- 4. Khoá trạng thái cuối: quản trị được mở khoá (đổi nhầm "Không mua" thì trước
--    đây phải sửa SQL tay). Nhân viên vẫn bị chặn như cũ.
-- 5. Cơ hội đã đóng sổ: chỉ quản trị kéo lại được, và phải mở khoá khách trước —
--    nếu không sẽ ra cảnh khách "Không mua" mà thẻ lại chạy trên bảng.
-- 6. Bàn giao khách: staff_handover_account viết cho thời còn hai pipeline nên
--    bắt buộc bắn chéo mảng và cấm quản trị gọi. Giờ một chuỗi trạng thái chung:
--    người phụ trách hoặc quản trị bàn giao cho bất kỳ nhân viên đang hoạt động
--    nào; cơ hội đang mở + việc chưa xong đi theo, hồ sơ đã đóng giữ chủ cũ để
--    lịch sử hoa hồng không đổi.
-- 7. Vệ sinh: thu EXECUTE của các hàm trigger khỏi anon/authenticated — Postgres
--    vốn không cho gọi hàm trigger qua RPC nhưng advisor cứ cảnh báo mãi.

-- ── 1. Báo cáo theo nhân viên ─────────────────────────────────────────────────
DROP VIEW IF EXISTS public.crm_staff_report;
CREATE VIEW public.crm_staff_report AS
SELECT
    p.id            AS staff_id,
    p.full_name     AS staff_name,
    p.email         AS staff_email,
    p.staff_segment,
    COALESCE(deals.won, 0)    AS deals_won,
    COALESCE(deals.open, 0)   AS deals_open,
    -- Tổng không tính dòng đã huỷ (khách trả máy trong thời gian dùng thử).
    COALESCE(comm.total, 0)   AS commission_total,
    COALESCE(comm.pending, 0) AS amount_pending,
    COALESCE(comm.payable, 0) AS amount_payable,
    COALESCE(comm.paid, 0)    AS amount_paid
FROM public.profiles p
LEFT JOIN (
    SELECT o.owner_id,
           count(*) FILTER (WHERE s.forecast = 'won')  AS won,
           count(*) FILTER (WHERE s.forecast = 'open') AS open
    FROM public.crm_opportunities o
    JOIN public.crm_stages s ON s.id = o.stage_id
    GROUP BY o.owner_id
) deals ON deals.owner_id = p.id
LEFT JOIN (
    SELECT c.staff_id,
           sum(c.amount) FILTER (WHERE c.status <> 'void')   AS total,
           sum(c.amount) FILTER (WHERE c.status = 'pending') AS pending,
           sum(c.amount) FILTER (WHERE c.status = 'payable') AS payable,
           sum(c.amount) FILTER (WHERE c.status = 'paid')    AS paid
    FROM public.crm_staff_commissions c
    GROUP BY c.staff_id
) comm ON comm.staff_id = p.id
WHERE p.role = 'staff'
  AND public.current_role() = 'admin';

GRANT SELECT ON public.crm_staff_report TO authenticated;

-- ── 2. Bảng cơ hội lộ thêm ghi chú ────────────────────────────────────────────
-- CREATE OR REPLACE cho phép nối cột vào cuối; các cột cũ giữ nguyên thứ tự.
CREATE OR REPLACE VIEW public.crm_opportunity_board
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.code,
    o.name,
    o.stage_id,
    s.name          AS stage_name,
    s.probability,
    s.forecast,
    s.sort_order,
    o.amount,
    o.quantity,
    o.trial_days,
    round(o.amount * cfg.staff_rate, 2) AS expected_commission,
    o.expected_close_date,
    o.owner_id,
    p.full_name     AS owner_name,
    o.account_id,
    a.name          AS account_name,
    a.phone         AS account_phone,
    a.kind          AS account_kind,
    o.contact_id,
    o.model_id,
    o.order_id,
    o.closed_at,
    o.lost_reason_id,
    lr.name         AS lost_reason_name,
    o.lost_notes,
    o.created_at,
    o.notes
FROM public.crm_opportunities o
JOIN public.crm_stages   s ON s.id = o.stage_id
CROSS JOIN public.crm_settings cfg
LEFT JOIN public.crm_accounts a ON a.id = o.account_id
LEFT JOIN public.profiles p ON p.id = o.owner_id
LEFT JOIN public.crm_lost_reasons lr ON lr.id = o.lost_reason_id;

GRANT SELECT ON public.crm_opportunity_board TO authenticated;

-- ── 3. Dòng thời gian hết dòng đôi ────────────────────────────────────────────
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
) t
WHERE crm_owner_visible(visible_owner)
ORDER BY at DESC NULLS LAST;

GRANT SELECT ON public.crm_account_timeline TO authenticated;

-- ── 4. Quản trị mở khoá được trạng thái cuối ─────────────────────────────────
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

    -- Quản trị được gỡ chốt sổ khi nhân viên bấm nhầm; nhật ký vẫn ghi ở
    -- trigger audit nên không mất dấu vết.
    IF public.current_role() = 'admin' THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Khách đã ở trạng thái "%" nên không đổi được nữa.', v_ten_cu
        USING ERRCODE = 'check_violation';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_account_stage_lock() FROM PUBLIC;

-- ── 5. Cơ hội đã đóng sổ chỉ quản trị mở lại, và mở khoá khách trước ─────────
CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_forecast     text;
    v_stage        text;
    v_old_forecast text;
    v_acc_forecast text;
    v_kind         text;
    v_org          text;
    v_dealer_unit  numeric(14,2);
    v_base_unit    numeric(14,2);
    v_floor        numeric(14,2);
    v_ceiling      numeric(14,2);
    v_min_disc     numeric(5,4);
BEGIN
    SELECT forecast, name INTO v_forecast, v_stage
    FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_forecast IS NULL THEN
        RAISE EXCEPTION 'crm_opportunities: stage_id % không tồn tại', NEW.stage_id;
    END IF;

    -- Thẻ đã thắng/thua là sổ đã gấp. Nhân viên không tự mở lại được; quản trị
    -- mở được nhưng phải gỡ chốt sổ của KHÁCH trước, nếu không bảng khách nói
    -- "Không mua" mà bảng cơ hội lại bày một thương vụ đang chạy.
    IF TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        SELECT forecast INTO v_old_forecast FROM public.crm_stages WHERE id = OLD.stage_id;
        IF v_old_forecast IN ('won', 'lost') THEN
            IF public.current_role() <> 'admin' THEN
                RAISE EXCEPTION 'Cơ hội đã đóng sổ, chỉ quản trị mới đổi được nữa.'
                    USING ERRCODE = 'check_violation';
            END IF;
            SELECT s.forecast INTO v_acc_forecast
              FROM public.crm_accounts a
              JOIN public.crm_stages s ON s.id = a.stage_id
             WHERE a.id = NEW.account_id;
            IF v_forecast = 'open' AND v_acc_forecast IN ('won', 'lost') THEN
                RAISE EXCEPTION 'Khách đang chốt sổ — đổi trạng thái khách sang bước đang mở trước, rồi mới mở lại cơ hội.'
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
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

-- ── 6. Bàn giao khách cho thời một chuỗi trạng thái chung ─────────────────────
ALTER TABLE public.crm_handovers DROP CONSTRAINT IF EXISTS crm_handovers_cross_segment;
ALTER TABLE public.crm_handovers ALTER COLUMN from_segment DROP NOT NULL;
ALTER TABLE public.crm_handovers ALTER COLUMN to_segment DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.staff_handover_account(
    p_account_id uuid,
    p_to_staff uuid,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_owner        uuid;
    v_from_segment text;
    v_to_segment   text;
    v_id           uuid;
BEGIN
    SELECT owner_id INTO v_owner FROM public.crm_accounts WHERE id = p_account_id;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy khách hàng %', p_account_id;
    END IF;

    IF public.current_role() <> 'admin' AND v_owner <> auth.uid() THEN
        RAISE EXCEPTION 'Chỉ người đang phụ trách hoặc quản trị mới bàn giao được khách';
    END IF;

    SELECT staff_segment INTO v_to_segment
      FROM public.profiles
     WHERE id = p_to_staff AND role = 'staff' AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Người nhận phải là nhân viên đang hoạt động';
    END IF;
    IF p_to_staff = v_owner THEN
        RAISE EXCEPTION 'Người nhận đang phụ trách khách này rồi';
    END IF;

    SELECT staff_segment INTO v_from_segment FROM public.profiles WHERE id = v_owner;

    INSERT INTO public.crm_handovers
        (account_id, from_staff_id, to_staff_id, from_segment, to_segment, note)
    VALUES (p_account_id, v_owner, p_to_staff, v_from_segment, v_to_segment, p_note)
    RETURNING id INTO v_id;

    UPDATE public.crm_accounts SET owner_id = p_to_staff WHERE id = p_account_id;
    UPDATE public.crm_contacts SET owner_id = p_to_staff WHERE account_id = p_account_id;
    -- Cơ hội đang mở và việc chưa xong đi theo người mới. Hồ sơ đã thắng/thua
    -- giữ chủ cũ: hoa hồng đã phát sinh phải ở lại với người làm ra nó.
    UPDATE public.crm_opportunities SET owner_id = p_to_staff
     WHERE account_id = p_account_id
       AND stage_id IN (SELECT id FROM public.crm_stages WHERE forecast = 'open');
    UPDATE public.crm_activities SET owner_id = p_to_staff
     WHERE account_id = p_account_id AND done_at IS NULL;

    PERFORM public.write_audit('crm_handover', 'crm_accounts', p_account_id,
        jsonb_build_object('owner_id', v_owner),
        jsonb_build_object('owner_id', p_to_staff, 'handover_id', v_id));

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) TO authenticated;

-- ── 7. Hàm trigger không phơi ra REST ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.crm_account_audit_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_account_default_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_account_kind_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_account_phone_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_account_stage_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_account_stage_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_accrue_staff_commission_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_audit_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_sync_account_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_set_account_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_set_account_created_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_void_staff_commission_on_voided() FROM PUBLIC, anon, authenticated;
