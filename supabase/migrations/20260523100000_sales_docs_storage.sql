-- Storage policies for the sales-docs bucket: admins manage, signed-in users read.
CREATE POLICY sales_docs_admin_write
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'sales-docs' AND public.current_role() = 'admin');

CREATE POLICY sales_docs_admin_update
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'sales-docs' AND public.current_role() = 'admin');

CREATE POLICY sales_docs_admin_delete
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'sales-docs' AND public.current_role() = 'admin');

CREATE POLICY sales_docs_authenticated_read
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'sales-docs');
