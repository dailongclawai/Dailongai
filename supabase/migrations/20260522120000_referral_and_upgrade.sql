-- New signups are active dealers by default; an optional ref in user metadata
-- (the referring supervisor's account id) attaches them to that supervisor's branch.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_ref_text TEXT;
    v_ref UUID;
    v_supervisor UUID := NULL;
BEGIN
    v_ref_text := NULLIF(NEW.raw_user_meta_data->>'ref', '');
    IF v_ref_text IS NOT NULL THEN
        BEGIN
            v_ref := v_ref_text::uuid;
        EXCEPTION WHEN others THEN
            v_ref := NULL;
        END;
    END IF;

    IF v_ref IS NOT NULL AND v_ref <> NEW.id
       AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_ref AND role = 'supervisor') THEN
        v_supervisor := v_ref;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status, supervisor_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url',
        'dealer',
        'active',
        v_supervisor
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Admin promotes a dealer to supervisor by account id (clears their own supervisor link).
CREATE OR REPLACE FUNCTION public.admin_set_supervisor(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'admin_set_supervisor: caller is not admin';
    END IF;

    UPDATE public.profiles
    SET role = 'supervisor', status = 'active', supervisor_id = NULL
    WHERE id = p_user_id AND role = 'dealer';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_set_supervisor: % is not an existing dealer', p_user_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_supervisor TO authenticated;

-- A dealer with no supervisor yet claims a referral (used by non-email signups
-- where ref cannot ride along in metadata). Self-referral and non-supervisors rejected.
CREATE OR REPLACE FUNCTION public.claim_referral(p_ref UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF p_ref = auth.uid() THEN
        RAISE EXCEPTION 'claim_referral: cannot refer yourself';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_ref AND role = 'supervisor') THEN
        RAISE EXCEPTION 'claim_referral: % is not a supervisor', p_ref;
    END IF;

    UPDATE public.profiles
    SET supervisor_id = p_ref
    WHERE id = auth.uid() AND role = 'dealer' AND supervisor_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'claim_referral: caller is not an unattached dealer';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_referral TO authenticated;
