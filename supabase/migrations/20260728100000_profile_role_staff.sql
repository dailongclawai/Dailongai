-- Thêm vai trò staff (nhân viên kinh doanh của công ty).
-- PHẢI nằm riêng một file: Postgres cho ADD VALUE trong transaction nhưng
-- KHÔNG cho dùng giá trị mới trong cùng transaction đó, nên các migration sau
-- (dùng 'staff' trong policy/CHECK/seed) phải chạy ở transaction khác.
ALTER TYPE public.profile_role ADD VALUE IF NOT EXISTS 'staff';
