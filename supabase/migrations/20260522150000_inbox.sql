-- In-portal inbox: system notifications + user feedback to admin
CREATE TABLE public.portal_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject       TEXT NOT NULL,
    body          TEXT NOT NULL,
    is_read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.portal_messages (recipient_id, is_read, created_at DESC);

ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

-- Recipient sees own messages; admin sees everything
CREATE POLICY "inbox_recipient_select" ON public.portal_messages
    FOR SELECT USING (
        recipient_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- No direct INSERT — all writes go through SECURITY DEFINER helpers below
-- ──────────────────────────────────────────────────────────────────────────

-- Trigger: notify dealer when their order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        INSERT INTO public.portal_messages (sender_id, recipient_id, subject, body)
        VALUES (
            NEW.approved_by,
            NEW.dealer_id,
            'Đơn hàng đã được duyệt ✓',
            'Đơn hàng serial ' || NEW.serial_number ||
            ' (giá ' || TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) đã được duyệt. ' ||
            'Hoa hồng sẽ được thanh toán trong kỳ tiếp theo.'
        );
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
        INSERT INTO public.portal_messages (sender_id, recipient_id, subject, body)
        VALUES (
            NULL,
            NEW.dealer_id,
            'Đơn hàng bị từ chối',
            'Đơn hàng serial ' || NEW.serial_number || ' bị từ chối' ||
            CASE WHEN NEW.rejection_reason IS NOT NULL
                 THEN ': ' || NEW.rejection_reason
                 ELSE '.'
            END
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_portal_message_on_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- ──────────────────────────────────────────────────────────────────────────
-- send_feedback: any authenticated user sends a message to all admins
CREATE OR REPLACE FUNCTION public.send_feedback(
    p_subject TEXT,
    p_body    TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'send_feedback: not authenticated';
    END IF;
    IF TRIM(p_subject) = '' OR TRIM(p_body) = '' THEN
        RAISE EXCEPTION 'send_feedback: subject and body required';
    END IF;

    FOR v_admin_id IN
        SELECT id FROM public.profiles WHERE role = 'admin'
    LOOP
        INSERT INTO public.portal_messages (sender_id, recipient_id, subject, body)
        VALUES (auth.uid(), v_admin_id, TRIM(p_subject), TRIM(p_body));
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_feedback TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- mark_message_read: recipient marks a specific message as read
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    UPDATE public.portal_messages
       SET is_read = TRUE
     WHERE id = p_message_id
       AND recipient_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_message_read TO authenticated;
