-- Admin replies to a feedback message; reply lands in sender's inbox
CREATE OR REPLACE FUNCTION public.admin_reply(
    p_message_id UUID,
    p_body       TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_sender_id   UUID;
    v_subject     TEXT;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_reply: only admins can reply';
    END IF;

    SELECT sender_id, subject INTO v_sender_id, v_subject
    FROM public.portal_messages
    WHERE id = p_message_id;

    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'admin_reply: cannot reply to system notifications';
    END IF;

    IF TRIM(p_body) = '' THEN
        RAISE EXCEPTION 'admin_reply: body cannot be empty';
    END IF;

    INSERT INTO public.portal_messages (sender_id, recipient_id, subject, body)
    VALUES (auth.uid(), v_sender_id, 'Re: ' || v_subject, TRIM(p_body));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reply TO authenticated;
