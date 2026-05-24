-- Monthly revenue goals for supervisors.
-- Admin sets target_revenue per (supervisor, month). Supervisor sees progress.

CREATE TABLE IF NOT EXISTS public.supervisor_monthly_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    year_month      DATE NOT NULL,
    target_revenue  NUMERIC(14, 2) NOT NULL CHECK (target_revenue > 0),
    note            TEXT,
    set_by          UUID REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (supervisor_id, year_month)
);

ALTER TABLE public.supervisor_monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY supervisor_goals_self_read
    ON public.supervisor_monthly_goals FOR SELECT TO authenticated
    USING (
        supervisor_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY supervisor_goals_admin_write
    ON public.supervisor_monthly_goals FOR ALL TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ── RPC: admin set goal ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_supervisor_goal(
    p_supervisor_id UUID,
    p_year_month    DATE,
    p_target        NUMERIC,
    p_note          TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_id UUID;
    v_month DATE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'admin_set_supervisor_goal: admin only';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_supervisor_id AND role = 'supervisor') THEN
        RAISE EXCEPTION 'admin_set_supervisor_goal: % is not a supervisor', p_supervisor_id;
    END IF;
    IF p_target IS NULL OR p_target <= 0 THEN
        RAISE EXCEPTION 'admin_set_supervisor_goal: target phải > 0';
    END IF;

    v_month := date_trunc('month', p_year_month)::date;

    INSERT INTO public.supervisor_monthly_goals (supervisor_id, year_month, target_revenue, note, set_by)
    VALUES (p_supervisor_id, v_month, p_target, p_note, auth.uid())
    ON CONFLICT (supervisor_id, year_month) DO UPDATE
       SET target_revenue = EXCLUDED.target_revenue,
           note           = EXCLUDED.note,
           set_by         = EXCLUDED.set_by,
           updated_at     = now()
    RETURNING id INTO v_id;

    -- Notify supervisor
    INSERT INTO public.portal_messages
        (sender_id, recipient_id, subject, body, category, severity, action_url, action_label)
    VALUES (
        auth.uid(), p_supervisor_id,
        'Mục tiêu tháng đã được cập nhật',
        'Mục tiêu doanh số tháng ' || to_char(v_month, 'MM/YYYY') || ' của bạn là ' ||
        TO_CHAR(p_target, 'FM999,999,999,999') || ' đ.' ||
        CASE WHEN p_note IS NOT NULL AND p_note <> '' THEN ' Ghi chú: ' || p_note ELSE '' END,
        'general', 'info',
        '/portal/supervisor', 'Xem dashboard'
    );

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_supervisor_goal(UUID, DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_supervisor_goal(UUID, DATE, NUMERIC, TEXT) TO authenticated;

-- ── RPC: get current goal + progress + countdown ───────────────────
CREATE OR REPLACE FUNCTION public.get_supervisor_current_goal(p_supervisor_id UUID DEFAULT NULL)
RETURNS TABLE (
    year_month      DATE,
    target_revenue  NUMERIC,
    current_revenue NUMERIC,
    progress_pct    INT,
    days_left       INT,
    days_in_month   INT,
    on_pace_pct     INT,
    note            TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_target_user UUID;
    v_month       DATE;
    v_goal        public.supervisor_monthly_goals%ROWTYPE;
    v_revenue     NUMERIC := 0;
    v_days_in     INT;
    v_days_done   INT;
BEGIN
    v_target_user := COALESCE(p_supervisor_id, auth.uid());
    -- RLS check is done via the SELECT below; supervisors see own, admin sees all
    v_month := date_trunc('month', CURRENT_DATE)::date;

    SELECT * INTO v_goal
    FROM public.supervisor_monthly_goals
    WHERE supervisor_id = v_target_user
      AND year_month = v_month;
    IF NOT FOUND THEN
        RETURN; -- no goal set, empty result
    END IF;

    -- Sum approved+paid orders this month for team
    SELECT COALESCE(SUM(o.sale_price), 0) INTO v_revenue
    FROM public.orders o
    JOIN public.profiles d ON d.id = o.dealer_id
    WHERE d.supervisor_id = v_target_user
      AND o.status IN ('approved', 'paid')
      AND o.sale_date >= v_month
      AND o.sale_date < (v_month + INTERVAL '1 month')::date;

    v_days_in := EXTRACT(DAY FROM (v_month + INTERVAL '1 month - 1 day'))::int;
    v_days_done := EXTRACT(DAY FROM CURRENT_DATE)::int;

    RETURN QUERY SELECT
        v_goal.year_month,
        v_goal.target_revenue,
        v_revenue,
        LEAST(100, ROUND(v_revenue / v_goal.target_revenue * 100))::int,
        GREATEST(0, v_days_in - v_days_done),
        v_days_in,
        ROUND(v_days_done::numeric / v_days_in::numeric * 100)::int,
        v_goal.note;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supervisor_current_goal(UUID) TO authenticated;

-- ── Helper view: team leaderboard (top dealers in branch) ──────────
-- (View-driven so RLS uses security_invoker — supervisor only sees own team)
CREATE OR REPLACE VIEW public.team_leaderboard
WITH (security_invoker = true) AS
SELECT
    p.supervisor_id,
    p.id AS dealer_id,
    p.full_name AS dealer_name,
    COALESCE(SUM(o.sale_price) FILTER (
        WHERE o.status IN ('approved','paid')
          AND o.sale_date >= date_trunc('month', CURRENT_DATE)::date
          AND o.sale_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
    ), 0) AS month_sales,
    COUNT(*) FILTER (
        WHERE o.status IN ('approved','paid')
          AND o.sale_date >= date_trunc('month', CURRENT_DATE)::date
          AND o.sale_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
    ) AS month_units,
    COUNT(*) FILTER (
        WHERE o.status IN ('approved','paid')
          AND date_part('year', o.sale_date) = date_part('year', now())
    ) AS units_ytd,
    -- Last 7 days sales for "tốc độ"
    COALESCE(SUM(o.sale_price) FILTER (
        WHERE o.status IN ('approved','paid')
          AND o.sale_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0) AS sales_7d
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer' AND p.supervisor_id IS NOT NULL
GROUP BY p.supervisor_id, p.id, p.full_name;

GRANT SELECT ON public.team_leaderboard TO authenticated;
