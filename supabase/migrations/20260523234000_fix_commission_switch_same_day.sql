-- Bug: switching commission plan twice in the same day fails with
--   "new row for relation \"dealer_commissions\" violates check constraint \"effective_range\""
-- because the supervisor RPCs close existing rules by setting
-- effective_to = CURRENT_DATE - 1, but rules just created earlier today have
-- effective_from = CURRENT_DATE, and effective_range requires effective_to >= effective_from.
--
-- Fix: for same-day rules, DELETE the row instead of closing it (no useful
-- temporal coverage anyway — a rule that lived <1 day is just a typo). For
-- rules from prior days, close via UPDATE as before.

CREATE OR REPLACE FUNCTION public.supervisor_set_dealer_fixed_commission(
    p_dealer_id UUID,
    p_amount    NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'supervisor' AND v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'supervisor_set_dealer_fixed_commission: chỉ supervisor/admin được set';
    END IF;

    IF v_caller_role = 'supervisor' AND NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_dealer_id AND role = 'dealer' AND supervisor_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'supervisor_set_dealer_fixed_commission: đại lý % không thuộc nhánh của bạn', p_dealer_id;
    END IF;

    IF p_amount IS NULL OR p_amount < 4500000 OR p_amount > 12000000 THEN
        RAISE EXCEPTION 'supervisor_set_dealer_fixed_commission: số tiền phải từ 4.500.000đ tới 12.000.000đ';
    END IF;

    -- Same-day rules: delete (cannot close with effective_to = yesterday — fails effective_range)
    DELETE FROM public.dealer_commissions
     WHERE dealer_id = p_dealer_id
       AND model_id IS NULL
       AND effective_from = CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

    -- Older active rules: close them out yesterday
    UPDATE public.dealer_commissions
       SET effective_to = CURRENT_DATE - INTERVAL '1 day'
     WHERE dealer_id = p_dealer_id
       AND model_id IS NULL
       AND effective_from < CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

    INSERT INTO public.dealer_commissions
        (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
    VALUES
        (p_dealer_id, NULL, 'fixed', p_amount, CURRENT_DATE, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.supervisor_clear_dealer_fixed_commission(p_dealer_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'supervisor' AND v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'supervisor_clear_dealer_fixed_commission: chỉ supervisor/admin';
    END IF;
    IF v_caller_role = 'supervisor' AND NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_dealer_id AND role = 'dealer' AND supervisor_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'supervisor_clear_dealer_fixed_commission: đại lý không thuộc nhánh';
    END IF;

    -- Same-day fixed rule: delete (cannot close — fails effective_range)
    DELETE FROM public.dealer_commissions
     WHERE dealer_id = p_dealer_id
       AND model_id IS NULL
       AND commission_type = 'fixed'
       AND effective_from = CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

    -- Older active fixed rules: close them out yesterday
    UPDATE public.dealer_commissions
       SET effective_to = CURRENT_DATE - INTERVAL '1 day'
     WHERE dealer_id = p_dealer_id
       AND model_id IS NULL
       AND commission_type = 'fixed'
       AND effective_from < CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);
END;
$$;
