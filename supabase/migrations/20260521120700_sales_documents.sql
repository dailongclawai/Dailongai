CREATE TYPE doc_category AS ENUM ('catalog', 'video', 'contract_template', 'manual');
CREATE TYPE doc_visibility AS ENUM ('all', 'dealer', 'supervisor');

CREATE TABLE public.sales_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    category doc_category NOT NULL,
    visible_to doc_visibility NOT NULL DEFAULT 'all',
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
