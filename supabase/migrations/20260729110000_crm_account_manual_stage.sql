-- Trạng thái khách hàng do nhân viên tự chọn.
--
-- Boss chốt 29/07/2026 (sau khi xem bản suy tự động): nhân viên phải được tự do
-- chọn khách đang ở giai đoạn nào, không phải chờ tạo cơ hội mới có trạng thái.
--
-- Vì vậy crm_accounts có cột stage_id riêng, trỏ vào cùng danh mục giai đoạn với
-- cơ hội. Khách mới nhập mặc định ở giai đoạn đầu chuỗi.

ALTER TABLE public.crm_accounts
    ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.crm_stages(id);

-- Khách đã có sẵn: đặt về giai đoạn đầu để không dòng nào trống trạng thái.
UPDATE public.crm_accounts
   SET stage_id = (SELECT id FROM public.crm_stages WHERE active ORDER BY sort_order LIMIT 1)
 WHERE stage_id IS NULL;

CREATE OR REPLACE FUNCTION public.crm_account_default_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.stage_id IS NULL THEN
        SELECT id INTO NEW.stage_id
          FROM public.crm_stages WHERE active ORDER BY sort_order LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_accounts_default_stage ON public.crm_accounts;
CREATE TRIGGER crm_accounts_default_stage
BEFORE INSERT ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.crm_account_default_stage();

-- Trạng thái giờ đọc thẳng lựa chọn của nhân viên, không suy từ cơ hội nữa.
-- Giữ nguyên chữ ký hàm để view crm_account_list không phải dựng lại.
CREATE OR REPLACE FUNCTION public.crm_account_status(p_account_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT s.name
           FROM public.crm_accounts a
           JOIN public.crm_stages s ON s.id = a.stage_id
          WHERE a.id = p_account_id),
        'Mới tiếp nhận'
    );
$$;

-- Khách thanh toán xong thì đẩy luôn trạng thái khách sang giai đoạn hoàn thành.
-- Đây là mốc có thật từ bảng đơn hàng, không phải phỏng đoán; nhân viên vẫn đổi
-- lại được nếu cần.
CREATE OR REPLACE FUNCTION public.crm_accrue_staff_commission_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_opp        public.crm_opportunities;
    v_owner_role public.profile_role;
    v_rate       numeric(5,4);
    v_won_stage  uuid;
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

    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, order_id, order_value, rate, amount, status)
    VALUES (v_opp.id, v_opp.owner_id, NEW.id, NEW.sale_price, v_rate,
            round(NEW.sale_price * v_rate, 2), 'payable')
    ON CONFLICT (opportunity_id, staff_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Bổ sung stage_id vào danh sách để giao diện dựng được ô chọn.
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
    public.crm_account_status(a.id) AS status_label,
    a.stage_id
FROM public.crm_accounts a
LEFT JOIN public.crm_staff_directory o ON o.id = a.owner_id
LEFT JOIN public.crm_staff_directory c ON c.id = a.created_by;

GRANT SELECT ON public.crm_account_list TO authenticated;

REVOKE EXECUTE ON FUNCTION public.crm_account_default_stage() FROM PUBLIC;
