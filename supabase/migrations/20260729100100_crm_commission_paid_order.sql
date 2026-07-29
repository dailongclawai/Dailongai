-- Hoa hồng staff: 10% giá trị đơn hàng, phát sinh khi khách ĐÃ THANH TOÁN.
--
-- Boss chốt 29/07/2026:
--   • bỏ "giá cơ sở" cố định 15 triệu — tính thẳng trên giá trị đơn thật
--   • một mức 10% cho mọi nhân viên, không chia B2C/B2B
--   • chỉ tính khi đơn hoàn thành và khách đã thanh toán
--   • bỏ hẳn thưởng bắn khách chéo (chức năng chuyển khách vẫn còn, chỉ không kèm tiền)
--
-- Vì mốc phát sinh chuyển từ "kéo cơ hội sang thắng" xuống "đơn chuyển sang paid",
-- trigger chuyển từ crm_opportunities sang orders. Dòng hoa hồng sinh ra đã ở
-- trạng thái payable luôn: khách trả tiền rồi thì không còn gì để admin duyệt nữa,
-- admin chỉ còn việc chi và ghi mã chuyển khoản.
--
-- An toàn: production có 0 dòng hoa hồng lúc chạy migration này.

-- 1. Cấu hình: một mức duy nhất
ALTER TABLE public.crm_settings DROP COLUMN IF EXISTS base_price;
ALTER TABLE public.crm_settings DROP COLUMN IF EXISTS staff_rate_b2c;
ALTER TABLE public.crm_settings DROP COLUMN IF EXISTS staff_rate_b2b;
ALTER TABLE public.crm_settings DROP COLUMN IF EXISTS crossover_bonus_rate;
ALTER TABLE public.crm_settings
    ADD COLUMN IF NOT EXISTS staff_rate numeric(5,4) NOT NULL DEFAULT 0.1000
        CHECK (staff_rate > 0 AND staff_rate <= 1);
INSERT INTO public.crm_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 2. Bảng hoa hồng: cơ sở tính là giá trị đơn, không còn vai trò referrer
DROP TRIGGER IF EXISTS crm_opportunities_accrue_commission ON public.crm_opportunities;
DROP FUNCTION IF EXISTS public.crm_opportunity_accrue_commission();

-- Báo cáo admin đang đọc role_in_deal nên phải gỡ trước, dựng lại ở mục 5.
DROP VIEW IF EXISTS public.crm_staff_report;

DELETE FROM public.crm_staff_commissions WHERE role_in_deal = 'referrer';
ALTER TABLE public.crm_staff_commissions DROP CONSTRAINT IF EXISTS crm_staff_commissions_role_in_deal_check;
ALTER TABLE public.crm_staff_commissions DROP COLUMN IF EXISTS role_in_deal;
ALTER TABLE public.crm_staff_commissions DROP COLUMN IF EXISTS handover_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='crm_staff_commissions' AND column_name='base_price'
    ) THEN
        ALTER TABLE public.crm_staff_commissions RENAME COLUMN base_price TO order_value;
    END IF;
END $$;

ALTER TABLE public.crm_staff_commissions DROP CONSTRAINT IF EXISTS crm_staff_commissions_base_price_check;
ALTER TABLE public.crm_staff_commissions
    ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE public.crm_staff_commissions
    DROP CONSTRAINT IF EXISTS crm_staff_commissions_opportunity_id_staff_id_role_in_deal_key;
ALTER TABLE public.crm_staff_commissions
    ADD CONSTRAINT crm_staff_commissions_opportunity_staff_key UNIQUE (opportunity_id, staff_id);

-- 3. Phát sinh hoa hồng khi đơn chuyển sang đã thanh toán
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

    -- Cơ hội nào đang gắn với đơn này. Không gắn thì không có hoa hồng CRM.
    SELECT * INTO v_opp
      FROM public.crm_opportunities
     WHERE order_id = NEW.id
     ORDER BY created_at
     LIMIT 1;
    IF v_opp.id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_owner_role FROM public.profiles WHERE id = v_opp.owner_id;
    IF v_owner_role <> 'staff' THEN
        RETURN NEW;   -- admin tự chốt hộ thì không phát sinh hoa hồng
    END IF;

    SELECT staff_rate INTO v_rate FROM public.crm_settings WHERE id;

    -- Chốt cứng giá trị đơn và tỉ lệ vào từng dòng: đổi cấu hình sau này KHÔNG
    -- viết lại số tiền đã ghi nhận.
    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, order_id, order_value, rate, amount, status)
    VALUES (v_opp.id, v_opp.owner_id, NEW.id, NEW.sale_price, v_rate,
            round(NEW.sale_price * v_rate, 2), 'payable')
    ON CONFLICT (opportunity_id, staff_id) DO NOTHING;

    -- Đẩy cơ hội sang giai đoạn hoàn thành để bảng trạng thái không lệch với đơn.
    SELECT id INTO v_won_stage
      FROM public.crm_stages WHERE forecast = 'won' AND active ORDER BY sort_order LIMIT 1;
    IF v_won_stage IS NOT NULL AND v_opp.stage_id IS DISTINCT FROM v_won_stage THEN
        UPDATE public.crm_opportunities SET stage_id = v_won_stage WHERE id = v_opp.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_accrue_staff_commission ON public.orders;
CREATE TRIGGER orders_accrue_staff_commission
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.crm_accrue_staff_commission_on_paid();

-- 4. Không còn bước duyệt riêng: khách trả tiền là dòng hoa hồng đã payable
DROP FUNCTION IF EXISTS public.admin_confirm_staff_deal(uuid, uuid);

-- 5. Báo cáo admin: bỏ cột thưởng chuyển khách
CREATE OR REPLACE VIEW public.crm_staff_report AS
SELECT
    p.id                                     AS staff_id,
    p.full_name                              AS staff_name,
    p.email                                  AS staff_email,
    p.staff_segment,
    count(DISTINCT o.id) FILTER (WHERE s.forecast = 'won')   AS deals_won,
    count(DISTINCT o.id) FILTER (WHERE s.forecast = 'open')  AS deals_open,
    coalesce(sum(c.amount), 0)                                     AS commission_total,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'payable'), 0) AS amount_payable,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'paid'), 0)    AS amount_paid
FROM public.profiles p
LEFT JOIN public.crm_opportunities o ON o.owner_id = p.id
LEFT JOIN public.crm_stages s ON s.id = o.stage_id
LEFT JOIN public.crm_staff_commissions c ON c.staff_id = p.id
WHERE p.role = 'staff'
  AND public.current_role() = 'admin'
GROUP BY p.id, p.full_name, p.email, p.staff_segment;

GRANT SELECT ON public.crm_staff_report TO authenticated;

-- 6. Trạng thái khách hàng, suy từ giai đoạn cơ hội mới nhất và đơn hàng của nó.
-- SECURITY DEFINER vì nhân viên kinh doanh không có quyền đọc bảng orders; hàm
-- chỉ trả về đúng một nhãn chữ, không lộ thêm gì của đơn.
CREATE OR REPLACE FUNCTION public.crm_account_status(p_account_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT CASE ord.status
                    WHEN 'paid'     THEN 'Hoàn thành đơn'
                    WHEN 'approved' THEN 'Đã duyệt đơn'
                    WHEN 'pending'  THEN 'Chờ duyệt đơn'
                    WHEN 'rejected' THEN 'Đơn bị từ chối'
                    WHEN 'voided'   THEN 'Đơn đã huỷ'
                END
           FROM public.crm_opportunities o
           JOIN public.orders ord ON ord.id = o.order_id
          WHERE o.account_id = p_account_id
          ORDER BY o.created_at DESC
          LIMIT 1),
        (SELECT s.name
           FROM public.crm_opportunities o
           JOIN public.crm_stages s ON s.id = o.stage_id
          WHERE o.account_id = p_account_id
          ORDER BY o.created_at DESC
          LIMIT 1),
        'Chưa có cơ hội'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.crm_account_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_account_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_account_status(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_accrue_staff_commission_on_paid() FROM PUBLIC;
