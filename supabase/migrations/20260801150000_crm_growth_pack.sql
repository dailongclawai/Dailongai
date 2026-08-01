-- Gói tăng trưởng CRM — Boss duyệt 5 mục chiều 01/08/2026:
--   1. Lead website/Zalo tự chảy vào CRM: hàm crm_intake_lead cho server bot gọi
--      bằng service key. Trùng số điện thoại thì KHÔNG tạo khách mới mà ghi một
--      việc "khách liên hệ lại" cho người đang phụ trách.
--   2. Nhắc qua Telegram: nhắc theo owner_id — cột telegram_chat_id trên profiles
--      để map nhân viên ↔ Telegram; ai chưa khai thì tin nhắc dồn về quản trị.
--   3. Mục tiêu tháng: bảng crm_targets + khung nhìn crm_target_progress đo
--      thực đạt theo THÁNG LỊCH giờ Việt Nam (khác cửa sổ trượt 30 ngày).
--   4. Tự động hoá đầu tiên: khách vào N ngày (crm_settings.lead_untouched_days)
--      mà chưa có hoạt động nào → tự tạo việc cho người phụ trách.
--   5. (Biểu đồ làm ở tầng giao diện, không cần gì dưới DB.)

-- ── Map nhân viên ↔ Telegram ─────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS telegram_chat_id text;

COMMENT ON COLUMN public.profiles.telegram_chat_id IS
    'Chat ID Telegram của nhân viên để nhận nhắc việc CRM. NULL = tin nhắc dồn về quản trị.';

-- ── Ngưỡng khách bị bỏ quên ──────────────────────────────────────────────────
ALTER TABLE public.crm_settings
    ADD COLUMN IF NOT EXISTS lead_untouched_days smallint NOT NULL DEFAULT 2
        CHECK (lead_untouched_days >= 1 AND lead_untouched_days <= 30);

COMMENT ON COLUMN public.crm_settings.lead_untouched_days IS
    'Khách vào bao nhiêu ngày mà chưa có hoạt động nào thì máy tự tạo việc nhắc.';

-- ── Mục tiêu tháng ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Luôn là ngày mùng 1 của tháng áp dụng.
    thang date NOT NULL CHECK (thang = date_trunc('month', thang)::date),
    target_won_value numeric(14,2) NOT NULL DEFAULT 0 CHECK (target_won_value >= 0),
    target_won_deals integer NOT NULL DEFAULT 0 CHECK (target_won_deals >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (staff_id, thang)
);

DROP TRIGGER IF EXISTS crm_targets_set_updated_at ON public.crm_targets;
CREATE TRIGGER crm_targets_set_updated_at
BEFORE UPDATE ON public.crm_targets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_targets_select ON public.crm_targets;
CREATE POLICY crm_targets_select ON public.crm_targets
    FOR SELECT TO authenticated
    USING (public.crm_role_allowed() AND (staff_id = auth.uid() OR public.current_role() = 'admin'));

DROP POLICY IF EXISTS crm_targets_admin_write ON public.crm_targets;
CREATE POLICY crm_targets_admin_write ON public.crm_targets
    FOR ALL TO authenticated
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

-- Tiến độ tháng hiện tại: thực đạt đo theo tháng lịch giờ Việt Nam.
DROP VIEW IF EXISTS public.crm_target_progress;
CREATE VIEW public.crm_target_progress AS
SELECT
    t.staff_id,
    t.thang,
    t.target_won_value,
    t.target_won_deals,
    COALESCE(a.won_value, 0) AS actual_won_value,
    COALESCE(a.won_deals, 0) AS actual_won_deals
FROM public.crm_targets t
LEFT JOIN (
    SELECT o.owner_id,
           sum(o.amount) AS won_value,
           count(*)      AS won_deals
    FROM public.crm_opportunities o
    JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'won'
    WHERE date_trunc('month', o.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        = date_trunc('month', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date
    GROUP BY o.owner_id
) a ON a.owner_id = t.staff_id
WHERE t.thang = date_trunc('month', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date
  AND (t.staff_id = auth.uid() OR public.current_role() = 'admin');

GRANT SELECT ON public.crm_target_progress TO authenticated;

-- ── Cửa nhận lead từ website / Zalo ──────────────────────────────────────────
-- Chỉ server bot gọi bằng service key. Chia khách theo kiểu tự cân bằng: ai
-- nhận ít khách mới nhất trong 30 ngày thì nhận lead tiếp theo.
CREATE OR REPLACE FUNCTION public.crm_intake_lead(
    p_name text,
    p_phone text,
    p_email text DEFAULT NULL,
    p_source text DEFAULT 'website',
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_norm     text;
    v_existing public.crm_accounts;
    v_owner    uuid;
    v_source   text;
    v_due      timestamptz;
    v_id       uuid;
    v_code     text;
BEGIN
    IF coalesce(trim(p_name), '') = '' AND coalesce(trim(p_phone), '') = '' THEN
        RAISE EXCEPTION 'crm_intake_lead: cần ít nhất tên hoặc số điện thoại';
    END IF;

    v_source := CASE WHEN p_source IN
        ('website','zalo','facebook','google_ads','tiktok','referral','hotline','event','other')
        THEN p_source ELSE 'other' END;

    -- Việc sinh ra hẹn 17h hôm nay giờ Việt Nam; quá 16h thì dồn sang 10h mai.
    IF (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < time '16:00' THEN
        v_due := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + time '17:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';
    ELSE
        v_due := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1 + time '10:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';
    END IF;

    v_norm := public.crm_normalize_phone(p_phone);

    IF v_norm IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.crm_accounts a
         WHERE public.crm_normalize_phone(a.phone) = v_norm LIMIT 1;
        IF v_existing.id IS NOT NULL THEN
            -- Khách cũ quay lại: không tạo trùng, ghi một việc cho người phụ trách.
            INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, owner_id)
            VALUES ('task',
                    'Khách liên hệ lại (' || v_source || '): ' || v_existing.name,
                    '[tự động] ' || coalesce(nullif(trim(p_notes), ''), 'Khách để lại thông tin lần nữa.'),
                    v_due, v_existing.id, v_existing.owner_id);
            RETURN jsonb_build_object('result', 'existing', 'account_code', v_existing.code);
        END IF;
    END IF;

    SELECT p.id INTO v_owner
      FROM public.profiles p
     WHERE p.role = 'staff' AND p.status = 'active'
     ORDER BY (SELECT count(*) FROM public.crm_accounts a
                WHERE a.owner_id = p.id AND a.created_at > now() - interval '30 days') ASC,
              p.account_no ASC
     LIMIT 1;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'crm_intake_lead: chưa có nhân viên kinh doanh nào đang hoạt động';
    END IF;

    INSERT INTO public.crm_accounts (name, kind, phone, email, source, notes, owner_id)
    VALUES (coalesce(nullif(trim(p_name), ''), 'Khách ' || coalesce(v_norm, '?')),
            'customer', nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
            v_source, nullif(trim(p_notes), ''), v_owner)
    RETURNING id, code INTO v_id, v_code;

    RETURN jsonb_build_object('result', 'created', 'account_code', v_code,
        'owner_email', (SELECT email FROM public.profiles WHERE id = v_owner));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_intake_lead(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_intake_lead(text, text, text, text, text) TO service_role;

-- ── Tự động hoá: khách bị bỏ quên → tự tạo việc ─────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_auto_followup_tasks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_days  smallint;
    v_stage uuid;
    v_due   timestamptz;
    v_count integer;
BEGIN
    SELECT lead_untouched_days INTO v_days FROM public.crm_settings WHERE id;
    SELECT id INTO v_stage FROM public.crm_stages
     WHERE active AND forecast = 'open' ORDER BY sort_order LIMIT 1;

    IF (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < time '16:00' THEN
        v_due := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + time '17:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';
    ELSE
        v_due := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1 + time '10:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';
    END IF;

    -- Khách còn nằm ở bước đầu chuỗi, vào đã lâu, và CHƯA từng có hoạt động nào.
    -- Tạo việc xong thì khách có hoạt động → lần chạy sau tự bỏ qua, không nhai lại.
    INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, owner_id)
    SELECT 'task',
           'Liên hệ khách mới: ' || a.name,
           '[tự động] Khách vào từ nguồn ' || coalesce(a.source::text, '?') || ' đã quá '
               || v_days || ' ngày chưa có hoạt động nào.',
           v_due, a.id, a.owner_id
      FROM public.crm_accounts a
     WHERE a.stage_id = v_stage
       AND a.created_at < now() - make_interval(days => v_days)
       AND NOT EXISTS (SELECT 1 FROM public.crm_activities ac WHERE ac.account_id = a.id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_auto_followup_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_auto_followup_tasks() TO service_role;
