CREATE TABLE public.supervisor_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dealer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    model_id UUID REFERENCES public.product_models(id) ON DELETE CASCADE,
    override_percent NUMERIC(6, 4) NOT NULL CHECK (override_percent >= 0 AND override_percent <= 100),
    effective_from DATE NOT NULL,
    effective_to DATE,
    set_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT effective_range_sv CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_supervisor_overrides_lookup
    ON public.supervisor_overrides(supervisor_id, dealer_id, model_id, effective_from DESC);
