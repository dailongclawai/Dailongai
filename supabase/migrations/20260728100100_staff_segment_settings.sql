-- Mảng phụ trách của staff + tham số kinh doanh của CRM.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS staff_segment text
        CHECK (staff_segment IS NULL OR staff_segment IN ('b2c', 'b2b'));

COMMENT ON COLUMN public.profiles.staff_segment IS
    'Mảng phụ trách, chỉ có nghĩa khi role = staff: b2c bán máy cho khách cuối, b2b tuyển/chăm đại lý';

-- Bảng cấu hình MỘT DÒNG. Khoá chính boolean CHECK (id) là mẫu single-row của Postgres.
CREATE TABLE IF NOT EXISTS public.crm_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    base_price numeric(14,2) NOT NULL DEFAULT 15000000 CHECK (base_price > 0),
    staff_rate_b2c numeric(5,4) NOT NULL DEFAULT 0.2000 CHECK (staff_rate_b2c >= 0 AND staff_rate_b2c <= 1),
    staff_rate_b2b numeric(5,4) NOT NULL DEFAULT 0.1000 CHECK (staff_rate_b2b >= 0 AND staff_rate_b2b <= 1),
    crossover_bonus_rate numeric(5,4) NOT NULL DEFAULT 0.0500 CHECK (crossover_bonus_rate >= 0 AND crossover_bonus_rate <= 1),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS crm_settings_set_updated_at ON public.crm_settings;
CREATE TRIGGER crm_settings_set_updated_at
BEFORE UPDATE ON public.crm_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- Mọi người đăng nhập đọc được (staff cần biết mình sắp nhận bao nhiêu);
-- chỉ admin sửa.
DROP POLICY IF EXISTS crm_settings_select ON public.crm_settings;
CREATE POLICY crm_settings_select ON public.crm_settings
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS crm_settings_admin_write ON public.crm_settings;
CREATE POLICY crm_settings_admin_write ON public.crm_settings
    FOR UPDATE TO authenticated
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

-- Admin gán vai trò staff + mảng phụ trách.
CREATE OR REPLACE FUNCTION public.admin_set_staff(p_user_id uuid, p_segment text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được gán vai trò staff';
    END IF;
    IF p_segment NOT IN ('b2c', 'b2b') THEN
        RAISE EXCEPTION 'Mảng phụ trách phải là b2c hoặc b2b, nhận được %', p_segment;
    END IF;

    SELECT jsonb_build_object('role', role, 'staff_segment', staff_segment)
      INTO v_before FROM public.profiles WHERE id = p_user_id;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản %', p_user_id;
    END IF;

    UPDATE public.profiles
       SET role = 'staff'::public.profile_role,
           status = 'active'::public.profile_status,
           staff_segment = p_segment,
           supervisor_id = NULL
     WHERE id = p_user_id;

    PERFORM public.write_audit('set_staff', 'profiles', p_user_id, v_before,
        jsonb_build_object('role', 'staff', 'staff_segment', p_segment));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_staff(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_staff(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff(uuid, text) TO authenticated;
