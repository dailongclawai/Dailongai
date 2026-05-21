ALTER TABLE public.dealer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dealer_commissions_select_own
    ON public.dealer_commissions FOR SELECT
    USING (dealer_id = auth.uid());

CREATE POLICY dealer_commissions_admin_all
    ON public.dealer_commissions FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

CREATE POLICY supervisor_overrides_select_own
    ON public.supervisor_overrides FOR SELECT
    USING (supervisor_id = auth.uid());

CREATE POLICY supervisor_overrides_admin_all
    ON public.supervisor_overrides FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

CREATE POLICY payouts_select_own
    ON public.commission_payouts FOR SELECT
    USING (recipient_id = auth.uid());

CREATE POLICY payouts_admin_all
    ON public.commission_payouts FOR ALL
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');
