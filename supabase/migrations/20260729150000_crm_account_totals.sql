-- Bảng Khách hàng hiện số máy và hoa hồng dự kiến của từng khách.
--
-- Boss báo 29/07/2026: hai con số này mới chỉ có ở bảng Cơ hội, chưa có ở bảng
-- Khách hàng — nơi nhân viên nhìn hằng ngày.
--
-- Cộng dồn từ các cơ hội của khách, BỎ QUA cơ hội đã thua: khách không mua thì
-- không tính là máy khách đặt.
--
-- View để security_invoker nên phép cộng chạy dưới quyền người đang xem: nhân
-- viên chỉ cộng cơ hội của chính mình. Đúng nghĩa "hoa hồng dự kiến của staff",
-- không phải tổng của cả công ty.

CREATE OR REPLACE VIEW public.crm_account_list
WITH (security_invoker = true) AS
SELECT
    a.id,
    a.code,
    a.kind,
    a.name,
    a.is_individual,
    a.phone,
    a.email,
    a.zalo_phone,
    a.tax_code,
    a.province,
    a.address,
    a.source,
    a.referrer_profile_id,
    a.linked_profile_id,
    a.owner_id,
    a.created_by,
    a.notes,
    a.created_at,
    a.updated_at,
    o.full_name      AS owner_name,
    o.email          AS owner_email,
    o.staff_segment  AS owner_segment,
    c.full_name      AS creator_name,
    c.email          AS creator_email,
    EXISTS (
        SELECT 1 FROM public.crm_handovers h
        WHERE h.account_id = a.id
    )                AS was_handed_over,
    public.crm_account_status(a.id) AS status_label,
    a.stage_id,
    COALESCE(agg.total_quantity, 0)      AS total_quantity,
    COALESCE(agg.expected_commission, 0) AS expected_commission,
    COALESCE(agg.open_deals, 0)          AS open_deals
FROM public.crm_accounts a
LEFT JOIN public.crm_staff_directory o ON o.id = a.owner_id
LEFT JOIN public.crm_staff_directory c ON c.id = a.created_by
LEFT JOIN LATERAL (
    SELECT
        sum(op.quantity)::int                              AS total_quantity,
        round(sum(op.amount) * max(cfg.staff_rate), 2)     AS expected_commission,
        count(*) FILTER (WHERE st.forecast = 'open')::int  AS open_deals
    FROM public.crm_opportunities op
    JOIN public.crm_stages st ON st.id = op.stage_id
    CROSS JOIN public.crm_settings cfg
    WHERE op.account_id = a.id
      AND st.forecast <> 'lost'
) agg ON true;

GRANT SELECT ON public.crm_account_list TO authenticated;
