-- Update fixed commission override range:
--   Before: 4.500.000đ – 12.000.000đ
--   After : 4.500.000đ – 7.500.000đ
--
-- Steps:
-- 1. Drop existing constraint
-- 2. Clamp any rate_value > 7.500.000 down to ceiling (1 known row at 10.5M)
-- 3. Re-add constraint with new ceiling
-- 4. Update RPC validation + error message

ALTER TABLE public.dealer_commissions DROP CONSTRAINT IF EXISTS dealer_commissions_fixed_range_chk;

UPDATE public.dealer_commissions
   SET rate_value = 7500000
 WHERE commission_type = 'fixed'
   AND rate_value > 7500000;

ALTER TABLE public.dealer_commissions
    ADD CONSTRAINT dealer_commissions_fixed_range_chk
    CHECK (
        commission_type <> 'fixed'
        OR (rate_value >= 4500000 AND rate_value <= 7500000)
    );

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
    IF p_amount IS NULL OR p_amount < 4500000 OR p_amount > 7500000 THEN
        RAISE EXCEPTION 'supervisor_set_dealer_fixed_commission: số tiền phải từ 4.500.000đ tới 7.500.000đ';
    END IF;

    DELETE FROM public.dealer_commissions
     WHERE dealer_id = p_dealer_id AND model_id IS NULL
       AND effective_from = CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

    UPDATE public.dealer_commissions
       SET effective_to = CURRENT_DATE - INTERVAL '1 day'
     WHERE dealer_id = p_dealer_id AND model_id IS NULL
       AND effective_from < CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

    INSERT INTO public.dealer_commissions
        (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
    VALUES
        (p_dealer_id, NULL, 'fixed', p_amount, CURRENT_DATE, auth.uid());
END;
$$;
