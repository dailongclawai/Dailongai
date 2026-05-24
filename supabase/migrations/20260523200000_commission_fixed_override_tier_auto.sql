-- Commission redesign: FIXED amount (supervisor override) > Tier % auto-promotion.
-- Tier 1/2/3 → 15/20/25% theo số máy approved+paid trong năm hiện tại.
-- Range fixed amount: 4.500.000đ – 12.000.000đ.

-- ── 1. Fixed amount range constraint on dealer_commissions ───────────
-- Use a partial CHECK that only kicks in when commission_type='fixed'.
ALTER TABLE public.dealer_commissions
    DROP CONSTRAINT IF EXISTS dealer_commissions_fixed_range_chk;
ALTER TABLE public.dealer_commissions
    ADD CONSTRAINT dealer_commissions_fixed_range_chk
    CHECK (
        commission_type <> 'fixed'
        OR (rate_value >= 4500000 AND rate_value <= 12000000)
    );

-- ── 2. Tier-aware commission percent function ────────────────────────
CREATE OR REPLACE FUNCTION public.get_dealer_commission_tier(p_dealer_id UUID)
RETURNS TABLE (units_ytd INT, tier_no INT, tier_label TEXT, percent NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_units INT := 0;
BEGIN
    SELECT COUNT(*)::INT INTO v_units
    FROM public.orders
    WHERE dealer_id = p_dealer_id
      AND status IN ('approved', 'paid')
      AND date_part('year', sale_date) = date_part('year', now());

    IF v_units >= 201 THEN
        RETURN QUERY SELECT v_units, 3, 'Tier 3 · Vàng'::text, 25::numeric;
    ELSIF v_units >= 101 THEN
        RETURN QUERY SELECT v_units, 2, 'Tier 2 · Bạc'::text, 20::numeric;
    ELSE
        RETURN QUERY SELECT v_units, 1, 'Tier 1 · Cơ bản'::text, 15::numeric;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dealer_commission_tier(UUID) TO authenticated;

-- ── 3. calc_commission: FIXED override > tier auto ──────────────────
CREATE OR REPLACE FUNCTION public.calc_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_rule public.dealer_commissions%ROWTYPE;
    v_dealer_amount NUMERIC(12, 2);
    v_tier_pct NUMERIC;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

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
$$;

-- ── 4. Supervisor RPC: set fixed override (4.5tr–12tr) ──────────────
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

    -- Close any active rules (fixed or percent) for this dealer so the new one wins
    UPDATE public.dealer_commissions
       SET effective_to = CURRENT_DATE - INTERVAL '1 day'
     WHERE dealer_id = p_dealer_id
       AND model_id IS NULL
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);

    INSERT INTO public.dealer_commissions
        (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
    VALUES
        (p_dealer_id, NULL, 'fixed', p_amount, CURRENT_DATE, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.supervisor_set_dealer_fixed_commission(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supervisor_set_dealer_fixed_commission(UUID, NUMERIC) TO authenticated;

-- ── 5. Supervisor RPC: clear override (back to tier auto) ───────────
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

    UPDATE public.dealer_commissions
       SET effective_to = CURRENT_DATE - INTERVAL '1 day'
     WHERE dealer_id = p_dealer_id
       AND model_id IS NULL
       AND commission_type = 'fixed'
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);
END;
$$;

REVOKE ALL ON FUNCTION public.supervisor_clear_dealer_fixed_commission(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supervisor_clear_dealer_fixed_commission(UUID) TO authenticated;

-- ── 6. View dealer_current_commission: include tier + override info ─
DROP VIEW IF EXISTS public.dealer_current_commission;
CREATE OR REPLACE VIEW public.dealer_current_commission
WITH (security_invoker = true) AS
SELECT
    p.id AS dealer_id,
    -- Fixed override (if any, active today)
    fx.commission_type        AS override_type,
    fx.rate_value             AS override_amount,
    fx.effective_from         AS override_from,
    -- Tier auto
    t.tier_no                 AS tier_no,
    t.tier_label              AS tier_label,
    t.percent                 AS tier_percent,
    t.units_ytd               AS units_ytd,
    -- Effective display
    CASE
        WHEN fx.rate_value IS NOT NULL THEN TO_CHAR(fx.rate_value, 'FM999,999,999,999') || ' đ/máy'
        ELSE t.percent::text || '%'
    END AS rate_display,
    CASE WHEN fx.rate_value IS NOT NULL THEN 'fixed' ELSE 'tier_auto' END AS source
FROM public.profiles p
LEFT JOIN LATERAL (
    SELECT *
    FROM public.dealer_commissions dc
    WHERE dc.dealer_id = p.id
      AND dc.commission_type = 'fixed'
      AND dc.model_id IS NULL
      AND dc.effective_from <= CURRENT_DATE
      AND (dc.effective_to IS NULL OR dc.effective_to >= CURRENT_DATE)
    ORDER BY dc.effective_from DESC, dc.created_at DESC
    LIMIT 1
) fx ON TRUE
LEFT JOIN LATERAL public.get_dealer_commission_tier(p.id) t ON TRUE
WHERE p.role = 'dealer';

GRANT SELECT ON public.dealer_current_commission TO authenticated;
