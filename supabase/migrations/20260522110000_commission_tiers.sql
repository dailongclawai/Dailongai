CREATE TABLE public.commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    min_units INTEGER NOT NULL CHECK (min_units >= 0),
    percent NUMERIC(6, 4) NOT NULL CHECK (percent >= 0 AND percent <= 100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (min_units, active)
);

-- Boss-chosen Tier A scheme (2026-05-22): 15% (0-99), 20% (100-199), 25% (200+)
INSERT INTO public.commission_tiers (label, min_units, percent) VALUES
    ('Tier 1', 0, 15),
    ('Tier 2', 100, 20),
    ('Tier 3', 200, 25);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_tiers_select_all
    ON public.commission_tiers FOR SELECT
    USING (active = TRUE);

CREATE POLICY commission_tiers_admin_all
    ON public.commission_tiers FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
