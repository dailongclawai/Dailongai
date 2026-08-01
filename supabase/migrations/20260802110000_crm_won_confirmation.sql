-- Boss chốt 02/08/2026: "Hoàn thành đơn" phải được quản trị xác nhận.
-- Nhân viên chọn Hoàn thành chỉ tạo YÊU CẦU (won_requested_at) — DB chặn hẳn
-- staff tự đẩy cơ hội/khách vào bước thắng. Chỉ quản trị (hoặc luồng thanh toán
-- Casso/service, vốn là bằng chứng tiền thật) mới đưa được vào bước thắng —
-- lúc đó KPI máy và hoa hồng mới tính. Vào bước thắng/thua thì cờ yêu cầu tự xoá.

-- ── 1. Cờ yêu cầu xác nhận trên khách ────────────────────────────────────────

alter table public.crm_accounts
    add column won_requested_at timestamptz,
    add column won_requested_by uuid references public.profiles(id);

-- ── 2. Gate: nhân viên không tự đẩy vào bước thắng ───────────────────────────

create function public.crm_opportunity_won_gate()
returns trigger
language plpgsql
set search_path to 'public'
as $$
DECLARE
    v_new text;
    v_old text;
BEGIN
    SELECT forecast INTO v_new FROM public.crm_stages WHERE id = NEW.stage_id;
    IF v_new = 'won' AND public.current_role() = 'staff' THEN
        IF TG_OP = 'UPDATE' THEN
            SELECT forecast INTO v_old FROM public.crm_stages WHERE id = OLD.stage_id;
        END IF;
        IF TG_OP = 'INSERT' OR v_old IS DISTINCT FROM 'won' THEN
            RAISE EXCEPTION 'Bước "Hoàn thành đơn" cần quản trị xác nhận — chọn Hoàn thành trên trang Khách hàng để gửi yêu cầu.'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

create trigger crm_opportunities_won_gate
    before insert or update of stage_id on public.crm_opportunities
    for each row execute function public.crm_opportunity_won_gate();

create function public.crm_account_won_gate()
returns trigger
language plpgsql
set search_path to 'public'
as $$
DECLARE
    v_new text;
BEGIN
    SELECT forecast INTO v_new FROM public.crm_stages WHERE id = NEW.stage_id;
    IF v_new = 'won' AND public.current_role() = 'staff'
       AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
        RAISE EXCEPTION 'Bước "Hoàn thành đơn" cần quản trị xác nhận — chọn Hoàn thành để gửi yêu cầu.'
            USING ERRCODE = 'check_violation';
    END IF;
    -- Vào bước thắng/thua thì yêu cầu chờ xác nhận khép lại (kể cả yêu cầu
    -- gửi nhầm lên khách đã chốt sổ — cờ tự về NULL).
    IF v_new IN ('won', 'lost') THEN
        NEW.won_requested_at := NULL;
        NEW.won_requested_by := NULL;
    END IF;
    RETURN NEW;
END;
$$;

create trigger crm_accounts_won_gate
    before insert or update on public.crm_accounts
    for each row execute function public.crm_account_won_gate();

-- ── 3. Bảng khách lộ thêm cờ yêu cầu (thêm cột cuối nên OR REPLACE hợp lệ) ────

create or replace view public.crm_account_list
with (security_invoker = true) as
SELECT a.id,
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
    a.org_type,
    a.referrer_profile_id,
    a.linked_profile_id,
    a.owner_id,
    a.created_by,
    a.notes,
    a.created_at,
    a.updated_at,
    o.full_name AS owner_name,
    o.email AS owner_email,
    o.staff_segment AS owner_segment,
    c.full_name AS creator_name,
    c.email AS creator_email,
    (EXISTS ( SELECT 1
           FROM crm_handovers h
          WHERE h.account_id = a.id)) AS was_handed_over,
    crm_account_status(a.id) AS status_label,
    a.stage_id,
    COALESCE(agg.total_quantity, 0) AS total_quantity,
    COALESCE(agg.expected_commission, 0::numeric) AS expected_commission,
    COALESCE(agg.open_deals, 0) AS open_deals,
    crm_account_stage_since(a.id) AS stage_since,
    COALESCE(st.forecast = ANY (ARRAY['won'::text, 'lost'::text]), false) AS stage_locked,
    a.won_requested_at
   FROM crm_accounts a
     LEFT JOIN crm_staff_directory o ON o.id = a.owner_id
     LEFT JOIN crm_staff_directory c ON c.id = a.created_by
     LEFT JOIN crm_stages st ON st.id = a.stage_id
     LEFT JOIN LATERAL ( SELECT sum(op.quantity)::integer AS total_quantity,
            round(sum(op.amount) * max(cfg.staff_rate), 2) AS expected_commission,
            count(*) FILTER (WHERE st2.forecast = 'open'::text)::integer AS open_deals
           FROM crm_opportunities op
             JOIN crm_stages st2 ON st2.id = op.stage_id
             CROSS JOIN crm_settings cfg
          WHERE op.account_id = a.id AND st2.forecast <> 'lost'::text) agg ON true;
