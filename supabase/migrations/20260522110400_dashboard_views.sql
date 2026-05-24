-- Views run with the querying user's privileges (security_invoker) so RLS on
-- underlying tables (orders, commission_payouts, profiles) still applies.
CREATE VIEW public.dealer_dashboard_summary
WITH (security_invoker = true) AS
SELECT
    o.dealer_id,
    count(*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(*) FILTER (WHERE o.status = 'approved') AS orders_approved,
    count(*) FILTER (WHERE o.status = 'paid') AS orders_paid,
    count(*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (WHERE date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())), 0) AS month_sales,
    coalesce((SELECT sum(cp.amount) FROM public.commission_payouts cp WHERE cp.recipient_id = o.dealer_id AND cp.recipient_role='dealer' AND cp.paid_at IS NULL AND cp.voided_at IS NULL), 0) AS commission_pending,
    coalesce((SELECT sum(cp.amount) FROM public.commission_payouts cp WHERE cp.recipient_id = o.dealer_id AND cp.recipient_role='dealer' AND cp.paid_at IS NOT NULL), 0) AS commission_paid
FROM public.orders o
GROUP BY o.dealer_id;

CREATE VIEW public.supervisor_team_summary
WITH (security_invoker = true) AS
SELECT
    p.supervisor_id,
    p.id AS dealer_id,
    p.full_name AS dealer_name,
    count(o.*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(o.*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (WHERE date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())), 0) AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer' AND p.supervisor_id IS NOT NULL
GROUP BY p.supervisor_id, p.id, p.full_name;

CREATE VIEW public.admin_fleet_summary
WITH (security_invoker = true) AS
SELECT
    count(DISTINCT o.dealer_id) FILTER (WHERE o.status IN ('approved','paid')) AS active_dealers,
    count(*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    count(*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())) AS units_month,
    count(*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    coalesce(sum(o.sale_price) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())), 0) AS revenue_ytd,
    coalesce((SELECT sum(amount) FROM public.commission_payouts WHERE paid_at IS NULL AND voided_at IS NULL), 0) AS commission_pending
FROM public.orders o;
