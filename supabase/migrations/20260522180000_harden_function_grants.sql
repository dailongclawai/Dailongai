-- Pin search_path on the two trigger helpers that were missing it
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.audit_log_block_modify() SET search_path = public;

-- Internal helpers and trigger functions must not be callable over the REST API.
-- Triggers invoke them as part of the table operation (no caller EXECUTE needed),
-- and the SECURITY DEFINER RPCs call calc_commission/write_audit as the function
-- owner, so revoking the default PUBLIC grant breaks nothing while closing the
-- /rest/v1/rpc/* surface for these.
DO $$
DECLARE
    fn TEXT;
    sigs TEXT[] := ARRAY[
        'public.set_updated_at()',
        'public.audit_log_block_modify()',
        'public.handle_new_user()',
        'public.orders_on_approve()',
        'public.orders_audit_trigger()',
        'public.profiles_audit_trigger()',
        'public.commissions_audit_trigger()',
        'public.notify_order_status_change()',
        'public.calc_commission(uuid)',
        'public.write_audit(text, text, uuid, jsonb, jsonb)'
    ];
BEGIN
    FOREACH fn IN ARRAY sigs LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    END LOOP;
END $$;

-- Intended RPCs stay callable by signed-in users only (they were explicitly
-- granted to authenticated); strip the inherited PUBLIC/anon grant so an
-- unauthenticated caller can't even reach them.
DO $$
DECLARE
    fn TEXT;
    sigs TEXT[] := ARRAY[
        'public.admin_approve_registration(uuid, public.profile_role, uuid, public.commission_type, numeric, uuid)',
        'public.admin_reject_registration(uuid, text)',
        'public.admin_set_supervisor(uuid)',
        'public.admin_reply(uuid, text)',
        'public.admin_process_payout(uuid, text)',
        'public.record_order(uuid, text, text, text, text, numeric, date, text)',
        'public.record_order_batch(text, text, text, date, text, jsonb)',
        'public.claim_referral(uuid)',
        'public.supervisor_set_commission(uuid, uuid)',
        'public.send_feedback(text, text)',
        'public.mark_message_read(uuid)'
    ];
BEGIN
    FOREACH fn IN ARRAY sigs LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    END LOOP;
END $$;
