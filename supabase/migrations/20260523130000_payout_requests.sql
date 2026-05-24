-- Payout requests: dealers/supervisors request early payout of accrued commission.

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_role text NOT NULL CHECK (requester_role IN ('dealer','supervisor')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paid')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id),
  processor_notes text
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_requester
  ON public.payout_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status
  ON public.payout_requests(status, created_at DESC);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payout_requests_self_select ON public.payout_requests;
CREATE POLICY payout_requests_self_select ON public.payout_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS payout_requests_self_insert ON public.payout_requests;
CREATE POLICY payout_requests_self_insert ON public.payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND requester_role IN ('dealer','supervisor')
  );

DROP POLICY IF EXISTS payout_requests_admin_update ON public.payout_requests;
CREATE POLICY payout_requests_admin_update ON public.payout_requests
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- RPC: admin process payout request
CREATE OR REPLACE FUNCTION public.admin_process_payout_request(
  p_request_id uuid,
  p_decision text,                -- 'approved' | 'rejected' | 'paid'
  p_processor_notes text DEFAULT NULL
)
RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_row public.payout_requests;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved','rejected','paid') THEN
    RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
  END IF;
  UPDATE public.payout_requests
     SET status = p_decision,
         processed_at = now(),
         processed_by = auth.uid(),
         processor_notes = p_processor_notes
   WHERE id = p_request_id
   RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_process_payout_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_process_payout_request(uuid, text, text) TO authenticated;
