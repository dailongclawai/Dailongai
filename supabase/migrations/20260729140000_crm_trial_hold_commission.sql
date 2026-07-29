-- Hoa hồng dự kiến và giữ hoa hồng trong thời gian khách dùng thử.
--
-- Boss chốt 29/07/2026:
--   • Từ lúc nhân viên bắt đầu theo khách, CRM phải hiện số máy khách đặt và số
--     tiền hoa hồng dự kiến.
--   • Chốt deal xong thì hoa hồng tự cộng cho nhân viên.
--   • Nếu khách dùng thử 30 ngày thì phải hết 30 ngày mà khách KHÔNG trả lại máy,
--     nhân viên mới được nhận.
--
-- Vì vậy trạng thái `pending` có lại ý nghĩa thật: đang chờ hết hạn dùng thử.
-- Không dùng pg_cron (production chưa bật extension này) — điều kiện chi được
-- tính lúc đọc qua eligible_at, nên đúng kể cả khi không bộ hẹn giờ nào chạy.
-- Kèm một RPC để cron bên ngoài gọi cho danh sách gọn gàng.

ALTER TABLE public.crm_opportunities
    ADD COLUMN IF NOT EXISTS trial_days smallint
        CHECK (trial_days IS NULL OR (trial_days > 0 AND trial_days <= 365));

COMMENT ON COLUMN public.crm_opportunities.trial_days IS
    'Số ngày khách dùng thử. NULL nghĩa là bán đứt, hoa hồng chi ngay khi thanh toán.';

ALTER TABLE public.crm_staff_commissions
    ADD COLUMN IF NOT EXISTS eligible_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.crm_staff_commissions.eligible_at IS
    'Mốc đủ điều kiện chi. Bán đứt thì bằng lúc thanh toán; có dùng thử thì cộng thêm số ngày thử.';

-- Khách thanh toán: ghi hoa hồng, nhưng giữ lại nếu đang trong thời gian dùng thử.
CREATE OR REPLACE FUNCTION public.crm_accrue_staff_commission_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_opp         public.crm_opportunities;
    v_owner_role  public.profile_role;
    v_rate        numeric(5,4);
    v_won_stage   uuid;
    v_eligible_at timestamptz;
    v_status      text;
BEGIN
    IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_opp
      FROM public.crm_opportunities
     WHERE order_id = NEW.id
     ORDER BY created_at
     LIMIT 1;
    IF v_opp.id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_won_stage
      FROM public.crm_stages WHERE forecast = 'won' AND active ORDER BY sort_order LIMIT 1;

    IF v_won_stage IS NOT NULL THEN
        IF v_opp.stage_id IS DISTINCT FROM v_won_stage THEN
            UPDATE public.crm_opportunities SET stage_id = v_won_stage WHERE id = v_opp.id;
        END IF;
        UPDATE public.crm_accounts
           SET stage_id = v_won_stage
         WHERE id = v_opp.account_id AND stage_id IS DISTINCT FROM v_won_stage;
    END IF;

    SELECT role INTO v_owner_role FROM public.profiles WHERE id = v_opp.owner_id;
    IF v_owner_role <> 'staff' THEN
        RETURN NEW;   -- admin tự chốt hộ thì không phát sinh hoa hồng
    END IF;

    SELECT staff_rate INTO v_rate FROM public.crm_settings WHERE id;

    -- Có dùng thử thì treo lại tới khi hết hạn; không thì chi được ngay.
    IF v_opp.trial_days IS NULL THEN
        v_eligible_at := now();
        v_status := 'payable';
    ELSE
        v_eligible_at := now() + (v_opp.trial_days || ' days')::interval;
        v_status := 'pending';
    END IF;

    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, order_id, order_value, rate, amount, status, eligible_at)
    VALUES (v_opp.id, v_opp.owner_id, NEW.id, NEW.sale_price, v_rate,
            round(NEW.sale_price * v_rate, 2), v_status, v_eligible_at)
    ON CONFLICT (opportunity_id, staff_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Khách trả lại máy trong thời gian dùng thử → đơn bị huỷ → hoa hồng mất theo.
CREATE OR REPLACE FUNCTION public.crm_void_staff_commission_on_voided()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.status <> 'voided' OR OLD.status = 'voided' THEN
        RETURN NEW;
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'void'
     WHERE order_id = NEW.id
       AND status IN ('pending', 'payable');   -- đã chi rồi thì không đòi lại ở đây

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_void_staff_commission ON public.orders;
CREATE TRIGGER orders_void_staff_commission
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.crm_void_staff_commission_on_voided();

-- Chuyển những dòng đã hết hạn dùng thử sang payable. Dành cho cron bên ngoài
-- gọi hằng ngày; không gọi cũng không sai vì hàm chi đã tự soát eligible_at.
CREATE OR REPLACE FUNCTION public.crm_release_due_commissions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được giải phóng hoa hồng đã hết hạn dùng thử';
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'payable'
     WHERE status = 'pending' AND eligible_at <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.write_audit('release_due_commissions', 'crm_staff_commissions', NULL,
        NULL, jsonb_build_object('rows', v_count));
    RETURN v_count;
END;
$$;

-- Cho chi cả dòng còn `pending` nhưng đã qua mốc, để không phụ thuộc vào cron.
CREATE OR REPLACE FUNCTION public.admin_pay_staff_commission(
    p_commission_id uuid,
    p_payment_ref text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.crm_staff_commissions;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được chi hoa hồng staff';
    END IF;

    SELECT * INTO v_row FROM public.crm_staff_commissions WHERE id = p_commission_id;
    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy dòng hoa hồng %', p_commission_id;
    END IF;

    IF v_row.status = 'pending' AND v_row.eligible_at > now() THEN
        RAISE EXCEPTION 'Khách còn trong thời gian dùng thử tới %, chưa chi được',
            to_char(v_row.eligible_at, 'DD/MM/YYYY');
    END IF;
    IF v_row.status NOT IN ('payable', 'pending') THEN
        RAISE EXCEPTION 'Chỉ chi được dòng chưa chi, hiện tại %', v_row.status;
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'paid', paid_at = now(), payment_ref = p_payment_ref
     WHERE id = p_commission_id;

    PERFORM public.write_audit('pay_staff_commission', 'crm_staff_commissions', p_commission_id,
        jsonb_build_object('status', v_row.status, 'amount', v_row.amount),
        jsonb_build_object('status', 'paid', 'payment_ref', p_payment_ref));
END;
$$;

-- Bảng kanban hiện số máy và hoa hồng dự kiến ngay từ lúc bắt đầu theo khách.
DROP VIEW IF EXISTS public.crm_opportunity_board;
CREATE VIEW public.crm_opportunity_board
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
    o.created_at
FROM public.crm_opportunities o
JOIN public.crm_stages   s ON s.id = o.stage_id
CROSS JOIN public.crm_settings cfg
LEFT JOIN public.crm_accounts a ON a.id = o.account_id
LEFT JOIN public.profiles p ON p.id = o.owner_id
LEFT JOIN public.crm_lost_reasons lr ON lr.id = o.lost_reason_id;

GRANT SELECT ON public.crm_opportunity_board TO authenticated;

REVOKE EXECUTE ON FUNCTION public.crm_void_staff_commission_on_voided() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_release_due_commissions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_release_due_commissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_release_due_commissions() TO authenticated;
