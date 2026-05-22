CREATE OR REPLACE FUNCTION public.calc_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_dealer public.profiles%ROWTYPE;
    v_rule public.dealer_commissions%ROWTYPE;
    v_override public.supervisor_overrides%ROWTYPE;
    v_dealer_amount NUMERIC(12, 2);
    v_supervisor_amount NUMERIC(12, 2);
    v_ytd_units INTEGER;
    v_tier_percent NUMERIC(6, 4);
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

    SELECT * INTO v_dealer FROM public.profiles WHERE id = v_order.dealer_id;

    -- 1) Per-dealer override (exception) takes precedence
    SELECT * INTO v_rule
    FROM public.dealer_commissions
    WHERE dealer_id = v_order.dealer_id
      AND (model_id = v_order.model_id OR model_id IS NULL)
      AND effective_from <= v_order.sale_date
      AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
    ORDER BY (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
    LIMIT 1;

    IF FOUND THEN
        IF v_rule.commission_type = 'fixed' THEN
            v_dealer_amount := v_rule.rate_value;
        ELSE
            v_dealer_amount := ROUND(v_rule.rate_value / 100.0 * v_order.sale_price, 2);
        END IF;
    ELSE
        -- 2) Global tier by YTD approved/paid units in the sale_date's calendar year
        SELECT count(*) INTO v_ytd_units
        FROM public.orders
        WHERE dealer_id = v_order.dealer_id
          AND status IN ('approved', 'paid')
          AND date_part('year', sale_date) = date_part('year', v_order.sale_date)
          AND id <> p_order_id;

        SELECT percent INTO v_tier_percent
        FROM public.commission_tiers
        WHERE active = TRUE AND min_units <= v_ytd_units
        ORDER BY min_units DESC
        LIMIT 1;

        IF v_tier_percent IS NULL THEN
            RAISE EXCEPTION 'No commission tier configured for % units', v_ytd_units;
        END IF;

        v_dealer_amount := ROUND(v_tier_percent / 100.0 * v_order.sale_price, 2);
    END IF;

    INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
    VALUES (p_order_id, v_order.dealer_id, 'dealer', v_dealer_amount)
    ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;

    -- Supervisor override (unchanged from Plan 1)
    IF v_dealer.supervisor_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM public.supervisor_overrides
        WHERE supervisor_id = v_dealer.supervisor_id
          AND (dealer_id = v_order.dealer_id OR dealer_id IS NULL)
          AND (model_id = v_order.model_id OR model_id IS NULL)
          AND effective_from <= v_order.sale_date
          AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
        ORDER BY (dealer_id IS NOT NULL) DESC, (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_supervisor_amount := ROUND(v_override.override_percent / 100.0 * v_order.sale_price, 2);
            INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
            VALUES (p_order_id, v_dealer.supervisor_id, 'supervisor', v_supervisor_amount)
            ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;
        END IF;
    END IF;
END;
$$;
