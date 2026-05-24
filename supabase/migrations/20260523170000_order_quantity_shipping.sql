-- Public order intake: quantity + shipping address, price computed server-side.
-- Serial number becomes optional (admin assigns after receiving hardware).

ALTER TABLE public.orders
    ADD COLUMN quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 1000),
    ADD COLUMN shipping_address TEXT;

-- Public-submitted orders won't have serial yet (assigned at fulfillment).
-- PostgreSQL UNIQUE still permits multiple NULLs.
ALTER TABLE public.orders ALTER COLUMN serial_number DROP NOT NULL;

-- ── Updated public order RPC: server computes sale_price ───────────────
CREATE OR REPLACE FUNCTION public.submit_public_order(
    p_slug             TEXT,
    p_model_id         UUID,
    p_quantity         INT,
    p_customer_name    TEXT,
    p_customer_phone   TEXT,
    p_shipping_address TEXT
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
        v_total_price, p_quantity, v_address, CURRENT_DATE, 'pending'
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.portal_messages
        (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
    VALUES (
        NULL, v_dealer_id,
        'Đơn mới qua QR · ' || v_customer,
        'Khách hàng ' || v_customer || ' (SĐT ' || v_phone || ') đặt ' || p_quantity || ' máy, ' ||
        'tổng ' || TO_CHAR(v_total_price, 'FM999,999,999,999') || ' đ. Giao đến: ' || v_address || '. ' ||
        'Đơn đang chờ admin duyệt.',
        'order', 'info', '/portal/dealer/commission', 'Xem đơn'
    );

    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_order(TEXT, UUID, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_order(TEXT, UUID, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Drop the previous signature (different parameter list) to avoid overload confusion.
DROP FUNCTION IF EXISTS public.submit_public_order(TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC);

-- ── Update order status notif body for null-serial case ───────────────
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_label TEXT;
BEGIN
    v_label := COALESCE('serial ' || NEW.serial_number, 'mã đơn ' || substring(NEW.id::text, 1, 8));
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NEW.approved_by, NEW.dealer_id,
            'Đơn hàng đã được duyệt ✓',
            'Đơn hàng ' || v_label || ' (' || NEW.quantity || ' máy, ' ||
            TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) đã được duyệt. ' ||
            'Hoa hồng sẽ được thanh toán trong kỳ tiếp theo.',
            'order', 'success',
            '/portal/dealer/commission', 'Xem hoa hồng'
        );
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NULL, NEW.dealer_id,
            'Đơn hàng bị từ chối',
            'Đơn hàng ' || v_label || ' bị từ chối' ||
            CASE WHEN NEW.rejection_reason IS NOT NULL
                 THEN ': ' || NEW.rejection_reason ELSE '.' END,
            'order', 'warning',
            '/portal/dealer/orders/' || NEW.id, 'Xem đơn hàng'
        );
    END IF;
    RETURN NEW;
END;
$$;
