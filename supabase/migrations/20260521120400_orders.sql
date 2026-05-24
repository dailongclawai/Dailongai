CREATE TYPE order_status AS ENUM ('pending', 'approved', 'rejected', 'paid', 'voided');

CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.profiles(id),
    model_id UUID NOT NULL REFERENCES public.product_models(id),
    serial_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    sale_price NUMERIC(12, 2) NOT NULL CHECK (sale_price > 0),
    sale_date DATE NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    receipt_image_url TEXT,
    contract_image_url TEXT,
    notes TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    rejection_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reject_needs_reason
        CHECK (status <> 'rejected' OR (rejection_reason IS NOT NULL AND length(rejection_reason) > 0)),
    CONSTRAINT approve_needs_approver
        CHECK (status NOT IN ('approved', 'paid') OR approved_by IS NOT NULL)
);

CREATE INDEX idx_orders_dealer ON public.orders(dealer_id, sale_date DESC);
CREATE INDEX idx_orders_status ON public.orders(status, created_at DESC);

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
