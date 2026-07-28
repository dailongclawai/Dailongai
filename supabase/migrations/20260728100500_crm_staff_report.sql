-- Báo cáo tổng hợp theo staff. CHỈ ADMIN (Boss chốt 28/07/2026).
-- KHÔNG dùng security_invoker: view này cố tình đọc xuyên RLS, nên tự chặn
-- bằng điều kiện vai trò trong thân view — không phải admin thì trả 0 dòng.

CREATE OR REPLACE VIEW public.crm_staff_report AS
SELECT
    p.id                                     AS staff_id,
    p.full_name                              AS staff_name,
    p.email                                  AS staff_email,
    p.staff_segment,
    count(DISTINCT o.id) FILTER (WHERE s.forecast = 'won')   AS deals_won,
    count(DISTINCT o.id) FILTER (WHERE s.forecast = 'open')  AS deals_open,
    coalesce(sum(c.amount) FILTER (WHERE c.role_in_deal = 'closer'), 0)   AS commission_closer,
    coalesce(sum(c.amount) FILTER (WHERE c.role_in_deal = 'referrer'), 0) AS commission_referral,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'pending'), 0)  AS amount_pending,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'payable'), 0)  AS amount_payable,
    coalesce(sum(c.amount) FILTER (WHERE c.status = 'paid'), 0)     AS amount_paid
FROM public.profiles p
LEFT JOIN public.crm_opportunities o ON o.owner_id = p.id
LEFT JOIN public.crm_stages s ON s.id = o.stage_id
LEFT JOIN public.crm_staff_commissions c ON c.staff_id = p.id
WHERE p.role = 'staff'
  AND public.current_role() = 'admin'
GROUP BY p.id, p.full_name, p.email, p.staff_segment;

GRANT SELECT ON public.crm_staff_report TO authenticated;
