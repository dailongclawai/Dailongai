-- Boss chốt 02/08/2026: bỏ hẳn bảng mục tiêu tháng đặt tay — KPI máy tự động
-- (crm_kpi_device_month, luật 3/5 máy theo thâm niên + thưởng +5%) là thước đo
-- duy nhất, tránh nhân viên thấy hai mục tiêu kể chuyện ngược nhau.

drop view public.crm_target_progress;
drop table public.crm_targets;
