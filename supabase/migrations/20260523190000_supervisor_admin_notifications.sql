-- Notifications for supervisor + admin on order create/approve/reject.
-- Also disable auto-calc of supervisor commission (kế toán nhập tay).

-- ── 1. Order INSERT → notify supervisor of dealer + all admins ──────────
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_supervisor_id UUID;
    v_dealer_name   TEXT;
    v_admin_id      UUID;
    v_label         TEXT;
    v_amount        TEXT;
BEGIN
    SELECT supervisor_id, COALESCE(full_name, 'đại lý')
      INTO v_supervisor_id, v_dealer_name
      FROM public.profiles WHERE id = NEW.dealer_id;

    v_label  := COALESCE('serial ' || NEW.serial_number, 'mã đơn ' || substring(NEW.id::text, 1, 8));
    v_amount := TO_CHAR(NEW.sale_price, 'FM999,999,999,999');

    IF v_supervisor_id IS NOT NULL THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NULL, v_supervisor_id,
            'Đại lý ' || v_dealer_name || ' có đơn mới',
            v_dealer_name || ' vừa tạo đơn ' || v_label ||
            ' (' || COALESCE(NEW.quantity, 1) || ' máy, ' || v_amount || ' đ), đang chờ admin duyệt.',
            'order', 'info',
            '/portal/supervisor', 'Xem đội'
        );
    END IF;

    FOR v_admin_id IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NULL, v_admin_id,
            'Đơn mới chờ duyệt · ' || v_dealer_name,
            v_dealer_name || ' tạo đơn ' || v_label ||
            ' (' || COALESCE(NEW.quantity, 1) || ' máy, ' || v_amount || ' đ).' ||
            CASE WHEN NEW.shipping_address IS NOT NULL
                 THEN ' Giao: ' || NEW.shipping_address ELSE '' END,
            'order', 'info',
            '/portal/admin/orders', 'Duyệt đơn'
        );
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- ── 2. Update status trigger: also notify supervisor on approve/reject ──
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_label         TEXT;
    v_supervisor_id UUID;
    v_dealer_name   TEXT;
BEGIN
    v_label := COALESCE('serial ' || NEW.serial_number, 'mã đơn ' || substring(NEW.id::text, 1, 8));

    SELECT supervisor_id, COALESCE(full_name, 'đại lý')
      INTO v_supervisor_id, v_dealer_name
      FROM public.profiles WHERE id = NEW.dealer_id;

    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NEW.approved_by, NEW.dealer_id,
            'Đơn hàng đã được duyệt ✓',
            'Đơn hàng ' || v_label || ' (' || COALESCE(NEW.quantity, 1) || ' máy, ' ||
            TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) đã được duyệt. ' ||
            'Hoa hồng sẽ được thanh toán trong kỳ tiếp theo.',
            'order', 'success',
            '/portal/dealer/commission', 'Xem hoa hồng'
        );

        IF v_supervisor_id IS NOT NULL THEN
            INSERT INTO public.portal_messages
                (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
            VALUES (
                NEW.approved_by, v_supervisor_id,
                'Đơn của ' || v_dealer_name || ' đã được duyệt',
                'Đơn ' || v_label || ' (' || COALESCE(NEW.quantity, 1) || ' máy, ' ||
                TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) của đại lý ' ||
                v_dealer_name || ' đã được duyệt.',
                'order', 'success',
                '/portal/supervisor', 'Xem đội'
            );
        END IF;

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

        IF v_supervisor_id IS NOT NULL THEN
            INSERT INTO public.portal_messages
                (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
            VALUES (
                NULL, v_supervisor_id,
                'Đơn của ' || v_dealer_name || ' bị từ chối',
                'Đơn ' || v_label || ' của đại lý ' || v_dealer_name || ' bị từ chối' ||
                CASE WHEN NEW.rejection_reason IS NOT NULL
                     THEN ': ' || NEW.rejection_reason ELSE '.' END,
                'order', 'warning',
                '/portal/supervisor', 'Xem đội'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- ── 3. Disable auto-calc of supervisor commission ───────────────────────
-- Kế toán sẽ tính + nhập số liệu hoa hồng supervisor bằng tay qua admin UI.
CREATE OR REPLACE FUNCTION public.calc_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_rule public.dealer_commissions%ROWTYPE;
    v_dealer_amount NUMERIC(12, 2);
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

    SELECT * INTO v_rule
    FROM public.dealer_commissions
    WHERE dealer_id = v_order.dealer_id
      AND (model_id = v_order.model_id OR model_id IS NULL)
      AND effective_from <= v_order.sale_date
      AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
    ORDER BY (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No commission rule for dealer % at sale_date %', v_order.dealer_id, v_order.sale_date;
    END IF;

    IF v_rule.commission_type = 'fixed' THEN
        v_dealer_amount := v_rule.rate_value;
    ELSE
        v_dealer_amount := ROUND(v_rule.rate_value / 100.0 * v_order.sale_price, 2);
    END IF;

    INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
    VALUES (p_order_id, v_order.dealer_id, 'dealer', v_dealer_amount)
    ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;
END;
$$;

-- ── 4. Admin nhập tay hoa hồng supervisor (kế toán) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_record_supervisor_commission(
    p_supervisor_id UUID,
    p_amount        NUMERIC,
    p_note          TEXT DEFAULT NULL,
    p_order_id      UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'admin_record_supervisor_commission: admin only';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_supervisor_id AND role = 'supervisor') THEN
        RAISE EXCEPTION 'admin_record_supervisor_commission: % is not a supervisor', p_supervisor_id;
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'admin_record_supervisor_commission: số tiền phải > 0';
    END IF;

    INSERT INTO public.commission_payouts
        (order_id, recipient_id, recipient_role, amount, payment_proof_url)
    VALUES (p_order_id, p_supervisor_id, 'supervisor', p_amount, p_note)
    RETURNING id INTO v_id;

    INSERT INTO public.portal_messages
        (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
    VALUES (
        auth.uid(), p_supervisor_id,
        'Hoa hồng supervisor đã được ghi nhận',
        'Kế toán đã ghi nhận khoản hoa hồng ' ||
        TO_CHAR(p_amount, 'FM999,999,999,999') || ' đ cho bạn.' ||
        CASE WHEN p_note IS NOT NULL AND p_note <> '' THEN ' Ghi chú: ' || p_note ELSE '' END,
        'commission', 'success',
        '/portal/profile', 'Xem chi tiết'
    );

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_supervisor_commission(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_supervisor_commission(UUID, NUMERIC, TEXT, UUID) TO authenticated;

-- ── 5. View: current commission plan per dealer (for supervisor UI) ─────
CREATE OR REPLACE VIEW public.dealer_current_commission
WITH (security_invoker = true) AS
SELECT DISTINCT ON (dc.dealer_id)
    dc.dealer_id,
    dc.commission_type,
    dc.rate_value,
    dc.effective_from,
    CASE
        WHEN dc.commission_type = 'percent' THEN dc.rate_value::text || '%'
        ELSE TO_CHAR(dc.rate_value, 'FM999,999,999,999') || ' đ/máy'
    END AS rate_display,
    cp.label AS plan_label
FROM public.dealer_commissions dc
LEFT JOIN public.commission_plans cp
       ON cp.commission_type = dc.commission_type
      AND cp.rate_value = dc.rate_value
WHERE dc.model_id IS NULL
  AND dc.effective_from <= CURRENT_DATE
  AND (dc.effective_to IS NULL OR dc.effective_to >= CURRENT_DATE)
ORDER BY dc.dealer_id, dc.effective_from DESC, dc.created_at DESC;

GRANT SELECT ON public.dealer_current_commission TO authenticated;
