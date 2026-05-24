-- Bug fix + extension:
-- 1. notify_order_status_change function existed since 2026-05-23 but its trigger
--    was never created — dealer/supervisor receive no notification on approve/reject.
--    Attach the trigger now.
-- 2. Extend function to also notify on 'paid' status (used by Sepay auto-confirm webhook).

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

    ELSIF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
        INSERT INTO public.portal_messages
            (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (
            NULL, NEW.dealer_id,
            'Khách đã thanh toán ✓',
            'Đơn ' || v_label || ' (' ||
            TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) đã nhận tiền từ khách. ' ||
            'Đại Long sẽ xử lý giao hàng sớm nhất.',
            'order', 'success',
            '/portal/dealer/commission', 'Xem hoa hồng'
        );
        IF v_supervisor_id IS NOT NULL THEN
            INSERT INTO public.portal_messages
                (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
            VALUES (
                NULL, v_supervisor_id,
                'Đơn của ' || v_dealer_name || ' đã thanh toán',
                'Đơn ' || v_label || ' (' ||
                TO_CHAR(NEW.sale_price, 'FM999,999,999,999') || ' đ) của đại lý ' ||
                v_dealer_name || ' đã nhận tiền từ khách.',
                'order', 'success',
                '/portal/supervisor', 'Xem đội'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_order_status_change();
