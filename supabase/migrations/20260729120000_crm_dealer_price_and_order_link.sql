-- Hai việc Boss chốt 29/07/2026.
--
-- 1) Đại lý và bán lẻ chỉ khác tên, hoa hồng nhân viên vẫn 10% giá trị đơn.
--    Khác biệt duy nhất: bán cho đại lý được giá thấp hơn giá niêm yết. Vì vậy
--    product_models có thêm dealer_price, KHÔNG tách phễu và KHÔNG đổi công thức
--    hoa hồng. Để trống thì đại lý mua bằng giá niêm yết.
--
-- 2) Gắn đơn hàng vào cơ hội. Đây là mắt xích còn thiếu: hoa hồng chỉ phát sinh
--    khi đơn `paid` được nối vào cơ hội, mà trước giờ không có đường nào để nối.
--    Nhân viên kinh doanh KHÔNG có quyền đọc bảng orders (RLS chặn), nên phải đi
--    qua hai hàm SECURITY DEFINER trả về đúng phần tối thiểu.

ALTER TABLE public.product_models
    ADD COLUMN IF NOT EXISTS dealer_price numeric(14,2)
        CHECK (dealer_price IS NULL OR dealer_price > 0);

COMMENT ON COLUMN public.product_models.dealer_price IS
    'Giá bán cho đại lý. NULL nghĩa là đại lý mua bằng base_price.';

-- Đơn hàng có thể gắn cho một khách: chưa cơ hội nào nhận, và ưu tiên đơn trùng
-- số điện thoại của khách để nhân viên khỏi phải dò.
CREATE OR REPLACE FUNCTION public.crm_orders_for_account(p_account_id uuid)
RETURNS TABLE (
    order_id      uuid,
    serial_number text,
    customer_name text,
    sale_price    numeric,
    sale_date     date,
    status        text,
    phone_matches boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_phone text;
BEGIN
    IF public.current_role() NOT IN ('staff', 'admin') THEN
        RAISE EXCEPTION 'Chỉ nhân viên kinh doanh và quản trị được tra cứu đơn hàng';
    END IF;

    SELECT public.crm_normalize_phone(a.phone) INTO v_phone
      FROM public.crm_accounts a WHERE a.id = p_account_id;

    RETURN QUERY
    SELECT o.id, o.serial_number, o.customer_name, o.sale_price, o.sale_date,
           o.status::text,
           v_phone IS NOT NULL AND public.crm_normalize_phone(o.customer_phone) = v_phone
      FROM public.orders o
     WHERE o.status <> 'voided'
       AND NOT EXISTS (
           SELECT 1 FROM public.crm_opportunities c WHERE c.order_id = o.id
       )
     ORDER BY (v_phone IS NOT NULL AND public.crm_normalize_phone(o.customer_phone) = v_phone) DESC,
              o.sale_date DESC
     LIMIT 100;
END;
$$;

-- Gắn (hoặc gỡ khi truyền NULL). Chỉ chủ cơ hội hoặc admin được làm.
CREATE OR REPLACE FUNCTION public.crm_link_order(p_opportunity_id uuid, p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_owner uuid;
BEGIN
    SELECT owner_id INTO v_owner FROM public.crm_opportunities WHERE id = p_opportunity_id;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Cơ hội không tồn tại';
    END IF;
    IF v_owner <> auth.uid() AND public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ người phụ trách cơ hội hoặc quản trị được gắn đơn hàng';
    END IF;

    IF p_order_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
            RAISE EXCEPTION 'Đơn hàng không tồn tại';
        END IF;
        -- Một đơn chỉ thuộc về một cơ hội, nếu không hai người cùng ăn hoa hồng.
        IF EXISTS (
            SELECT 1 FROM public.crm_opportunities
             WHERE order_id = p_order_id AND id <> p_opportunity_id
        ) THEN
            RAISE EXCEPTION 'Đơn hàng này đã được gắn vào một cơ hội khác';
        END IF;
    END IF;

    UPDATE public.crm_opportunities SET order_id = p_order_id WHERE id = p_opportunity_id;

    PERFORM public.write_audit('crm_link_order', 'crm_opportunities', p_opportunity_id,
        NULL, jsonb_build_object('order_id', p_order_id));
END;
$$;

-- Một đơn chỉ được gắn vào đúng một cơ hội — chốt ở tầng dữ liệu, không chỉ ở RPC.
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_opportunities_order_unique
    ON public.crm_opportunities(order_id) WHERE order_id IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.crm_orders_for_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_orders_for_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_orders_for_account(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_link_order(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_link_order(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_link_order(uuid, uuid) TO authenticated;
