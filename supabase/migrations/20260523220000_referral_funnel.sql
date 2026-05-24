-- Referral funnel tracking: QR/link views → sign-ups → first orders.
-- Two flows:
--   1. Supervisor recruitment QR: /portal/register?ref=<supervisor_uuid>
--   2. Dealer order QR:          /dat-don?d=<dealer_slug>
--
-- Privacy: client generates a UUID per browser (localStorage), and we hash
-- (session_id || ref_id || YYYY-MM-DD) into visitor_hash. No IP stored.

CREATE TABLE IF NOT EXISTS public.referral_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type           TEXT NOT NULL CHECK (event_type IN (
        'supervisor_view', 'supervisor_signup', 'supervisor_first_order',
        'dealer_view',     'dealer_order'
    )),
    supervisor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dealer_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resulting_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resulting_order_id   UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    visitor_hash         TEXT,            -- sha256(session + ref + day) — dedups per browser per day
    user_agent_short     TEXT,            -- first 120 chars only
    referrer_host        TEXT,            -- referer.host (no path/query)
    utm_source           TEXT,
    is_bot               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX referral_events_supervisor_idx ON public.referral_events (supervisor_id, event_type, created_at DESC);
CREATE INDEX referral_events_dealer_idx     ON public.referral_events (dealer_id, event_type, created_at DESC);
CREATE INDEX referral_events_visitor_idx    ON public.referral_events (visitor_hash, event_type);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

-- Supervisors see their own funnel, dealers see their own, admins see all
CREATE POLICY referral_events_self_read
    ON public.referral_events FOR SELECT TO authenticated
    USING (
        supervisor_id = auth.uid()
        OR dealer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ── Helper: bot detection from user agent ────────────────────────────
CREATE OR REPLACE FUNCTION public._is_bot_ua(p_ua TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE
SET search_path = public AS $$
    SELECT COALESCE(
        p_ua ~* '(bot|crawler|spider|crawling|slurp|yandex|baidu|facebookexternalhit|twitterbot|whatsapp|linkedinbot|pinterestbot|telegrambot|preview|headless|phantom|curl|wget|python-requests|axios)',
        FALSE
    );
$$;

-- ── Public RPC: track event (anon + authenticated) ───────────────────
CREATE OR REPLACE FUNCTION public.track_referral_event(
    p_event_type    TEXT,
    p_supervisor_id UUID DEFAULT NULL,
    p_dealer_id     UUID DEFAULT NULL,
    p_visitor_hash  TEXT DEFAULT NULL,
    p_user_agent    TEXT DEFAULT NULL,
    p_referrer      TEXT DEFAULT NULL,
    p_utm_source    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_is_bot BOOLEAN;
    v_id     UUID;
    v_ua_short TEXT;
    v_ref_host TEXT;
BEGIN
    -- Validate event type (CHECK constraint also catches, but fail fast)
    IF p_event_type NOT IN ('supervisor_view', 'supervisor_signup', 'supervisor_first_order', 'dealer_view', 'dealer_order') THEN
        RAISE EXCEPTION 'track_referral_event: invalid event_type %', p_event_type;
    END IF;
    -- At least one target id required
    IF p_supervisor_id IS NULL AND p_dealer_id IS NULL THEN
        RAISE EXCEPTION 'track_referral_event: must provide supervisor_id or dealer_id';
    END IF;

    v_is_bot   := public._is_bot_ua(p_user_agent);
    v_ua_short := left(COALESCE(p_user_agent, ''), 120);
    -- Extract host from referer URL if possible
    v_ref_host := NULLIF(regexp_replace(COALESCE(p_referrer, ''), '^https?://([^/?#]+).*$', '\1'), '');

    -- Dedup: same visitor_hash + same event in last 24h → return existing id
    IF p_visitor_hash IS NOT NULL THEN
        SELECT id INTO v_id
        FROM public.referral_events
        WHERE visitor_hash = p_visitor_hash
          AND event_type = p_event_type
          AND COALESCE(supervisor_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_supervisor_id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND COALESCE(dealer_id, '00000000-0000-0000-0000-000000000000'::uuid)     = COALESCE(p_dealer_id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND created_at > now() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1;
        IF v_id IS NOT NULL THEN
            RETURN v_id;
        END IF;
    END IF;

    INSERT INTO public.referral_events
        (event_type, supervisor_id, dealer_id, visitor_hash, user_agent_short, referrer_host, utm_source, is_bot)
    VALUES
        (p_event_type, p_supervisor_id, p_dealer_id, p_visitor_hash, v_ua_short, v_ref_host, p_utm_source, v_is_bot)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_referral_event(TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_referral_event(TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ── Link signup/first_order back to original supervisor view ─────────
-- When a new dealer signs up via supervisor_id (already in profiles.supervisor_id),
-- log the conversion. Auto-fire from new-profile + first-order trigger.

CREATE OR REPLACE FUNCTION public._log_signup_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    -- Only log when supervisor_id is set on signup
    IF NEW.supervisor_id IS NOT NULL THEN
        INSERT INTO public.referral_events
            (event_type, supervisor_id, resulting_profile_id, is_bot)
        VALUES ('supervisor_signup', NEW.supervisor_id, NEW.id, FALSE);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_signup_referral ON public.profiles;
CREATE TRIGGER trg_log_signup_referral
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._log_signup_referral();

-- First order trigger: when dealer's first ever order is created
CREATE OR REPLACE FUNCTION public._log_first_order_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_supervisor_id UUID;
    v_existing_count INT;
BEGIN
    -- Check: is this the dealer's first order?
    SELECT COUNT(*) INTO v_existing_count
    FROM public.orders
    WHERE dealer_id = NEW.dealer_id AND id <> NEW.id;
    IF v_existing_count > 0 THEN
        RETURN NEW; -- not the first
    END IF;

    -- NOTE: dealer_order events are logged client-side from /dat-don after
    -- submit, with visitor_hash for proper dedup. Trigger does NOT log dealer_order
    -- here to avoid double counting (DB trigger lacks visitor context).

    -- Find dealer's supervisor and log supervisor_first_order
    SELECT supervisor_id INTO v_supervisor_id
    FROM public.profiles WHERE id = NEW.dealer_id;
    IF v_supervisor_id IS NOT NULL THEN
        INSERT INTO public.referral_events
            (event_type, supervisor_id, resulting_profile_id, resulting_order_id, is_bot)
        VALUES ('supervisor_first_order', v_supervisor_id, NEW.dealer_id, NEW.id, FALSE);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_first_order_referral ON public.orders;
CREATE TRIGGER trg_log_first_order_referral
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._log_first_order_referral();

-- ── Aggregated funnel view per supervisor (last 7d / 30d / all) ──────
CREATE OR REPLACE FUNCTION public.get_supervisor_funnel(
    p_supervisor_id UUID DEFAULT NULL,
    p_days          INT  DEFAULT 30
)
RETURNS TABLE (
    period_days     INT,
    views           INT,
    unique_visitors INT,
    signups         INT,
    first_orders    INT,
    view_to_signup_pct  NUMERIC,
    signup_to_order_pct NUMERIC,
    view_to_order_pct   NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_target_user UUID;
    v_since       TIMESTAMPTZ;
    v_views       INT := 0;
    v_unique      INT := 0;
    v_signups     INT := 0;
    v_orders      INT := 0;
BEGIN
    v_target_user := COALESCE(p_supervisor_id, auth.uid());
    v_since       := now() - (p_days || ' days')::interval;

    -- RLS check: only allow self or admin
    IF v_target_user <> auth.uid()
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'get_supervisor_funnel: forbidden';
    END IF;

    SELECT
        COALESCE(SUM(CASE WHEN event_type = 'supervisor_view'        AND NOT is_bot THEN 1 ELSE 0 END), 0),
        COUNT(DISTINCT CASE WHEN event_type = 'supervisor_view'      AND NOT is_bot THEN visitor_hash END),
        COALESCE(SUM(CASE WHEN event_type = 'supervisor_signup'      THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'supervisor_first_order' THEN 1 ELSE 0 END), 0)
    INTO v_views, v_unique, v_signups, v_orders
    FROM public.referral_events
    WHERE supervisor_id = v_target_user
      AND created_at >= v_since;

    RETURN QUERY SELECT
        p_days,
        v_views,
        v_unique,
        v_signups,
        v_orders,
        CASE WHEN v_unique > 0 THEN ROUND(v_signups::numeric / v_unique * 100, 1) ELSE 0::numeric END,
        CASE WHEN v_signups > 0 THEN ROUND(v_orders::numeric / v_signups * 100, 1) ELSE 0::numeric END,
        CASE WHEN v_unique > 0 THEN ROUND(v_orders::numeric / v_unique * 100, 1) ELSE 0::numeric END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supervisor_funnel(UUID, INT) TO authenticated;

-- ── Dealer QR funnel (views on /dat-don?d=slug → orders) ─────────────
CREATE OR REPLACE FUNCTION public.get_dealer_qr_funnel(
    p_dealer_id UUID DEFAULT NULL,
    p_days      INT  DEFAULT 30
)
RETURNS TABLE (
    period_days        INT,
    views              INT,
    unique_visitors    INT,
    orders_via_qr      INT,
    conversion_pct     NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_target_user UUID;
    v_since       TIMESTAMPTZ;
    v_views       INT := 0;
    v_unique      INT := 0;
    v_orders      INT := 0;
BEGIN
    v_target_user := COALESCE(p_dealer_id, auth.uid());
    v_since       := now() - (p_days || ' days')::interval;

    IF v_target_user <> auth.uid()
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','supervisor')) THEN
        RAISE EXCEPTION 'get_dealer_qr_funnel: forbidden';
    END IF;

    SELECT
        COALESCE(SUM(CASE WHEN event_type = 'dealer_view'  AND NOT is_bot THEN 1 ELSE 0 END), 0),
        COUNT(DISTINCT CASE WHEN event_type = 'dealer_view' AND NOT is_bot THEN visitor_hash END),
        COALESCE(SUM(CASE WHEN event_type = 'dealer_order' THEN 1 ELSE 0 END), 0)
    INTO v_views, v_unique, v_orders
    FROM public.referral_events
    WHERE dealer_id = v_target_user
      AND created_at >= v_since;

    RETURN QUERY SELECT
        p_days,
        v_views,
        v_unique,
        v_orders,
        CASE WHEN v_unique > 0 THEN ROUND(v_orders::numeric / v_unique * 100, 1) ELSE 0::numeric END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dealer_qr_funnel(UUID, INT) TO authenticated;

-- ── Extend get_public_dealer_info to also return dealer_id (for tracking) ──
-- DROP required because return type changes (Postgres cannot alter it via CREATE OR REPLACE).
DROP FUNCTION IF EXISTS public.get_public_dealer_info(TEXT);
CREATE FUNCTION public.get_public_dealer_info(p_slug TEXT)
RETURNS TABLE (dealer_id UUID, dealer_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name
    FROM public.profiles p
    WHERE p.order_slug = p_slug AND p.role = 'dealer';
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_dealer_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_dealer_info(TEXT) TO anon, authenticated;
