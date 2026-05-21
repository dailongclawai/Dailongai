ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS profile_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY profiles_select_self
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY profiles_select_team
    ON public.profiles FOR SELECT
    USING (
        supervisor_id = auth.uid()
        AND public.current_role() = 'supervisor'
    );

CREATE POLICY profiles_select_admin
    ON public.profiles FOR SELECT
    USING (public.current_role() = 'admin');

CREATE POLICY profiles_insert_self
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid() AND role IS NULL AND status = 'pending');

CREATE POLICY profiles_update_self_limited
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
        AND supervisor_id IS NOT DISTINCT FROM (SELECT supervisor_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY profiles_admin_all
    ON public.profiles FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
