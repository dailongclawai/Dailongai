-- View đọc cho kanban + danh sách hoạt động.
-- security_invoker = true để RLS của bảng gốc vẫn áp dụng cho người gọi.

CREATE OR REPLACE VIEW public.crm_opportunity_board
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.code,
    o.name,
    o.pipeline,
    o.stage_id,
    s.name          AS stage_name,
    s.probability,
    s.forecast,
    s.sort_order,
    o.amount,
    o.quantity,
    o.expected_close_date,
    o.owner_id,
    p.full_name     AS owner_name,
    o.account_id,
    a.name          AS account_name,
    a.phone         AS account_phone,
    a.kind          AS account_kind,
    o.contact_id,
    o.model_id,
    o.order_id,
    o.closed_at,
    o.lost_reason,
    o.created_at
FROM public.crm_opportunities o
JOIN public.crm_stages   s ON s.id = o.stage_id
LEFT JOIN public.crm_accounts a ON a.id = o.account_id
LEFT JOIN public.profiles p ON p.id = o.owner_id;

CREATE OR REPLACE VIEW public.crm_activity_inbox
WITH (security_invoker = true) AS
SELECT
    ac.id,
    ac.kind,
    ac.subject,
    ac.notes,
    ac.due_at,
    ac.done_at,
    ac.outcome,
    ac.account_id,
    a.name  AS account_name,
    a.phone AS account_phone,
    ac.opportunity_id,
    o.name  AS opportunity_name,
    ac.contact_id,
    ac.owner_id,
    ac.created_at
FROM public.crm_activities ac
LEFT JOIN public.crm_accounts a ON a.id = ac.account_id
LEFT JOIN public.crm_opportunities o ON o.id = ac.opportunity_id;

GRANT SELECT ON public.crm_opportunity_board TO authenticated;
GRANT SELECT ON public.crm_activity_inbox TO authenticated;
