CREATE OR REPLACE FUNCTION public.admin_approve_registration(
    p_profile_id UUID,
    p_role profile_role,
    p_supervisor_id UUID,
    p_commission_type commission_type,
    p_rate_value NUMERIC,
    p_model_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_approve_registration: caller is not admin';
    END IF;

    IF p_role = 'dealer' AND p_supervisor_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_supervisor_id AND role = 'supervisor') THEN
            RAISE EXCEPTION 'admin_approve_registration: supervisor_id % is not a supervisor', p_supervisor_id;
        END IF;
    ELSIF p_role <> 'dealer' AND p_supervisor_id IS NOT NULL THEN
        RAISE EXCEPTION 'admin_approve_registration: only dealers can have supervisor_id';
    END IF;

    UPDATE public.profiles
    SET role = p_role,
        status = 'active',
        supervisor_id = CASE WHEN p_role = 'dealer' THEN p_supervisor_id ELSE NULL END,
        approved_at = now(),
        approved_by = auth.uid()
    WHERE id = p_profile_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_approve_registration: profile % not found or not pending', p_profile_id;
    END IF;

    IF p_role = 'dealer' THEN
        INSERT INTO public.dealer_commissions
            (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
        VALUES
            (p_profile_id, p_model_id, p_commission_type, p_rate_value, CURRENT_DATE, auth.uid());
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_registration TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_registration(
    p_profile_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_reject_registration: caller is not admin';
    END IF;

    UPDATE public.profiles
    SET status = 'suspended',
        approved_at = now(),
        approved_by = auth.uid()
    WHERE id = p_profile_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_reject_registration: profile % not found or not pending', p_profile_id;
    END IF;

    PERFORM public.write_audit('reject_registration', 'profiles', p_profile_id, NULL,
        jsonb_build_object('reason', p_reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_registration TO authenticated;
