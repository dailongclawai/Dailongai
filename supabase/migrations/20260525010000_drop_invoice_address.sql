-- Drop invoice_address — not needed: Vietnam e-invoice can be issued from company name + tax code alone.

DROP FUNCTION IF EXISTS public.record_dealer_order(
    UUID, INT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_public_order(
    TEXT, UUID, INT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT);

ALTER TABLE public.orders DROP COLUMN IF EXISTS invoice_address;

CREATE OR REPLACE FUNCTION public.record_dealer_order(
    p_model_id             UUID,
    p_quantity             INT,
    p_customer_name        TEXT,
    p_customer_phone       TEXT,
    p_shipping_address     TEXT,
    p_sale_date            DATE    DEFAULT CURRENT_DATE,
    p_invoice_required     BOOLEAN DEFAULT FALSE,
    p_invoice_company_name TEXT    DEFAULT NULL,
    p_invoice_tax_code     TEXT    DEFAULT NULL,
    p_invoice_email        TEXT    DEFAULT NULL
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

    IF p_invoice_required THEN
        IF length(coalesce(trim(p_invoice_company_name), '')) < 2 THEN
            RAISE EXCEPTION 'Tên đơn vị xuất hoá đơn bắt buộc';
        END IF;
        IF p_invoice_tax_code !~ '^\d{10}(-\d{3})?$' THEN
            RAISE EXCEPTION 'Mã số thuế không hợp lệ (10 chữ số, có thể kèm -3 chữ số chi nhánh)';
        END IF;
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
        sale_price, quantity, shipping_address, sale_date, status,
        invoice_required, invoice_company_name, invoice_tax_code, invoice_email
    ) VALUES (
        v_dealer_id, p_model_id, v_customer, v_phone,
        v_total_price, p_quantity, v_address, p_sale_date, 'pending',
        p_invoice_required,
        CASE WHEN p_invoice_required THEN trim(p_invoice_company_name) END,
        CASE WHEN p_invoice_required THEN trim(p_invoice_tax_code) END,
        CASE WHEN p_invoice_required THEN trim(p_invoice_email) END
    )
    RETURNING id INTO v_order_id;

    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_dealer_order(
    UUID, INT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dealer_order(
    UUID, INT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_order(
    p_slug                 TEXT,
    p_model_id             UUID,
    p_quantity             INT,
    p_customer_name        TEXT,
    p_customer_phone       TEXT,
    p_shipping_address     TEXT,
    p_invoice_required     BOOLEAN DEFAULT FALSE,
    p_invoice_company_name TEXT    DEFAULT NULL,
    p_invoice_tax_code     TEXT    DEFAULT NULL,
    p_invoice_email        TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_dealer_id   UUID;
    v_order_id    UUID;
    v_unit_price  NUMERIC(12, 2);
    v_total_price NUMERIC(12, 2);
    v_customer    TEXT;
    v_phone       TEXT;
    v_address     TEXT;
BEGIN
    SELECT id INTO v_dealer_id
    FROM public.profiles
    WHERE order_slug = p_slug AND role = 'dealer';
    IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Mã đại lý không hợp lệ'; END IF;

    v_customer := trim(p_customer_name);
    v_phone    := trim(p_customer_phone);
    v_address  := trim(p_shipping_address);

    IF length(v_customer) < 2 THEN RAISE EXCEPTION 'Tên khách hàng bắt buộc'; END IF;
    IF length(v_phone) < 8    THEN RAISE EXCEPTION 'Số điện thoại không hợp lệ'; END IF;
    IF length(v_address) < 5  THEN RAISE EXCEPTION 'Địa chỉ giao hàng bắt buộc'; END IF;
    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 1000 THEN
        RAISE EXCEPTION 'Số lượng phải từ 1 tới 1000';
    END IF;

    IF p_invoice_required THEN
        IF length(coalesce(trim(p_invoice_company_name), '')) < 2 THEN
            RAISE EXCEPTION 'Tên đơn vị xuất hoá đơn bắt buộc';
        END IF;
        IF p_invoice_tax_code !~ '^\d{10}(-\d{3})?$' THEN
            RAISE EXCEPTION 'Mã số thuế không hợp lệ (10 chữ số, có thể kèm -3 chữ số chi nhánh)';
        END IF;
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
        sale_price, quantity, shipping_address, sale_date, status,
        invoice_required, invoice_company_name, invoice_tax_code, invoice_email
    ) VALUES (
        v_dealer_id, p_model_id, v_customer, v_phone,
        v_total_price, p_quantity, v_address, CURRENT_DATE, 'pending',
        p_invoice_required,
        CASE WHEN p_invoice_required THEN trim(p_invoice_company_name) END,
        CASE WHEN p_invoice_required THEN trim(p_invoice_tax_code) END,
        CASE WHEN p_invoice_required THEN trim(p_invoice_email) END
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.portal_messages
        (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
    VALUES (
        NULL, v_dealer_id,
        'Đơn mới qua QR · ' || v_customer,
        'Khách hàng ' || v_customer || ' (SĐT ' || v_phone || ') đặt ' || p_quantity || ' máy, ' ||
        'tổng ' || TO_CHAR(v_total_price, 'FM999,999,999,999') || ' đ. Giao đến: ' || v_address || '. ' ||
        CASE WHEN p_invoice_required
             THEN 'Khách yêu cầu xuất hoá đơn VAT (MST ' || trim(p_invoice_tax_code) || '). '
             ELSE '' END ||
        'Đơn đang chờ admin duyệt.',
        'order', 'info', '/portal/dealer/commission', 'Xem đơn'
    );

    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_order(
    TEXT, UUID, INT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_order(
    TEXT, UUID, INT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated;
