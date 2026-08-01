-- Việc hệ thống giao chung (vd "Khai thác khách mới hôm nay") không có khách cha.
-- Nới crm_activities_needs_parent đúng một khe: task [tự động] được phép đứng
-- một mình; hoạt động người dùng tạo vẫn bắt buộc gắn khách/cơ hội như cũ.

alter table public.crm_activities drop constraint crm_activities_needs_parent;
alter table public.crm_activities add constraint crm_activities_needs_parent check (
    account_id is not null
    or opportunity_id is not null
    or (kind = 'task' and notes like '[tự động]%')
);
