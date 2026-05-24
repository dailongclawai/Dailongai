ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_select
    ON public.audit_log FOR SELECT
    USING (public.current_role() = 'admin');

CREATE POLICY product_models_select_active
    ON public.product_models FOR SELECT
    USING (active = TRUE);

CREATE POLICY product_models_admin_all
    ON public.product_models FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

CREATE POLICY sales_docs_select_by_visibility
    ON public.sales_documents FOR SELECT
    USING (
        visible_to = 'all'
        OR (visible_to = 'dealer' AND public.current_role() = 'dealer')
        OR (visible_to = 'supervisor' AND public.current_role() = 'supervisor')
        OR public.current_role() = 'admin'
    );

CREATE POLICY sales_docs_admin_all
    ON public.sales_documents FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
