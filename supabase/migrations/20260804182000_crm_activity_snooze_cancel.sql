-- Nhắc việc mềm hơn: hoãn có đếm + đóng có lý do (Boss chốt 05/08/2026).
--
-- Trước đây việc chỉ có 2 trạng thái (mở / xong) — nhân viên không làm kịp thì
-- việc nằm đỏ mãi, hoặc phải bấm "xong" khống. Từ nay:
--   • Hoãn  = đẩy due_at tới ngày mới + snooze_count tăng 1. Không cần cột hạn
--     riêng: nhắc việc sáng, báo cáo EOD, RPC sinh việc đều lọc theo due_at nên
--     tự đúng. EOD soi việc hoãn ≥3 lần cho Boss.
--   • Đóng  = cancelled_at + cancel_reason. KHÔNG tính là "xong" (EOD đếm theo
--     done_at), cũng không tính quá hạn — đường thoát hợp lệ thay vì nói dối.
ALTER TABLE public.crm_activities
    ADD COLUMN snooze_count smallint NOT NULL DEFAULT 0,
    ADD COLUMN cancelled_at timestamptz,
    ADD COLUMN cancel_reason text;

-- View inbox của portal: thêm 3 cột mới. Phải khai lại security_invoker vì
-- CREATE OR REPLACE làm rơi option này (bài học 2026-07).
CREATE OR REPLACE VIEW public.crm_activity_inbox WITH (security_invoker = true) AS
SELECT ac.id, ac.kind, ac.subject, ac.notes, ac.due_at, ac.done_at, ac.outcome,
       ac.account_id, a.name AS account_name, a.phone AS account_phone,
       ac.opportunity_id, o.name AS opportunity_name, ac.contact_id,
       ac.owner_id, ac.created_at, ac.companion_id,
       ac.snooze_count, ac.cancelled_at, ac.cancel_reason
  FROM public.crm_activities ac
  LEFT JOIN public.crm_accounts a ON a.id = ac.account_id
  LEFT JOIN public.crm_opportunities o ON o.id = ac.opportunity_id;

-- Đóng việc cũng để lại vết trên dòng thời gian như hoãn (hoãn = đổi due_at,
-- trigger 20260804140000 đã bắt sẵn). Ghi thêm 2 cột mới vào trigger audit.
DROP TRIGGER IF EXISTS crm_activities_audit_fields ON public.crm_activities;
CREATE TRIGGER crm_activities_audit_fields
    AFTER UPDATE OF kind, subject, notes, due_at, done_at, outcome, cancelled_at, cancel_reason
    ON public.crm_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_audit_fields(
        'kind', 'subject', 'notes', 'due_at', 'done_at', 'outcome',
        'cancelled_at', 'cancel_reason');

-- Máy giao việc hằng ngày: việc ĐÃ ĐÓNG không được tính là "đang mở" nữa —
-- nếu cơ hội/khách vẫn ì thì sáng mai máy sinh việc mới (né được 1 ngày,
-- không né được cả deal). 3 chỗ NOT EXISTS thêm cancelled_at IS NULL.
CREATE OR REPLACE FUNCTION public.crm_auto_daily_tasks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_stale smallint;
    v_due   timestamptz;
    n_opps  integer;
    n_idle  integer;
    n_kpi   integer;
BEGIN
    IF NOT (public.current_role() = 'admin' OR auth.uid() IS NULL) THEN
        RAISE EXCEPTION 'Chỉ admin hoặc tiến trình hệ thống được chạy giao việc tự động';
    END IF;

    SELECT followup_stale_days INTO v_stale FROM public.crm_settings WHERE id;
    v_due := public.crm_auto_task_due();

    -- a) Cơ hội quá hạn hẹn chốt hoặc ì lâu, chưa còn việc nào đang mở
    INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, opportunity_id, owner_id)
    SELECT 'task',
           'Theo dõi lại cơ hội: ' || coalesce(a.name, o.name),
           '[tự động] ' || CASE
               WHEN o.expected_close_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
               THEN 'Quá hạn chốt dự kiến ' || o.expected_close_date || ' — liên hệ chốt lại lịch.'
               ELSE 'Cơ hội không nhúc nhích ' || v_stale || ' ngày — liên hệ đẩy sang bước tiếp.'
           END,
           v_due, o.account_id, o.id, o.owner_id
      FROM public.crm_opportunities o
      JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'open'
      LEFT JOIN public.crm_accounts a ON a.id = o.account_id
     WHERE (o.expected_close_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            OR o.updated_at < now() - make_interval(days => v_stale))
       AND NOT EXISTS (SELECT 1 FROM public.crm_activities ac
                        WHERE ac.opportunity_id = o.id AND ac.kind = 'task'
                          AND ac.done_at IS NULL AND ac.cancelled_at IS NULL);
    GET DIAGNOSTICS n_opps = ROW_COUNT;

    -- b) Khách đang mở nhưng im ắng: hoạt động gần nhất đã quá N ngày
    INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, owner_id)
    SELECT 'task',
           'Hỏi thăm lại khách: ' || a.name,
           '[tự động] Khách không có hoạt động nào ' || v_stale || ' ngày qua — hỏi thăm giữ nhiệt, cập nhật nhu cầu.',
           v_due, a.id, a.owner_id
      FROM public.crm_accounts a
      JOIN public.crm_stages s ON s.id = a.stage_id AND s.forecast = 'open'
     WHERE a.owner_id IS NOT NULL
       AND (SELECT max(ac.created_at) FROM public.crm_activities ac WHERE ac.account_id = a.id)
           < now() - make_interval(days => v_stale)
       AND NOT EXISTS (SELECT 1 FROM public.crm_activities ac
                        WHERE ac.account_id = a.id AND ac.kind = 'task'
                          AND ac.done_at IS NULL AND ac.cancelled_at IS NULL);
    GET DIAGNOSTICS n_idle = ROW_COUNT;

    -- c) Chỉ tiêu khai thác mỗi ngày — mỗi nhân viên giữ đúng một việc đang mở
    INSERT INTO public.crm_activities (kind, subject, notes, due_at, owner_id)
    SELECT 'task',
           'Khai thác khách mới hôm nay',
           '[tự động] Chỉ tiêu ngày: 3–5 khách bán lẻ mới HOẶC 1–3 khách tổ chức mới. Tiến độ xem trang KPI.',
           v_due, p.id
      FROM public.profiles p
     WHERE p.role = 'staff' AND p.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM public.crm_activities ac
                        WHERE ac.owner_id = p.id AND ac.kind = 'task'
                          AND ac.done_at IS NULL AND ac.cancelled_at IS NULL
                          AND ac.subject = 'Khai thác khách mới hôm nay');
    GET DIAGNOSTICS n_kpi = ROW_COUNT;

    RETURN jsonb_build_object('followup_opps', n_opps, 'idle_accounts', n_idle, 'kpi_tasks', n_kpi);
END;
$function$;
