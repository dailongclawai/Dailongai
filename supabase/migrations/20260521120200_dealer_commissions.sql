CREATE TYPE commission_type AS ENUM ('fixed', 'percent');

CREATE TABLE public.dealer_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    model_id UUID REFERENCES public.product_models(id) ON DELETE CASCADE,
    commission_type commission_type NOT NULL,
    rate_value NUMERIC(12, 4) NOT NULL CHECK (rate_value >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    set_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT percent_in_range CHECK (commission_type <> 'percent' OR rate_value <= 100)
);

CREATE INDEX idx_dealer_commissions_lookup
    ON public.dealer_commissions(dealer_id, model_id, effective_from DESC);
