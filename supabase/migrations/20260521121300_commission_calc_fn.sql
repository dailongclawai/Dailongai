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
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

    SELECT * INTO v_dealer FROM public.profiles WHERE id = v_order.dealer_id;

    SELECT * INTO v_rule
    FROM public.dealer_commissions
    WHERE dealer_id = v_order.dealer_id
      AND (model_id = v_order.model_id OR model_id IS NULL)
      AND effective_from <= v_order.sale_date
      AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
    ORDER BY (model_id IS NOT NULL) DESC, effective_from DESC, created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No commission rule for dealer % at sale_date %', v_order.dealer_id, v_order.sale_date;
    END IF;

    IF v_rule.commission_type = 'fixed' THEN
        v_dealer_amount := v_rule.rate_value;
    ELSE
        v_dealer_amount := ROUND(v_rule.rate_value / 100.0 * v_order.sale_price, 2);
    END IF;

    INSERT INTO public.commission_payouts (order_id, recipient_id, recipient_role, amount)
    VALUES (p_order_id, v_order.dealer_id, 'dealer', v_dealer_amount)
    ON CONFLICT (order_id, recipient_id, recipient_role) DO NOTHING;

    IF v_dealer.supervisor_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM public.supervisor_overrides
        WHERE supervisor_id = v_dealer.supervisor_id
          AND (dealer_id = v_order.dealer_id OR dealer_id IS NULL)
          AND (model_id = v_order.model_id OR model_id IS NULL)
          AND effective_from <= v_order.sale_date
          AND (effective_to IS NULL OR effective_to >= v_order.sale_date)
        ORDER BY
            (dealer_id IS NOT NULL) DESC,
            (model_id IS NOT NULL) DESC,
            effective_from DESC,
            created_at DESC
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

CREATE OR REPLACE FUNCTION public.orders_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF (TG_OP = 'UPDATE'
        AND OLD.status = 'pending'
        AND NEW.status = 'approved') THEN
        PERFORM public.calc_commission(NEW.id);
    END IF;

    IF (TG_OP = 'UPDATE'
        AND OLD.status IN ('approved', 'paid')
        AND NEW.status = 'voided') THEN
        UPDATE public.commission_payouts
        SET voided_at = now()
        WHERE order_id = NEW.id AND voided_at IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER orders_commission_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_on_approve();
