-- Dealer logged-in order intake (matches public submit schema: quantity + shipping_address + server-side price)
-- Replaces the cart-based record_order_batch flow for the simplified UI.

CREATE OR REPLACE FUNCTION public.record_dealer_order(
    p_model_id         UUID,
    p_quantity         INT,
    p_customer_name    TEXT,
    p_customer_phone   TEXT,
    p_shipping_address TEXT,
    p_sale_date        DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_role        profile_role;
    v_dealer_id   UUID;
    v_order_id    UUID;
    v_unit_price  NUMERIC(12, 2);
    v_total_price NUMERIC(12, 2);
    v_customer    TEXT;
    v_phone       TEXT;
    v_address     TEXT;
BEGIN
    v_dealer_id := auth.uid();
    IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Không xác thực'; END IF;

    SELECT role INTO v_role FROM public.profiles WHERE id = v_dealer_id;
    IF v_role IS DISTINCT FROM 'dealer' THEN
        RAISE EXCEPTION 'record_dealer_order: chỉ đại lý mới được ghi đơn';
    END IF;

    v_customer := trim(p_customer_name);
    v_phone    := trim(p_customer_phone);
    v_address  := trim(p_shipping_address);

    IF length(v_customer) < 2 THEN RAISE EXCEPTION 'Tên khách hàng bắt buộc'; END IF;
    IF length(v_phone) < 8    THEN RAISE EXCEPTION 'Số điện thoại không hợp lệ'; END IF;
    IF length(v_address) < 5  THEN RAISE EXCEPTION 'Địa chỉ giao hàng bắt buộc'; END IF;
    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 1000 THEN
        RAISE EXCEPTION 'Số lượng phải từ 1 tới 1000';
    END IF;

    SELECT base_price INTO v_unit_price
    FROM public.product_models
    WHERE id = p_model_id AND active = TRUE;
    IF v_unit_price IS NULL THEN
        RAISE EXCEPTION 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh';
    END IF;

    v_total_price := v_unit_price * p_quantity;

    INSERT INTO public.orders (
        dealer_id, model_id, customer_name, customer_phone,
        sale_price, quantity, shipping_address, sale_date, status
    ) VALUES (
        v_dealer_id, p_model_id, v_customer, v_phone,
        v_total_price, p_quantity, v_address, p_sale_date, 'pending'
    )
    RETURNING id INTO v_order_id;

    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_dealer_order(UUID, INT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dealer_order(UUID, INT, TEXT, TEXT, TEXT, DATE) TO authenticated;
