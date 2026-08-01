-- Thư góp ý xây dựng CRM: nhân viên gửi trong portal, quản trị đọc tại chỗ.
-- Boss yêu cầu 02/08/2026.

create table public.crm_feedbacks (
    id         uuid primary key default gen_random_uuid(),
    staff_id   uuid not null references public.profiles(id) on delete cascade,
    content    text not null check (length(btrim(content)) between 1 and 4000),
    created_at timestamptz not null default now()
);

create index crm_feedbacks_created_idx on public.crm_feedbacks (created_at desc);

alter table public.crm_feedbacks enable row level security;

create policy crm_feedbacks_select on public.crm_feedbacks
    for select to authenticated
    using (
        public.crm_role_allowed()
        and (staff_id = auth.uid() or public.current_role() = 'admin')
    );

create policy crm_feedbacks_insert on public.crm_feedbacks
    for insert to authenticated
    with check (public.crm_role_allowed() and staff_id = auth.uid());
