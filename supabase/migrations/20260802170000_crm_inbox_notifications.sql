-- Nối sự kiện CRM vào hộp Thông báo (portal_messages). Boss duyệt 02/08/2026.
-- Trước nay chỉ pipeline đại lý sinh thông báo (dòng mới nhất 25/05) — luồng
-- staff CRM hoàn toàn im lặng. Bốn sự kiện đáng báo:
--   1) Nhân viên gửi yêu cầu xác nhận hoàn thành → báo mọi admin.
--   2) Khách vào bước thắng (admin duyệt / tiền về) → báo người phụ trách.
--   3) Hoa hồng chuyển sang chi được (payable) → báo nhân viên.
--   4) Góp ý mới → báo mọi admin.

-- Thêm nhãn 'crm' vào CHECK category (tên constraint tra động cho chắc)
DO $$
DECLARE v_name text;
BEGIN
    SELECT conname INTO v_name FROM pg_constraint
     WHERE conrelid = 'public.portal_messages'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%category%';
    EXECUTE format('ALTER TABLE public.portal_messages DROP CONSTRAINT %I', v_name);
END $$;
ALTER TABLE public.portal_messages ADD CONSTRAINT portal_messages_category_check
    CHECK (category = ANY (ARRAY['order','commission','payout','legal','policy','system','general','crm']));

-- ── 1. Yêu cầu xác nhận hoàn thành → admin ──────────────────────────────────

create function public.crm_notify_won_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
    IF NEW.won_requested_at IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.won_requested_at IS NULL) THEN
        INSERT INTO public.portal_messages
            (recipient_id, sender_id, subject, body, category, severity, action_url, action_label)
        SELECT p.id, NEW.won_requested_by,
               'Yêu cầu xác nhận hoàn thành: ' || NEW.name,
               coalesce((SELECT full_name FROM public.profiles WHERE id = NEW.won_requested_by), 'Nhân viên')
                   || ' đề nghị xác nhận hoàn thành cho khách ' || NEW.name || '.',
               'crm', 'info', '/portal/crm/accounts', 'Mở bảng khách'
          FROM public.profiles p
         WHERE p.role = 'admin' AND p.status = 'active';
    END IF;
    RETURN NEW;
END;
$$;

create trigger crm_accounts_notify_won_request
    after insert or update of won_requested_at on public.crm_accounts
    for each row execute function public.crm_notify_won_request();

-- ── 2. Khách vào bước thắng → người phụ trách ────────────────────────────────

create function public.crm_notify_won_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id
       AND NEW.owner_id IS NOT NULL
       AND (SELECT forecast FROM public.crm_stages WHERE id = NEW.stage_id) = 'won' THEN
        INSERT INTO public.portal_messages
            (recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (NEW.owner_id,
                'Khách đã xác nhận hoàn thành: ' || NEW.name,
                'Khách ' || NEW.name || ' đã vào bước Hoàn thành đơn. Máy tính vào KPI tháng; hoa hồng chốt theo đơn thanh toán.',
                'crm', 'success', '/portal/crm/kpi', 'Xem KPI');
    END IF;
    RETURN NEW;
END;
$$;

create trigger crm_accounts_notify_won_confirmed
    after update of stage_id on public.crm_accounts
    for each row execute function public.crm_notify_won_confirmed();

-- ── 3. Hoa hồng chi được → nhân viên ─────────────────────────────────────────

create function public.crm_notify_commission_payable()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
    IF NEW.status = 'payable'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'payable') THEN
        INSERT INTO public.portal_messages
            (recipient_id, subject, body, category, severity, action_url, action_label)
        VALUES (NEW.staff_id,
                'Hoa hồng sẵn sàng chi: ' || to_char(NEW.amount, 'FM999G999G999G999') || 'đ',
                'Hoa hồng của bạn đã hết thời gian treo và chuyển sang trạng thái chi được.',
                'commission', 'success', '/portal/crm/commission', 'Xem hoa hồng');
    END IF;
    RETURN NEW;
END;
$$;

create trigger crm_commissions_notify_payable
    after insert or update of status on public.crm_staff_commissions
    for each row execute function public.crm_notify_commission_payable();

-- ── 4. Góp ý mới → admin ─────────────────────────────────────────────────────

create function public.crm_notify_feedback()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
    INSERT INTO public.portal_messages
        (recipient_id, sender_id, subject, body, category, severity, action_url, action_label)
    SELECT p.id, NEW.staff_id,
           'Góp ý CRM mới',
           left(NEW.content, 160),
           'crm', 'info', '/portal/crm/feedback', 'Mở hộp góp ý'
      FROM public.profiles p
     WHERE p.role = 'admin' AND p.status = 'active';
    RETURN NEW;
END;
$$;

create trigger crm_feedbacks_notify_admin
    after insert on public.crm_feedbacks
    for each row execute function public.crm_notify_feedback();
