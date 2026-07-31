-- Bịt khoảng trống quanh giá bán.
--
-- Boss hỏi 01/08/2026: làm sao để không có kẽ hở bán giá lẻ rồi khai giá đại lý.
-- Soi ra: nhân viên kinh doanh vốn không đụng được bảng orders, nhưng ĐẠI LÝ
-- thì có. Chính sách orders_dealer_insert_own chỉ kiểm người đặt và trạng thái,
-- không kiểm giá; thử trên máy nội bộ với vai trò `authenticated` và claim đúng
-- uid đại lý thì ghi lọt một đơn 1.000đ cho máy niêm yết 80.000.000đ.
--
-- Ba chốt trong migration này:
--   1. Giá đơn hàng phải đúng bảng giá, ai ghi đường nào cũng bị soát.
--   2. Đổi loại khách (lẻ ↔ đại lý) để lại dấu vết trong nhật ký kiểm toán.
--   3. Một khung nhìn đối soát cho quản trị: cơ hội thắng chưa gắn đơn, và đơn
--      có giá lệch bảng giá.

-- ── 1. Chốt giá đơn hàng ─────────────────────────────────────────────────────
-- Chặn ở tầng dữ liệu chứ không ở giao diện: portal là bản tĩnh, trình duyệt
-- gọi thẳng PostgREST nên ràng buộc về tiền phải nằm dưới đây.
CREATE OR REPLACE FUNCTION public.orders_price_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_unit     numeric(12,2);
    v_expected numeric(12,2);
BEGIN
    -- Duyệt đơn, đổi trạng thái, gắn ảnh chứng từ… thì không soát lại giá.
    IF TG_OP = 'UPDATE'
       AND NEW.sale_price IS NOT DISTINCT FROM OLD.sale_price
       AND NEW.model_id   IS NOT DISTINCT FROM OLD.model_id
       AND NEW.quantity   IS NOT DISTINCT FROM OLD.quantity THEN
        RETURN NEW;
    END IF;

    -- Tiến trình máy chủ (webhook thanh toán, cron, đơn từ trang công khai)
    -- không có phiên đăng nhập. Quản trị thì được đặt giá tay khi có thoả thuận
    -- riêng — vẫn hiện trong báo cáo đối soát bên dưới.
    IF auth.uid() IS NULL OR public.current_role() = 'admin' THEN
        RETURN NEW;
    END IF;

    SELECT base_price INTO v_unit FROM public.product_models WHERE id = NEW.model_id;
    IF v_unit IS NULL THEN
        RAISE EXCEPTION 'Đơn hàng: sản phẩm không tồn tại';
    END IF;

    v_expected := v_unit * COALESCE(NEW.quantity, 1);
    IF NEW.sale_price <> v_expected THEN
        RAISE EXCEPTION
            'Giá đơn hàng phải đúng bảng giá: % đ (% máy × % đ)',
            to_char(v_expected, 'FM999,999,999,999'),
            COALESCE(NEW.quantity, 1),
            to_char(v_unit, 'FM999,999,999,999');
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.orders_price_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS orders_price_guard ON public.orders;
CREATE TRIGGER orders_price_guard
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_price_guard();

-- ── 2. Nhật ký khi đổi loại khách ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_account_kind_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.write_audit(
        'crm_account_kind_change',
        'crm_accounts',
        NEW.id,
        jsonb_build_object('kind', OLD.kind, 'name', OLD.name),
        jsonb_build_object('kind', NEW.kind, 'name', NEW.name)
    );
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_account_kind_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_accounts_kind_audit ON public.crm_accounts;
CREATE TRIGGER crm_accounts_kind_audit
AFTER UPDATE OF kind ON public.crm_accounts
FOR EACH ROW
WHEN (OLD.kind IS DISTINCT FROM NEW.kind)
EXECUTE FUNCTION public.crm_account_kind_audit();

-- ── 3. Đối soát cho quản trị ─────────────────────────────────────────────────
-- Cùng cách chặn với crm_staff_report: KHÔNG security_invoker, tự lọc bằng
-- current_role() trong thân khung nhìn nên chỉ quản trị đọc ra dòng nào.
DROP VIEW IF EXISTS public.crm_recon_issues;
CREATE VIEW public.crm_recon_issues AS
SELECT * FROM (
    -- Cơ hội đã thắng nhưng chưa gắn đơn hàng nào: dấu hiệu bán ngoài sổ.
    SELECT
        'won_no_order'::text                        AS issue,
        o.id                                        AS ref_id,
        o.code                                      AS ref_code,
        o.name                                      AS title,
        a.name                                      AS party_name,
        COALESCE(d.full_name, d.email)              AS who,
        o.amount                                    AS amount,
        NULL::numeric                               AS expected_amount,
        o.closed_at                                 AS at
    FROM public.crm_opportunities o
    JOIN public.crm_stages s        ON s.id = o.stage_id AND s.forecast = 'won'
    LEFT JOIN public.crm_accounts a ON a.id = o.account_id
    LEFT JOIN public.crm_staff_directory d ON d.id = o.owner_id
    WHERE o.order_id IS NULL

    UNION ALL

    -- Đơn ghi giá lệch bảng giá: từ nay chỉ quản trị mới tạo ra được, nhưng vẫn
    -- phải hiện ra để còn soi lại.
    SELECT
        'price_mismatch',
        ord.id,
        ord.serial_number,
        m.name,
        ord.customer_name,
        COALESCE(p.full_name, p.email),
        ord.sale_price,
        m.base_price * ord.quantity,
        ord.created_at
    FROM public.orders ord
    JOIN public.product_models m ON m.id = ord.model_id
    LEFT JOIN public.profiles p  ON p.id = ord.dealer_id
    WHERE ord.sale_price <> m.base_price * ord.quantity
) x
WHERE public.current_role() = 'admin'
ORDER BY at DESC NULLS LAST;

GRANT SELECT ON public.crm_recon_issues TO authenticated;
