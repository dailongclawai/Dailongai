-- Gói tự động hoá đợt 2 — Boss chốt 02/08/2026: portal staff tự đăng việc cần
-- làm, tự dọn việc thừa, hoa hồng đến hạn tự nhả. Nhân viên chỉ làm việc với
-- khách, không làm việc với phần mềm.
--   1) Khách mới có người phụ trách → task "Liên hệ khách mới" sinh NGAY.
--   2) Cơ hội đổi bước → task playbook theo bước (trải nghiệm/đàm phán/chốt đơn/
--      đồng hành CS-HT30). Chống spam kéo qua lại bằng guard cùng tiêu đề đang mở.
--   3) Khách chốt sổ thắng/thua → task [tự động] còn mở tự đóng (giữ lại task
--      chăm sóc đồng hành sau thắng).
--   4) crm_release_due_commissions cho phép tiến trình hệ thống gọi — cron VPS
--      nhả hoa hồng đến hạn hằng ngày, admin khỏi bấm tay.

-- ── 0. Giờ hẹn việc tự động — cùng nếp với crm_auto_followup_tasks ───────────

create function public.crm_auto_task_due()
returns timestamptz
language sql
stable
set search_path to 'public'
as $$
    select case
        when (now() at time zone 'Asia/Ho_Chi_Minh')::time < time '16:00'
        then ((now() at time zone 'Asia/Ho_Chi_Minh')::date + time '17:00') at time zone 'Asia/Ho_Chi_Minh'
        else ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1 + time '10:00') at time zone 'Asia/Ho_Chi_Minh'
    end;
$$;

-- ── 1. Khách mới → việc đầu tiên sinh ngay ───────────────────────────────────

create function public.crm_account_first_touch_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
    IF NEW.owner_id IS NULL THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, owner_id)
    VALUES ('task',
            'Liên hệ khách mới: ' || NEW.name,
            '[tự động] Việc đầu tiên khi nhận khách — gọi/nhắn làm quen, xác nhận nhu cầu.',
            public.crm_auto_task_due(), NEW.id, NEW.owner_id);
    RETURN NEW;
END;
$$;

create trigger crm_accounts_first_touch
    after insert on public.crm_accounts
    for each row execute function public.crm_account_first_touch_task();

-- ── 2. Đổi bước → task playbook ──────────────────────────────────────────────

create function public.crm_opportunity_stage_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
    v_stage   public.crm_stages;
    v_subject text;
    v_notes   text;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
        RETURN NEW;
    END IF;
    SELECT * INTO v_stage FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_stage.name = 'Đã trải nghiệm máy' THEN
        v_subject := 'Hỏi cảm nhận sau trải nghiệm: ';
        v_notes   := '[tự động] Gọi hỏi cảm nhận sau buổi trải nghiệm máy, ghi phản hồi vào hoạt động.';
    ELSIF v_stage.name = 'Đàm phán giá' THEN
        v_subject := 'Chốt giá với khách: ';
        v_notes   := '[tự động] Khách đang đàm phán — chốt giá và ghi vào ô Giá trị của thẻ cơ hội.';
    ELSIF v_stage.name = 'Chốt đơn' THEN
        v_subject := 'Theo dõi thanh toán: ';
        v_notes   := '[tự động] Đơn đã chốt — hướng dẫn khách thanh toán; hệ thống tự gắn đơn theo SĐT.';
    ELSIF v_stage.forecast = 'won' AND NEW.trial_days IS NOT NULL THEN
        v_subject := 'Đưa khách vào nhóm Zalo đồng hành 30 ngày: ';
        v_notes   := '[tự động] Chương trình CS-HT30: mời vào nhóm Zalo, hướng dẫn 2 buổi/ngày và lịch Phiếu A/B.';
    ELSE
        RETURN NEW;
    END IF;

    v_subject := v_subject || coalesce(
        (SELECT a.name FROM public.crm_accounts a WHERE a.id = NEW.account_id), NEW.name);

    -- Kéo thẻ qua lại không được nhân đôi việc: còn việc cùng tiêu đề đang mở thì thôi.
    IF EXISTS (SELECT 1 FROM public.crm_activities ac
                WHERE ac.opportunity_id = NEW.id AND ac.done_at IS NULL AND ac.subject = v_subject) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, opportunity_id, owner_id)
    VALUES ('task', v_subject, v_notes, public.crm_auto_task_due(), NEW.account_id, NEW.id, NEW.owner_id);
    RETURN NEW;
END;
$$;

create trigger crm_opportunities_stage_task
    after insert or update of stage_id on public.crm_opportunities
    for each row execute function public.crm_opportunity_stage_task();

-- ── 3. Khách chốt sổ → tự đóng việc [tự động] còn mở ─────────────────────────

create function public.crm_account_close_auto_tasks()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
    v_forecast text;
BEGIN
    IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
        RETURN NEW;
    END IF;
    SELECT forecast INTO v_forecast FROM public.crm_stages WHERE id = NEW.stage_id;
    IF v_forecast IN ('won', 'lost') THEN
        UPDATE public.crm_activities
           SET done_at = now()
         WHERE account_id = NEW.id
           AND done_at IS NULL
           AND kind = 'task'
           AND notes LIKE '[tự động]%'
           -- Việc chăm sóc đồng hành sau thắng vẫn phải làm — không tự đóng.
           AND subject NOT LIKE 'Đưa khách vào nhóm Zalo%';
    END IF;
    RETURN NEW;
END;
$$;

create trigger crm_accounts_close_auto_tasks
    after update of stage_id on public.crm_accounts
    for each row execute function public.crm_account_close_auto_tasks();

-- ── 4. Hoa hồng đến hạn: cho tiến trình hệ thống gọi (cron VPS hằng ngày) ────

create or replace function public.crm_release_due_commissions()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE v_count integer;
BEGIN
    -- Admin bấm tay, hoặc tiến trình hệ thống (service role — auth.uid() NULL).
    IF NOT (public.current_role() = 'admin' OR auth.uid() IS NULL) THEN
        RAISE EXCEPTION 'Chỉ admin hoặc tiến trình hệ thống được giải phóng hoa hồng đến hạn';
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'payable'
     WHERE status = 'pending' AND eligible_at <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.write_audit('release_due_commissions', 'crm_staff_commissions', NULL,
        NULL, jsonb_build_object('rows', v_count));
    RETURN v_count;
END;
$$;

grant execute on function public.crm_release_due_commissions() to service_role;
