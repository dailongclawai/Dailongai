-- Dealer tier badge: status hiển thị, KHÔNG ảnh hưởng tính commission per-order.
-- Dựa trên rolling 12 tháng doanh số (approved + paid orders).

CREATE TABLE public.dealer_tier_levels (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    min_revenue_12m NUMERIC(14, 2) NOT NULL,
    color_token TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INT NOT NULL UNIQUE
);

INSERT INTO public.dealer_tier_levels (slug, name, min_revenue_12m, color_token, icon, sort_order) VALUES
    ('bronze',   'Đồng',     0,             '#cd7f32', 'workspace_premium', 1),
    ('silver',   'Bạc',      500000000,     '#9cefff', 'workspace_premium', 2),
    ('gold',     'Vàng',     1500000000,    '#ffd700', 'workspace_premium', 3),
    ('platinum', 'Bạch kim', 3000000000,    '#e5e4e2', 'diamond',           4);

ALTER TABLE public.dealer_tier_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY tier_levels_read_all ON public.dealer_tier_levels
    FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.get_dealer_tier_status(p_profile_id UUID)
RETURNS TABLE (
    revenue_12m       NUMERIC,
    current_slug      TEXT,
    current_name      TEXT,
    current_min       NUMERIC,
    current_color     TEXT,
    current_icon      TEXT,
    next_slug         TEXT,
    next_name         TEXT,
    next_min          NUMERIC,
    progress_pct      INT,
    amount_to_next    NUMERIC,
    role              TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_role TEXT;
    v_revenue NUMERIC := 0;
    v_current public.dealer_tier_levels%ROWTYPE;
    v_next public.dealer_tier_levels%ROWTYPE;
BEGIN
    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = p_profile_id;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Profile % not found', p_profile_id;
    END IF;

    IF v_role = 'supervisor' THEN
        -- Team revenue = sum doanh số của các dealer trực thuộc
        SELECT COALESCE(SUM(o.sale_price), 0) INTO v_revenue
        FROM public.orders o
        JOIN public.profiles d ON d.id = o.dealer_id
        WHERE d.supervisor_id = p_profile_id
          AND o.status IN ('approved', 'paid')
          AND o.sale_date >= (CURRENT_DATE - INTERVAL '12 months');
    ELSE
        -- Dealer (hoặc bất kỳ role nào khác): doanh số riêng
        SELECT COALESCE(SUM(o.sale_price), 0) INTO v_revenue
        FROM public.orders o
        WHERE o.dealer_id = p_profile_id
          AND o.status IN ('approved', 'paid')
          AND o.sale_date >= (CURRENT_DATE - INTERVAL '12 months');
    END IF;

    SELECT * INTO v_current
    FROM public.dealer_tier_levels
    WHERE min_revenue_12m <= v_revenue
    ORDER BY sort_order DESC
    LIMIT 1;

    SELECT * INTO v_next
    FROM public.dealer_tier_levels
    WHERE sort_order > v_current.sort_order
    ORDER BY sort_order ASC
    LIMIT 1;

    revenue_12m    := v_revenue;
    current_slug   := v_current.slug;
    current_name   := v_current.name;
    current_min    := v_current.min_revenue_12m;
    current_color  := v_current.color_token;
    current_icon   := v_current.icon;
    role           := v_role;

    IF v_next.slug IS NOT NULL THEN
        next_slug      := v_next.slug;
        next_name      := v_next.name;
        next_min       := v_next.min_revenue_12m;
        amount_to_next := GREATEST(v_next.min_revenue_12m - v_revenue, 0);
        progress_pct   := LEAST(
            100,
            GREATEST(
                0,
                FLOOR(
                    ((v_revenue - v_current.min_revenue_12m) * 100.0)
                    / NULLIF(v_next.min_revenue_12m - v_current.min_revenue_12m, 0)
                )::INT
            )
        );
    ELSE
        next_slug      := NULL;
        next_name      := NULL;
        next_min       := NULL;
        amount_to_next := 0;
        progress_pct   := 100;
    END IF;

    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dealer_tier_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dealer_tier_status(UUID) TO authenticated;
