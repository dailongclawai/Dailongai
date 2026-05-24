-- Phương án A (tier): 0–100 = 15%, 101–200 = 20%, 201+ = 25%
UPDATE public.commission_tiers SET min_units = 101 WHERE label = 'Tier 2';
UPDATE public.commission_tiers SET min_units = 201 WHERE label = 'Tier 3';

-- Phương án B (default): new dealers get a flat 15% commission on every order.
-- calc_commission resolves the per-dealer override before the global tier, so
-- inserting a 15% percent rule at signup makes flat-15% the default scheme.
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

    -- Default commission scheme B: flat 15% on every order
    INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
    SELECT NEW.id, NULL, 'percent', 15, CURRENT_DATE, NEW.id
    WHERE NOT EXISTS (SELECT 1 FROM public.dealer_commissions WHERE dealer_id = NEW.id);

    RETURN NEW;
END;
$$;
