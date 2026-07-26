-- supabase/migrations/20260726170000_fix_unassigned_dealers_view_rls.sql
-- View chạy quyền owner (postgres) nên bỏ qua RLS của profiles/orders.
-- Kèm default privileges của schema public cấp sẵn cho anon => 5 bản ghi đại lý
-- (họ tên, số tài khoản, doanh số tháng) đọc được ẩn danh qua /rest/v1.
-- security_invoker => áp RLS của người gọi; admin vẫn thấy đủ nhờ profiles_admin_all/orders_admin_all.

ALTER VIEW public.unassigned_dealers_summary SET (security_invoker = true);

REVOKE ALL ON public.unassigned_dealers_summary FROM anon;
GRANT SELECT ON public.unassigned_dealers_summary TO authenticated;
