-- Thư góp ý có dấu đã đọc/chưa đọc. Boss yêu cầu 02/08/2026.
-- read_at NULL = quản trị chưa xem. Chỉ quản trị được đánh dấu.

alter table public.crm_feedbacks add column read_at timestamptz;

create policy crm_feedbacks_update_admin on public.crm_feedbacks
    for update to authenticated
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');
