-- Catalog of predefined commission plans a supervisor can assign to their dealers.
-- Supervisors pick from this list (no free-form rates), which bounds what they can grant.
CREATE TABLE public.commission_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    commission_type commission_type NOT NULL,
    rate_value NUMERIC(12, 4) NOT NULL CHECK (rate_value >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT plan_percent_in_range CHECK (commission_type <> 'percent' OR rate_value <= 100)
);

INSERT INTO public.commission_plans (label, commission_type, rate_value) VALUES
    ('Cơ bản — 15%', 'percent', 15),
    ('Bạc — 20%', 'percent', 20),
    ('Vàng — 25%', 'percent', 25),
    ('Cố định 5 triệu/máy', 'fixed', 5000000),
    ('Cố định 8 triệu/máy', 'fixed', 8000000);

ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_plans_select_all
    ON public.commission_plans FOR SELECT
    USING (active = TRUE);

CREATE POLICY commission_plans_admin_all
    ON public.commission_plans FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

-- Supervisor assigns a catalog plan to a dealer in their own branch. Writes a
-- per-dealer override row (which calc_commission resolves ahead of the global tier).
CREATE OR REPLACE FUNCTION public.supervisor_set_commission(p_dealer_id UUID, p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_plan public.commission_plans%ROWTYPE;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'supervisor' THEN
        RAISE EXCEPTION 'supervisor_set_commission: caller is not a supervisor';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_dealer_id AND role = 'dealer' AND supervisor_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'supervisor_set_commission: % is not a dealer in your branch', p_dealer_id;
    END IF;

    SELECT * INTO v_plan FROM public.commission_plans WHERE id = p_plan_id AND active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'supervisor_set_commission: plan % not found or inactive', p_plan_id;
    END IF;

    INSERT INTO public.dealer_commissions
        (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
    VALUES
        (p_dealer_id, NULL, v_plan.commission_type, v_plan.rate_value, CURRENT_DATE, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.supervisor_set_commission TO authenticated;
