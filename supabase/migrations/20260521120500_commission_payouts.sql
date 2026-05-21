CREATE TYPE recipient_role AS ENUM ('dealer', 'supervisor');

CREATE TABLE public.commission_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id),
    recipient_role recipient_role NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ,
    payment_proof_url TEXT,
    voided_at TIMESTAMPTZ,
    UNIQUE (order_id, recipient_id, recipient_role)
);

CREATE INDEX idx_payouts_recipient ON public.commission_payouts(recipient_id, calculated_at DESC);
CREATE INDEX idx_payouts_order ON public.commission_payouts(order_id);
