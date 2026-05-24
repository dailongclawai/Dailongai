-- Enable Supabase Realtime for dealer_commissions so dealer dashboards
-- auto-react when supervisor switches commission plan (tier ↔ fixed).
-- RLS (dealer_commissions_select_own) ensures each dealer only sees
-- realtime events for their own rows.

ALTER PUBLICATION supabase_realtime ADD TABLE public.dealer_commissions;
