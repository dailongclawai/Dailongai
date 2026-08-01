-- Thư góp ý gửi kèm được một ảnh/file. Boss bổ sung 02/08/2026.

alter table public.crm_feedbacks add column file_path text;

insert into storage.buckets (id, name, public)
values ('crm-feedback', 'crm-feedback', false)
on conflict (id) do nothing;

create policy crm_feedback_upload on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'crm-feedback'
        and public.crm_role_allowed()
        and (storage.foldername(name))[1] = (auth.uid())::text
    );

-- Bài học 01/08: PHẢI định danh storage.objects.name — viết `name` trần bị
-- Postgres bind vào cột của bảng trong subquery. RLS của crm_feedbacks tự áp:
-- ai thấy dòng thư (người gửi, admin) thì mới đọc được file đính kèm.
create policy crm_feedback_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'crm-feedback'
        and public.crm_role_allowed()
        and exists (
            select 1 from public.crm_feedbacks f
            where f.file_path = storage.objects.name
        )
    );
