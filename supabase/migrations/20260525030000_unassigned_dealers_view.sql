-- supabase/migrations/20260525030000_unassigned_dealers_view.sql
CREATE OR REPLACE VIEW public.unassigned_dealers_summary AS
SELECT
  p.id                                                                  AS dealer_id,
  p.full_name                                                           AS dealer_name,
  p.account_no                                                          AS dealer_account_no,
  COUNT(o.id) FILTER (
    WHERE o.status = 'pending'
  )::int                                                                AS orders_pending,
  COUNT(o.id) FILTER (
    WHERE o.status IN ('approved', 'paid')
    AND date_trunc('month', o.sale_date) = date_trunc('month', CURRENT_DATE)
  )::int                                                                AS units_ytd,
  COALESCE(SUM(o.sale_price) FILTER (
    WHERE o.status IN ('approved', 'paid')
    AND date_trunc('month', o.sale_date) = date_trunc('month', CURRENT_DATE)
  ), 0)                                                                 AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer'
  AND p.status = 'active'
  AND p.supervisor_id IS NULL
GROUP BY p.id, p.full_name, p.account_no;

GRANT SELECT ON public.unassigned_dealers_summary TO authenticated;
