CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_target ON public.audit_log(target_table, target_id, created_at DESC);
CREATE INDEX idx_audit_actor ON public.audit_log(actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_log_block_modify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable';
END;
$$;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_modify();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_modify();
