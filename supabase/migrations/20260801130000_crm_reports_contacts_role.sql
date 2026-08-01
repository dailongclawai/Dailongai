-- Boss duyệt 01/08/2026 (đợt 2): làm nốt nhóm báo cáo + lộ role trong danh bạ.
--
-- 1. crm_staff_directory thêm cột role: dropdown bàn giao phải ẩn hẳn tài khoản
--    quản trị thay vì để RPC từ chối sau khi đã chọn.
-- 2. Ba khung nhìn báo cáo cho quản trị, đều gộp trước rồi mới join để không
--    dính lỗi nhân số như crm_staff_report từng bị:
--      • crm_report_monthly     — 12 tháng gần nhất: deal chốt, giá trị, khách mới, hoa hồng
--      • crm_report_lost_reasons — đếm theo lý do không mua
--      • crm_report_sources      — hiệu quả theo nguồn khách
--    Mốc thời gian đổi về giờ Việt Nam trước khi cắt tháng, kẻo deal chốt tối
--    01/08 giờ VN bị tính sang tháng 7 theo UTC.

-- ── 1. Danh bạ nhân viên lộ thêm role ────────────────────────────────────────
CREATE OR REPLACE VIEW public.crm_staff_directory AS
SELECT id,
    full_name,
    email,
    staff_segment,
    role
FROM public.profiles p
WHERE (role = ANY (ARRAY['staff'::profile_role, 'admin'::profile_role]))
  AND status = 'active'::profile_status
  AND public.crm_role_allowed();

GRANT SELECT ON public.crm_staff_directory TO authenticated;

-- ── 2a. Doanh số theo tháng ──────────────────────────────────────────────────
DROP VIEW IF EXISTS public.crm_report_monthly;
CREATE VIEW public.crm_report_monthly AS
WITH thang AS (
    SELECT date_trunc('month', d)::date AS thang
    FROM generate_series(
        date_trunc('month', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')) - interval '11 months',
        date_trunc('month', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')),
        interval '1 month'
    ) d
),
chot AS (
    SELECT date_trunc('month', o.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS thang,
           count(*)      AS deals_won,
           sum(o.amount) AS won_value
    FROM public.crm_opportunities o
    JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'won'
    WHERE o.closed_at IS NOT NULL
    GROUP BY 1
),
khach AS (
    SELECT date_trunc('month', a.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS thang,
           count(*) AS new_accounts
    FROM public.crm_accounts a
    GROUP BY 1
),
hh AS (
    SELECT date_trunc('month', c.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS thang,
           sum(c.amount) AS commission_total
    FROM public.crm_staff_commissions c
    WHERE c.status <> 'void'
    GROUP BY 1
)
SELECT
    t.thang,
    COALESCE(chot.deals_won, 0)        AS deals_won,
    COALESCE(chot.won_value, 0)        AS won_value,
    COALESCE(khach.new_accounts, 0)    AS new_accounts,
    COALESCE(hh.commission_total, 0)   AS commission_total
FROM thang t
LEFT JOIN chot  ON chot.thang  = t.thang
LEFT JOIN khach ON khach.thang = t.thang
LEFT JOIN hh    ON hh.thang    = t.thang
WHERE public.current_role() = 'admin'
ORDER BY t.thang DESC;

GRANT SELECT ON public.crm_report_monthly TO authenticated;

-- ── 2b. Lý do không mua ──────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.crm_report_lost_reasons;
CREATE VIEW public.crm_report_lost_reasons AS
SELECT
    lr.name,
    count(o.id)                 AS deals_lost,
    COALESCE(sum(o.amount), 0)  AS lost_value
FROM public.crm_lost_reasons lr
LEFT JOIN public.crm_opportunities o ON o.lost_reason_id = lr.id
LEFT JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'lost'
WHERE public.current_role() = 'admin'
GROUP BY lr.id, lr.name, lr.sort_order
HAVING count(o.id) > 0
ORDER BY count(o.id) DESC, lr.sort_order;

GRANT SELECT ON public.crm_report_lost_reasons TO authenticated;

-- ── 2c. Hiệu quả theo nguồn khách ────────────────────────────────────────────
-- Mỗi cơ hội chỉ xuất hiện một lần dưới đúng một khách nên sum không bị nhân.
DROP VIEW IF EXISTS public.crm_report_sources;
CREATE VIEW public.crm_report_sources AS
SELECT
    a.source::text                                            AS source,
    count(DISTINCT a.id)                                      AS accounts,
    count(o.id) FILTER (WHERE s.forecast = 'won')             AS deals_won,
    COALESCE(sum(o.amount) FILTER (WHERE s.forecast = 'won'), 0) AS won_value
FROM public.crm_accounts a
LEFT JOIN public.crm_opportunities o ON o.account_id = a.id
LEFT JOIN public.crm_stages s ON s.id = o.stage_id
WHERE public.current_role() = 'admin'
GROUP BY a.source
ORDER BY count(DISTINCT a.id) DESC;

GRANT SELECT ON public.crm_report_sources TO authenticated;
