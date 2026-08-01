-- Bộ KPI nhân viên kinh doanh + chứng cứ khách hàng thật. Boss chốt 01/08/2026:
--   * Máy = tổng quantity của cơ hội thắng, tính theo tháng lịch giờ Việt Nam
--     (cùng thước đo với crm_target_progress: closed_at đổi múi giờ VN).
--   * Tháng đầu tiên (tháng tạo tài khoản nhân viên): đạt 3 máy, trên 5 là rất tốt.
--   * Từ tháng thứ 2: đạt 5 máy, trên 10 là xuất sắc.
--   * Đơn hàng chứa máy thứ 10 trở đi trong tháng: cộng 5% hoa hồng trên giá đơn.
--   * Khách mới mỗi ngày: 3–5 khách bán lẻ hoặc 1–3 khách tổ chức.
--   * Nhân viên đăng tải chứng cứ (màn hình giao dịch, ảnh tại cơ sở khách) theo từng khách.

-- ── 1. Chứng cứ khách hàng thật ──────────────────────────────────────────────

create table public.crm_evidences (
    id          uuid primary key default gen_random_uuid(),
    account_id  uuid not null references public.crm_accounts(id) on delete cascade,
    uploaded_by uuid not null references public.profiles(id) on delete cascade,
    kind        text not null default 'giao_dich' check (kind in ('giao_dich', 'co_so', 'khac')),
    file_path   text not null,
    note        text,
    created_at  timestamptz not null default now()
);

create index crm_evidences_account_idx on public.crm_evidences (account_id, created_at desc);

alter table public.crm_evidences enable row level security;

create policy crm_evidences_select on public.crm_evidences
    for select to authenticated
    using (
        public.crm_role_allowed() and exists (
            select 1 from public.crm_accounts a
            where a.id = account_id and public.crm_owner_visible(a.owner_id)
        )
    );

create policy crm_evidences_insert on public.crm_evidences
    for insert to authenticated
    with check (
        public.crm_role_allowed()
        and uploaded_by = auth.uid()
        and exists (
            select 1 from public.crm_accounts a
            where a.id = account_id
              and (a.owner_id = auth.uid() or public.current_role() = 'admin')
        )
    );

-- Bucket riêng, file xếp theo thư mục người tải lên (cùng nếp với bucket receipts).
insert into storage.buckets (id, name, public)
values ('crm-evidence', 'crm-evidence', false)
on conflict (id) do nothing;

create policy crm_evidence_upload on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'crm-evidence'
        and public.crm_role_allowed()
        and (storage.foldername(name))[1] = (auth.uid())::text
    );

-- Đọc theo dòng chứng cứ chứ không theo người tải: sau bàn giao khách, người
-- phụ trách mới vẫn xem được chứng cứ người cũ đăng.
create policy crm_evidence_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'crm-evidence'
        and public.crm_role_allowed()
        and exists (
            select 1
            from public.crm_evidences e
            join public.crm_accounts a on a.id = e.account_id
            where e.file_path = name and public.crm_owner_visible(a.owner_id)
        )
    );

-- ── 2. KPI máy theo tháng (12 tháng gần nhất) ────────────────────────────────
-- security_invoker: RLS của profiles (chỉ đọc mình) và crm_opportunities tự cắt
-- dữ liệu — nhân viên thấy đúng dòng của mình, admin thấy cả đội.

create view public.crm_kpi_device_month
with (security_invoker = true) as
with months as (
    select (date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')
            - make_interval(months => g))::date as thang
    from generate_series(0, 11) g
),
staff as (
    select p.id, p.full_name,
           date_trunc('month', p.created_at at time zone 'Asia/Ho_Chi_Minh')::date as thang_dau
    from public.profiles p
    where p.role = 'staff' and p.status = 'active'
),
won as (
    select o.owner_id,
           date_trunc('month', o.closed_at at time zone 'Asia/Ho_Chi_Minh')::date as thang,
           sum(o.quantity)::int as devices_won,
           count(*)::int        as won_deals,
           sum(o.amount)        as won_value
    from public.crm_opportunities o
    join public.crm_stages s on s.id = o.stage_id and s.forecast = 'won'
    where o.closed_at is not null
    group by 1, 2
)
select st.id        as staff_id,
       st.full_name,
       m.thang,
       tm.tenure_month,
       case when tm.tenure_month <= 1 then 3 else 5 end  as kpi_target,
       case when tm.tenure_month <= 1 then 5 else 10 end as kpi_excellent,
       coalesce(w.devices_won, 0) as devices_won,
       coalesce(w.won_deals, 0)   as won_deals,
       coalesce(w.won_value, 0)   as won_value
from staff st
cross join months m
cross join lateral (
    select ((extract(year from m.thang) - extract(year from st.thang_dau)) * 12
          + (extract(month from m.thang) - extract(month from st.thang_dau)) + 1)::int as tenure_month
) tm
left join won w on w.owner_id = st.id and w.thang = m.thang
where m.thang >= st.thang_dau;

-- ── 3. Khách mới lập theo ngày (14 ngày gần nhất) ────────────────────────────
-- Đếm theo created_by: ai khai thác thì người đó được tính, kể cả khi khách về
-- sau được bàn giao. RLS crm_accounts vẫn cắt: nhân viên chỉ đếm được khách
-- mình còn thấy, admin đếm đủ.

create view public.crm_kpi_new_accounts_day
with (security_invoker = true) as
with days as (
    select ((now() at time zone 'Asia/Ho_Chi_Minh')::date - g) as ngay
    from generate_series(0, 13) g
)
select p.id as staff_id,
       d.ngay,
       count(a.id) filter (where a.kind = 'customer')::int        as retail_new,
       count(a.id) filter (where a.kind = 'dealer_prospect')::int as org_new
from public.profiles p
cross join days d
left join public.crm_accounts a
       on a.created_by = p.id
      and (a.created_at at time zone 'Asia/Ho_Chi_Minh')::date = d.ngay
where p.role = 'staff' and p.status = 'active'
group by p.id, d.ngay;

-- ── 4. +5% hoa hồng từ máy thứ 10 trong tháng ────────────────────────────────
-- Chép nguyên hàm đang chạy (20260729140000), chỉ thêm khối đếm máy tháng này.
-- Cơ hội vừa được đẩy sang bước thắng ở ngay phía trên (BEFORE-trigger
-- crm_opportunity_before_write điền closed_at cùng lúc) nên tổng đếm đã gồm
-- đơn này: đơn chứa máy thứ 10 trở đi hưởng luôn suất +5%.

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
    v_devices     integer;
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

    -- KPI Boss 01/08/2026: từ máy thứ 10 trong tháng lịch VN, đơn được +5%.
    SELECT COALESCE(sum(o.quantity), 0) INTO v_devices
      FROM public.crm_opportunities o
      JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'won'
     WHERE o.owner_id = v_opp.owner_id
       AND o.closed_at IS NOT NULL
       AND date_trunc('month', o.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
         = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');
    IF v_devices >= 10 THEN
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
