-- Public order intake via per-dealer QR slug.
-- URL: dailongai.com/dat-don/<slug> → public form → INSERT order with dealer_id resolved from slug.

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.profiles ADD COLUMN order_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS profiles_order_slug_idx ON public.profiles (order_slug) WHERE order_slug IS NOT NULL;

-- ── Slug generator: unaccent + slugify + 4-char suffix ─────────────────
CREATE OR REPLACE FUNCTION public.gen_dealer_order_slug(p_name TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_base TEXT;
    v_suffix TEXT;
    v_slug TEXT;
    v_try INT := 0;
BEGIN
    v_base := lower(
        regexp_replace(
            unaccent(coalesce(p_name, 'dai-ly')),
            '[^a-z0-9]+', '-', 'gi'
        )
    );
    v_base := trim(both '-' from v_base);
    IF v_base = '' THEN v_base := 'dai-ly'; END IF;
    IF length(v_base) > 40 THEN v_base := substring(v_base, 1, 40); END IF;

    LOOP
        v_suffix := lower(substring(md5(random()::text || clock_timestamp()::text), 1, 4));
        v_slug := v_base || '-' || v_suffix;
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE order_slug = v_slug) THEN
            RETURN v_slug;
        END IF;
        v_try := v_try + 1;
        IF v_try > 10 THEN
            RETURN v_base || '-' || encode(gen_random_bytes(4), 'hex');
        END IF;
    END LOOP;
END;
$$;

-- ── Backfill existing dealers ──────────────────────────────────────────
UPDATE public.profiles
   SET order_slug = public.gen_dealer_order_slug(full_name)
 WHERE role = 'dealer' AND order_slug IS NULL;

-- ── Trigger: auto-gen slug for new/promoted dealers ───────────────────
CREATE OR REPLACE FUNCTION public.set_order_slug_on_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF NEW.role = 'dealer' AND NEW.order_slug IS NULL THEN
        NEW.order_slug := public.gen_dealer_order_slug(NEW.full_name);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_order_slug ON public.profiles;
CREATE TRIGGER trg_profiles_set_order_slug
BEFORE INSERT OR UPDATE OF role, full_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_order_slug_on_profile();

-- ── Public RPC: resolve slug → dealer name (no PII beyond name) ───────
CREATE OR REPLACE FUNCTION public.get_public_dealer_info(p_slug TEXT)
RETURNS TABLE (dealer_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT p.full_name
    FROM public.profiles p
    WHERE p.order_slug = p_slug AND p.role = 'dealer';
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_dealer_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_dealer_info(TEXT) TO anon, authenticated;

-- ── Public RPC: list active product models for the form ───────────────
CREATE OR REPLACE FUNCTION public.get_public_active_models()
RETURNS TABLE (id UUID, code TEXT, name TEXT, base_price NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.code, m.name, m.base_price
    FROM public.product_models m
    WHERE m.active = TRUE
    ORDER BY m.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_active_models() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_active_models() TO anon, authenticated;

-- ── Public RPC: submit order via slug ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_public_order(
    p_slug          TEXT,
    p_model_id      UUID,
    p_serial_number TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_sale_price    NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_dealer_id UUID;
    v_dealer_name TEXT;
    v_order_id UUID;
    v_serial TEXT;
    v_customer TEXT;
    v_phone TEXT;
BEGIN
    SELECT id, full_name INTO v_dealer_id, v_dealer_name
    FROM public.profiles
    WHERE order_slug = p_slug AND role = 'dealer';

    IF v_dealer_id IS NULL THEN
        RAISE EXCEPTION 'Mã đại lý không hợp lệ';
    END IF;

    v_serial   := trim(p_serial_number);
    v_customer := trim(p_customer_name);
    v_phone    := trim(p_customer_phone);

    IF length(v_customer) < 2  THEN RAISE EXCEPTION 'Tên khách hàng bắt buộc (tối thiểu 2 ký tự)'; END IF;
    IF length(v_phone) < 8     THEN RAISE EXCEPTION 'Số điện thoại không hợp lệ'; END IF;
    IF length(v_serial) < 3    THEN RAISE EXCEPTION 'Số serial bắt buộc'; END IF;
    IF p_sale_price IS NULL OR p_sale_price <= 0 THEN
        RAISE EXCEPTION 'Giá bán không hợp lệ';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.product_models WHERE id = p_model_id AND active = TRUE) THEN
        RAISE EXCEPTION 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh';
    END IF;

    INSERT INTO public.orders (
        dealer_id, model_id, serial_number, customer_name, customer_phone,
        sale_price, sale_date, status
    ) VALUES (
        v_dealer_id, p_model_id, v_serial, v_customer, v_phone,
        p_sale_price, CURRENT_DATE, 'pending'
    )
    RETURNING id INTO v_order_id;

    -- Notify dealer they have a new order via QR
    INSERT INTO public.portal_messages
        (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
    VALUES (
        NULL, v_dealer_id,
        'Đơn mới qua QR · ' || v_customer,
        'Khách hàng ' || v_customer || ' (SĐT ' || v_phone || ') vừa quét QR đặt đơn serial ' || v_serial ||
        ' với giá ' || TO_CHAR(p_sale_price, 'FM999,999,999,999') || ' đ. Đơn đang chờ admin duyệt.',
        'order', 'info',
        '/portal/dealer/commission', 'Xem đơn'
    );

    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_order(TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_order(TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC) TO anon, authenticated;
