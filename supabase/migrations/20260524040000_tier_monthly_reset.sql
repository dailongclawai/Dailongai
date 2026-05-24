-- Switch tier auto-promotion from year-to-date → month-to-date.
-- Boss decision 2026-05-24: tier resets at the start of every month.
--   Tier 1 (1–200 máy/tháng) → 15%
--   Tier 2 (201–300 máy/tháng) → 20%
--   Tier 3 (301+ máy/tháng) → 25%
--
-- Column NAME `units_ytd` is kept for backwards compat across views/types,
-- but semantically it now represents the current calendar-month count.

-- 1. Tier function: count current month only
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
      AND date_part('year', sale_date) = date_part('year', now())
      AND date_part('month', sale_date) = date_part('month', now());

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

-- 2. Dealer dashboard: units_ytd now = current month
DROP VIEW IF EXISTS public.dealer_dashboard_summary;
CREATE VIEW public.dealer_dashboard_summary
WITH (security_invoker = true) AS
SELECT
    o.dealer_id,
    count(*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(*) FILTER (WHERE o.status = 'approved') AS orders_approved,
    count(*) FILTER (WHERE o.status = 'paid') AS orders_paid,
    count(*) FILTER (
        WHERE o.status IN ('approved','paid')
          AND date_part('year', o.sale_date) = date_part('year', now())
          AND date_part('month', o.sale_date) = date_part('month', now())
    ) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (
        WHERE date_part('year', o.sale_date) = date_part('year', now())
          AND date_part('month', o.sale_date) = date_part('month', now())
    ), 0) AS month_sales,
    coalesce((SELECT sum(cp.amount) FROM public.commission_payouts cp WHERE cp.recipient_id = o.dealer_id AND cp.recipient_role='dealer' AND cp.paid_at IS NULL AND cp.voided_at IS NULL), 0) AS commission_pending,
    coalesce((SELECT sum(cp.amount) FROM public.commission_payouts cp WHERE cp.recipient_id = o.dealer_id AND cp.recipient_role='dealer' AND cp.paid_at IS NOT NULL), 0) AS commission_paid
FROM public.orders o
GROUP BY o.dealer_id;

-- 3. Supervisor team panel: units_ytd now = current month (keep dealer_account_no)
DROP VIEW IF EXISTS public.supervisor_team_summary;
CREATE VIEW public.supervisor_team_summary
WITH (security_invoker = true) AS
SELECT
    p.supervisor_id,
    p.id AS dealer_id,
    p.account_no AS dealer_account_no,
    p.full_name AS dealer_name,
    count(o.*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(o.*) FILTER (
        WHERE o.status IN ('approved','paid')
          AND date_part('year', o.sale_date) = date_part('year', now())
          AND date_part('month', o.sale_date) = date_part('month', now())
    ) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (
        WHERE date_part('year', o.sale_date) = date_part('year', now())
          AND date_part('month', o.sale_date) = date_part('month', now())
    ), 0) AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer'
GROUP BY p.supervisor_id, p.id, p.account_no, p.full_name;

-- admin_fleet_summary keeps its year-wide stats — those are fleet-level totals,
-- not tier-relevant, so they stay as YTD for trend tracking.
