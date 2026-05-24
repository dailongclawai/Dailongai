-- Notification center: add categorization + action button + severity to portal_messages.
-- One-way notification model. Chat-style 2-way (admin_reply / send_feedback) deprecated in UI but RPCs kept for compat.

ALTER TABLE public.portal_messages
    ADD COLUMN category     TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN severity     TEXT NOT NULL DEFAULT 'info',
    ADD COLUMN action_url   TEXT,
    ADD COLUMN action_label TEXT;

ALTER TABLE public.portal_messages
    ADD CONSTRAINT portal_messages_category_chk
        CHECK (category IN ('order', 'commission', 'payout', 'legal', 'policy', 'system', 'general')),
    ADD CONSTRAINT portal_messages_severity_chk
        CHECK (severity IN ('info', 'success', 'warning', 'critical'));

CREATE INDEX IF NOT EXISTS portal_messages_category_idx
    ON public.portal_messages (recipient_id, category, created_at DESC);

-- ── Backfill existing rows from subject pattern ───────────────────────
UPDATE public.portal_messages SET
    category = 'order',
    severity = 'success',
    action_url = '/portal/dealer/commission',
    action_label = 'Xem chi tiết'
WHERE subject ILIKE '%đã được duyệt%';

UPDATE public.portal_messages SET
    category = 'order',
    severity = 'warning'
WHERE subject ILIKE '%bị từ chối%';

UPDATE public.portal_messages SET
    category = 'general',
    severity = 'info'
WHERE category = 'general' AND sender_id IS NOT NULL;

-- ── Producer: order status trigger now populates new fields ───────────
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NEW.approved_by,
            NEW.dealer_id,
            'Đơn hàng đã được duyệt ✓',
            'Đơn hàng serial ' || NEW.serial_number ||
            ' (giá ' || TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) đã được duyệt. ' ||
            'Hoa hồng sẽ được thanh toán trong kỳ tiếp theo.',
            'order',
            'success',
            '/portal/dealer/commission',
            'Xem hoa hồng'
        );
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NULL,
            NEW.dealer_id,
            'Đơn hàng bị từ chối',
            'Đơn hàng serial ' || NEW.serial_number || ' bị từ chối' ||
            CASE WHEN NEW.rejection_reason IS NOT NULL
                 THEN ': ' || NEW.rejection_reason
                 ELSE '.'
            END,
            'order',
            'warning',
            '/portal/dealer/orders/' || NEW.id,
            'Xem đơn hàng'
        );
    END IF;
    RETURN NEW;
END;
$$;

-- ── Helper: insert system notification with full fields (for admin manual + future producers) ─
CREATE OR REPLACE FUNCTION public.send_system_notification(
    p_recipient_id  UUID,
    p_subject       TEXT,
    p_body          TEXT,
    p_category      TEXT DEFAULT 'general',
    p_severity      TEXT DEFAULT 'info',
    p_action_url    TEXT DEFAULT NULL,
    p_action_label  TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'send_system_notification: admin only';
    END IF;
    INSERT INTO public.portal_messages
        (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
    VALUES (NULL, p_recipient_id, p_subject, p_body, p_category, p_severity, p_action_url, p_action_label)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_system_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── mark_all_read: convenience RPC for "Đánh dấu đã đọc tất cả" button ─
CREATE OR REPLACE FUNCTION public.mark_all_messages_read()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_count INT;
BEGIN
    WITH updated AS (
        UPDATE public.portal_messages
           SET is_read = TRUE
         WHERE recipient_id = auth.uid() AND is_read = FALSE
        RETURNING 1
    )
    SELECT count(*) INTO v_count FROM updated;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_messages_read() TO authenticated;
