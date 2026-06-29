-- Make calc_commission skip the house "direct sales" dealer (order_slug='dai-long'),
-- so direct /san-pham purchases create NO commission_payouts row. This is the only
-- clean way to give the house zero commission: a FIXED rule is constrained to
-- [4.5M, 7.5M] and the tier floor is 15%, so there is no 0-value rule to insert.
--
-- The body is identical to the existing calc_commission EXCEPT the early-return guard
-- right after the order lookup. All non-house dealers are unaffected.

create or replace function public.calc_commission(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
    v_order public.orders%ROWTYPE;
    v_rule public.dealer_commissions%ROWTYPE;
    v_dealer_amount NUMERIC(12, 2);
    v_tier_pct NUMERIC;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

    -- House "direct sales" dealer (Đại Long trực tiếp) earns no commission.
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_order.dealer_id AND order_slug = 'dai-long'
    ) THEN
        RETURN;
    END IF;

    -- Try FIXED override first
    SELECT * INTO v_rule
    FROM public.dealer_commissions
    WHERE dealer_id = v_order.dealer_id
      AND commission_type = 'fixed'
      AND (model_id = v_order.model_id OR model_id IS NULL)
      AND effective_from <= v_order.sale_date
      AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
    ORDER BY (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_dealer_amount := v_rule.rate_value * COALESCE(v_order.quantity, 1);
    ELSE
        -- Fall back to tier % auto
        SELECT percent INTO v_tier_pct FROM public.get_dealer_commission_tier(v_order.dealer_id);
        v_dealer_amount := ROUND(v_tier_pct / 100.0 * v_order.sale_price, 2);
    END IF;

    INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
    VALUES (p_order_id, v_order.dealer_id, 'dealer', v_dealer_amount)
    ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;
END;
$function$;
