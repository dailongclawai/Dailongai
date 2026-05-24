ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_dealer_select_own
    ON public.orders FOR SELECT
    USING (dealer_id = auth.uid());

CREATE POLICY orders_dealer_insert_own
    ON public.orders FOR INSERT
    WITH CHECK (
        dealer_id = auth.uid()
        AND status = 'pending'
        AND approved_at IS NULL
        AND approved_by IS NULL
    );

CREATE POLICY orders_dealer_update_own_pending
    ON public.orders FOR UPDATE
    USING (dealer_id = auth.uid() AND status = 'pending')
    WITH CHECK (dealer_id = auth.uid() AND status = 'pending');

CREATE POLICY orders_supervisor_select_team
    ON public.orders FOR SELECT
    USING (
        public.current_role() = 'supervisor'
        AND dealer_id IN (
            SELECT id FROM public.profiles WHERE supervisor_id = auth.uid()
        )
    );

CREATE POLICY orders_admin_all
    ON public.orders FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
