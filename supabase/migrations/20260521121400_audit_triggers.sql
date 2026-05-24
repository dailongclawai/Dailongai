CREATE OR REPLACE FUNCTION public.write_audit(
    p_action TEXT,
    p_target_table TEXT,
    p_target_id UUID,
    p_before JSONB,
    p_after JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    INSERT INTO public.audit_log (actor_id, action, target_table, target_id, before, after)
    VALUES (auth.uid(), p_action, p_target_table, p_target_id, p_before, p_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF (OLD.status = 'pending' AND NEW.status = 'approved') THEN
        v_action := 'approve_order';
    ELSIF (OLD.status = 'pending' AND NEW.status = 'rejected') THEN
        v_action := 'reject_order';
    ELSIF (OLD.status IN ('approved', 'paid') AND NEW.status = 'voided') THEN
        v_action := 'void_order';
    ELSIF (OLD.status = 'approved' AND NEW.status = 'paid') THEN
        v_action := 'mark_paid';
    ELSE
        RETURN NEW;
    END IF;

    PERFORM public.write_audit(v_action, 'orders', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
END;
$$;

CREATE TRIGGER orders_audit
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_audit_trigger();

CREATE OR REPLACE FUNCTION public.profiles_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.supervisor_id IS DISTINCT FROM NEW.supervisor_id THEN
        PERFORM public.write_audit('update_profile', 'profiles', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_audit
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_audit_trigger();

CREATE OR REPLACE FUNCTION public.commissions_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.write_audit('insert_' || TG_TABLE_NAME, TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.write_audit('update_' || TG_TABLE_NAME, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.write_audit('delete_' || TG_TABLE_NAME, TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER dealer_commissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.dealer_commissions
FOR EACH ROW EXECUTE FUNCTION public.commissions_audit_trigger();

CREATE TRIGGER supervisor_overrides_audit
AFTER INSERT OR UPDATE OR DELETE ON public.supervisor_overrides
FOR EACH ROW EXECUTE FUNCTION public.commissions_audit_trigger();
