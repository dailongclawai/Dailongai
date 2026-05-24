-- Dealers upload receipts to receipts/<their-uid>/<filename>; can read own folder
CREATE POLICY receipts_dealer_insert
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY receipts_dealer_select_own
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'receipts'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.current_role() = 'admin'
        )
    );
