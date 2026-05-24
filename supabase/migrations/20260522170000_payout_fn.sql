-- Admin marks a commission payout as paid and sends inbox notification to recipient
CREATE OR REPLACE FUNCTION public.admin_process_payout(
    p_payout_id UUID,
    p_proof_ref TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_payout      commission_payouts%ROWTYPE;
    v_order       orders%ROWTYPE;
    v_amount_fmt  TEXT;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_process_payout: only admins can process payouts';
    END IF;

    SELECT * INTO v_payout FROM public.commission_payouts WHERE id = p_payout_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_process_payout: payout % not found', p_payout_id;
    END IF;
    IF v_payout.paid_at IS NOT NULL THEN
        RAISE EXCEPTION 'admin_process_payout: payout already paid';
    END IF;
    IF v_payout.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'admin_process_payout: payout is voided';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_payout.order_id;

    UPDATE public.commission_payouts
    SET paid_at = NOW(), payment_proof_url = TRIM(p_proof_ref)
    WHERE id = p_payout_id;

    v_amount_fmt := TO_CHAR(v_payout.amount, 'FM999G999G999') || ' đ';

    INSERT INTO public.portal_messages (sender_id, recipient_id, subject, body)
    VALUES (
        auth.uid(),
        v_payout.recipient_id,
        'Hoa hồng đã được chuyển khoản',
        'Hoa hồng cho đơn hàng ' || v_order.serial_number ||
        ' (doanh số ' || TO_CHAR(v_order.sale_price, 'FM999G999G999') || ' đ)' ||
        ' số tiền ' || v_amount_fmt || ' đã được chuyển khoản.' ||
        CASE WHEN TRIM(COALESCE(p_proof_ref, '')) <> ''
             THEN E'\nMã tham chiếu: ' || TRIM(p_proof_ref)
             ELSE '' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_payout TO authenticated;

-- View for admin payout queue (all non-voided payouts with order + recipient info)
CREATE VIEW public.admin_payout_queue
WITH (security_invoker = TRUE) AS
SELECT
    cp.id,
    cp.recipient_id,
    cp.recipient_role,
    cp.amount,
    cp.calculated_at,
    cp.paid_at,
    cp.payment_proof_url,
    cp.voided_at,
    p.full_name   AS recipient_name,
    p.email       AS recipient_email,
    o.id          AS order_id,
    o.serial_number,
    o.sale_date,
    o.sale_price,
    o.customer_name
FROM public.commission_payouts cp
JOIN public.orders  o ON o.id  = cp.order_id
JOIN public.profiles p ON p.id = cp.recipient_id
WHERE cp.voided_at IS NULL;
