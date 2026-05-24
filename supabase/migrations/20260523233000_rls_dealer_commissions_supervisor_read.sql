-- Bug: supervisor reading dealer_current_commission view returned 'tier_auto' for
-- all team dealers because RLS on dealer_commissions hides fixed-override rows
-- from anyone except the dealer themselves or admin. LEFT JOIN LATERAL silently
-- produced NULL fx row → fallback to tier_auto.
--
-- Fix: allow supervisor to SELECT dealer_commissions rows where the dealer is
-- a member of their team (profiles.supervisor_id = auth.uid()). Read-only;
-- writes still go through supervisor_set_dealer_fixed_commission RPC which
-- enforces team membership in SQL.

CREATE POLICY dealer_commissions_select_supervisor
    ON public.dealer_commissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = dealer_commissions.dealer_id
              AND supervisor_id = auth.uid()
        )
    );
