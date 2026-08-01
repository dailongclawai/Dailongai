-- Máy giao việc hằng ngày — Boss chốt 02/08/2026: trang Hoạt động là hàng đợi
-- việc do HỆ THỐNG phát, nhân viên không phải tự tạo việc. Chạy 8h sáng VN cùng
-- cron nhắc việc (crm-reminders.js) nên việc vừa giao là vào luôn tin Telegram sáng.
--   a) Cơ hội quá hạn chốt dự kiến hoặc ì quá followup_stale_days → việc theo dõi lại.
--   b) Khách đang mở nhưng không có hoạt động nào N ngày → việc hỏi thăm giữ nhiệt.
--   c) Mỗi nhân viên một việc "Khai thác khách mới hôm nay" theo chỉ tiêu KPI ngày.
-- Mọi nhánh đều có guard: còn việc đang mở thì không giao chồng.

create function public.crm_auto_daily_tasks()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
                        WHERE ac.opportunity_id = o.id AND ac.kind = 'task' AND ac.done_at IS NULL);
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
                        WHERE ac.account_id = a.id AND ac.kind = 'task' AND ac.done_at IS NULL);
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
                        WHERE ac.owner_id = p.id AND ac.kind = 'task' AND ac.done_at IS NULL
                          AND ac.subject = 'Khai thác khách mới hôm nay');
    GET DIAGNOSTICS n_kpi = ROW_COUNT;

    RETURN jsonb_build_object('followup_opps', n_opps, 'idle_accounts', n_idle, 'kpi_tasks', n_kpi);
END;
$$;

revoke execute on function public.crm_auto_daily_tasks() from public, anon;
grant execute on function public.crm_auto_daily_tasks() to authenticated, service_role;
