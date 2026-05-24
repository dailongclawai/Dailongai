-- Update tier thresholds per Boss decision 2026-05-24:
--   1–200 máy   = Tier 1 · 15%
--   201–300 máy = Tier 2 · 20%
--   301+ máy    = Tier 3 · 25%
-- (Old: 0–100=15%, 101–200=20%, 201+=25%)

-- Bump Tier 3 first to vacate 201 slot (unique constraint on (min_units, active))
UPDATE public.commission_tiers SET min_units = 301 WHERE label = 'Tier 3';
UPDATE public.commission_tiers SET min_units = 201 WHERE label = 'Tier 2';

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

    IF v_units >= 301 THEN
        RETURN QUERY SELECT v_units, 3, 'Tier 3 · Vàng'::text, 25::numeric;
    ELSIF v_units >= 201 THEN
        RETURN QUERY SELECT v_units, 2, 'Tier 2 · Bạc'::text, 20::numeric;
    ELSE
        RETURN QUERY SELECT v_units, 1, 'Tier 1 · Cơ bản'::text, 15::numeric;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dealer_commission_tier(UUID) TO authenticated;
