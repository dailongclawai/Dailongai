-- 1. Enable realtime broadcasts on profiles so clients can react to role/status changes live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 2. Admin demotes a supervisor back to dealer.
-- Refuses if the supervisor still has dealers in their team (admin must reassign first).
CREATE OR REPLACE FUNCTION public.admin_set_dealer(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_team_count  INT;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_set_dealer: caller is not admin';
    END IF;

    SELECT count(*) INTO v_team_count
    FROM public.profiles
    WHERE supervisor_id = p_user_id AND role = 'dealer';

    IF v_team_count > 0 THEN
        RAISE EXCEPTION 'admin_set_dealer: supervisor còn % đại lý trong đội — hãy gỡ/chuyển đại lý trước', v_team_count;
    END IF;

    UPDATE public.profiles
    SET role = 'dealer', supervisor_id = NULL
    WHERE id = p_user_id AND role = 'supervisor';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_set_dealer: % is not an existing supervisor', p_user_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_dealer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_dealer(UUID) TO authenticated;
