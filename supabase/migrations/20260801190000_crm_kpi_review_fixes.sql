-- Sửa 3 lỗi review của bộ KPI (phát hiện 01/08/2026, trước khi phát hành UI):
--   1) Policy đọc bucket crm-evidence viết `name` không định danh bảng nên
--      Postgres bind vào crm_accounts.name — vừa chặn toàn bộ người hợp lệ,
--      vừa cho staff đọc cả bucket qua một dòng chứng cứ tự chế.
--   2) Quyền chứng cứ neo theo đúng quyền nhìn khách (RLS crm_accounts, gồm cả
--      nhánh bàn giao) thay vì crm_owner_visible cứng; insert khoá file_path
--      vào thư mục storage của chính người tải.
--   3) Thưởng +5% neo theo THÁNG CHỐT THẮNG và vị trí lũy kế của chính đơn
--      trong tháng, không theo ngày thanh toán — trả tiền trễ, vắt tháng hay
--      lệch thứ tự đều không làm sai thưởng.

-- ── 1 + 2. Quyền chứng cứ ────────────────────────────────────────────────────

drop policy crm_evidence_read on storage.objects;
create policy crm_evidence_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'crm-evidence'
        and public.crm_role_allowed()
        -- RLS của crm_evidences tự áp trong subquery: thấy dòng chứng cứ nào
        -- thì mới đọc được file của dòng đó.
        and exists (
            select 1 from public.crm_evidences e
            where e.file_path = storage.objects.name
        )
    );

drop policy crm_evidences_select on public.crm_evidences;
create policy crm_evidences_select on public.crm_evidences
    for select to authenticated
    using (
        public.crm_role_allowed()
        -- RLS của crm_accounts tự áp trong subquery: ai nhìn thấy khách (chủ
        -- hiện tại, admin, hay người đã bàn giao) thì thấy chứng cứ của khách.
        and exists (select 1 from public.crm_accounts a where a.id = account_id)
    );

drop policy crm_evidences_insert on public.crm_evidences;
create policy crm_evidences_insert on public.crm_evidences
    for insert to authenticated
    with check (
        public.crm_role_allowed()
        and uploaded_by = auth.uid()
        -- File phải nằm trong thư mục của chính người tải — chặn trỏ file_path
        -- sang object người khác để mượn policy đọc ở trên.
        and split_part(file_path, '/', 1) = (auth.uid())::text
        and exists (
            select 1 from public.crm_accounts a
            where a.id = account_id
              and (a.owner_id = auth.uid() or public.current_role() = 'admin')
        )
    );

-- ── 3. Thưởng +5% từ máy thứ 10 trong tháng chốt thắng ───────────────────────

create or replace function public.crm_accrue_staff_commission_on_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
    v_opp         public.crm_opportunities;
    v_owner_role  public.profile_role;
    v_rate        numeric(5,4);
    v_won_stage   uuid;
    v_eligible_at timestamptz;
    v_status      text;
    v_closed      timestamptz;
    v_before      integer;
BEGIN
    IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_opp
      FROM public.crm_opportunities
     WHERE order_id = NEW.id
     ORDER BY created_at
     LIMIT 1;
    IF v_opp.id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_won_stage
      FROM public.crm_stages WHERE forecast = 'won' AND active ORDER BY sort_order LIMIT 1;

    IF v_won_stage IS NOT NULL THEN
        IF v_opp.stage_id IS DISTINCT FROM v_won_stage THEN
            UPDATE public.crm_opportunities SET stage_id = v_won_stage WHERE id = v_opp.id;
        END IF;
        UPDATE public.crm_accounts
           SET stage_id = v_won_stage
         WHERE id = v_opp.account_id AND stage_id IS DISTINCT FROM v_won_stage;
    END IF;

    SELECT role INTO v_owner_role FROM public.profiles WHERE id = v_opp.owner_id;
    IF v_owner_role <> 'staff' THEN
        RETURN NEW;   -- admin tự chốt hộ thì không phát sinh hoa hồng
    END IF;

    SELECT staff_rate INTO v_rate FROM public.crm_settings WHERE id;

    -- KPI Boss 01/08/2026: đơn CHỨA máy thứ 10 trở đi trong tháng được +5%
    -- trên giá đơn. Máy xếp thứ tự theo closed_at trong tháng chốt thắng
    -- (giờ VN) — cùng thước đo với crm_kpi_device_month — nên thanh toán trễ
    -- hay về lệch thứ tự không làm sai thưởng. v_opp chụp trước khi đẩy won:
    -- closed_at còn NULL nghĩa là câu UPDATE ở trên vừa điền now() (cùng
    -- transaction) — COALESCE cho ra đúng mốc đó.
    v_closed := COALESCE(v_opp.closed_at, now());
    SELECT COALESCE(sum(o.quantity), 0) INTO v_before
      FROM public.crm_opportunities o
      JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'won'
     WHERE o.owner_id = v_opp.owner_id
       AND o.id <> v_opp.id
       AND o.closed_at IS NOT NULL
       AND date_trunc('month', o.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
         = date_trunc('month', v_closed AT TIME ZONE 'Asia/Ho_Chi_Minh')
       AND (o.closed_at, o.id) < (v_closed, v_opp.id);
    IF v_before + v_opp.quantity >= 10 THEN
        v_rate := v_rate + 0.05;
    END IF;

    -- Có dùng thử thì treo lại tới khi hết hạn; không thì chi được ngay.
    IF v_opp.trial_days IS NULL THEN
        v_eligible_at := now();
        v_status := 'payable';
    ELSE
        v_eligible_at := now() + (v_opp.trial_days || ' days')::interval;
        v_status := 'pending';
    END IF;

    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, order_id, order_value, rate, amount, status, eligible_at)
    VALUES (v_opp.id, v_opp.owner_id, NEW.id, NEW.sale_price, v_rate,
            round(NEW.sale_price * v_rate, 2), v_status, v_eligible_at)
    ON CONFLICT (opportunity_id, staff_id) DO NOTHING;

    RETURN NEW;
END;
$$;
