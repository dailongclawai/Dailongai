-- Chuẩn hoá lý do mất cơ hội.
--
-- Trước migration này crm_opportunities.lost_reason là text tự do và giao diện
-- kanban chưa bao giờ ghi vào nó — nghĩa là không thống kê được vì sao thua.
-- Sau migration: lost_reason_id trỏ vào danh mục, phần chữ tự do đổi tên thành
-- lost_notes và chỉ còn dùng để ghi chú thêm.

CREATE TABLE IF NOT EXISTS public.crm_lost_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    -- NULL = dùng chung cho cả hai pipeline
    pipeline text CHECK (pipeline IS NULL OR pipeline IN ('b2c_device', 'b2b_dealer')),
    sort_order smallint NOT NULL,
    active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.crm_lost_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_lost_reasons_select_all ON public.crm_lost_reasons;
CREATE POLICY crm_lost_reasons_select_all ON public.crm_lost_reasons
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS crm_lost_reasons_admin_write ON public.crm_lost_reasons;
CREATE POLICY crm_lost_reasons_admin_write ON public.crm_lost_reasons
    FOR ALL TO authenticated
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

INSERT INTO public.crm_lost_reasons (name, pipeline, sort_order) VALUES
    ('Giá cao',                       NULL,         1),
    ('Chọn đối thủ',                  NULL,         2),
    ('Chưa có nhu cầu',               NULL,         3),
    ('Không đủ ngân sách',            NULL,         4),
    ('Mất liên lạc',                  NULL,         5),
    ('Không đủ điều kiện làm đại lý', 'b2b_dealer', 6),
    ('Khác',                          NULL,         7)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.crm_opportunities
    ADD COLUMN IF NOT EXISTS lost_reason_id uuid REFERENCES public.crm_lost_reasons(id);

-- Đổi tên giữ nguyên dữ liệu cũ. Bọc trong DO để `supabase db reset` chạy lại
-- không chết ở lần thứ hai.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crm_opportunities'
          AND column_name = 'lost_reason'
    ) THEN
        ALTER TABLE public.crm_opportunities RENAME COLUMN lost_reason TO lost_notes;
    END IF;
END $$;

-- Thay bản cũ ở 20260727120200: thêm ràng buộc lý do mất, đổi tên cột ghi chú.
CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_pipeline text;
    v_forecast text;
    v_stage    text;
BEGIN
    SELECT pipeline, forecast, name INTO v_pipeline, v_forecast, v_stage
    FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_pipeline IS NULL THEN
        RAISE EXCEPTION 'crm_opportunities: stage_id % không tồn tại', NEW.stage_id;
    END IF;
    IF v_pipeline <> NEW.pipeline THEN
        RAISE EXCEPTION 'crm_opportunities: giai đoạn thuộc pipeline %, không khớp %', v_pipeline, NEW.pipeline;
    END IF;

    IF NEW.code IS NULL THEN
        NEW.code := 'CH-' || lpad(nextval('public.crm_opportunity_code_seq')::text, 6, '0');
    END IF;

    IF v_forecast IN ('won', 'lost') THEN
        NEW.closed_at := COALESCE(NEW.closed_at, now());
    ELSE
        NEW.closed_at := NULL;
        NEW.lost_notes := NULL;
        NEW.lost_reason_id := NULL;
    END IF;

    -- Portal là static export, trình duyệt gọi thẳng PostgREST nên lý do mất phải
    -- được soát ở đây chứ không thể tin giao diện.
    IF NEW.lost_reason_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.crm_lost_reasons r
        WHERE r.id = NEW.lost_reason_id
          AND r.active
          AND (r.pipeline IS NULL OR r.pipeline = NEW.pipeline)
    ) THEN
        RAISE EXCEPTION 'crm_opportunities: lý do mất không dùng được cho pipeline %', NEW.pipeline;
    END IF;

    -- Chỉ bắt buộc lúc VÀO giai đoạn thua. Các cơ hội thua từ trước migration này
    -- chưa có lý do chuẩn hoá, soát mọi lần UPDATE sẽ khoá luôn việc sửa chúng.
    IF v_forecast = 'lost' AND NEW.lost_reason_id IS NULL
       AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
        RAISE EXCEPTION 'crm_opportunities: phải chọn lý do mất khi chuyển sang giai đoạn "%"', v_stage;
    END IF;

    RETURN NEW;
END;
$$;

-- Thay bản cũ ở 20260727120200: audit theo lost_reason_id.
CREATE OR REPLACE FUNCTION public.crm_opportunity_audit_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
        PERFORM public.write_audit(
            'crm_stage_change',
            'crm_opportunities',
            NEW.id,
            jsonb_build_object('stage_id', OLD.stage_id, 'lost_reason_id', OLD.lost_reason_id),
            jsonb_build_object('stage_id', NEW.stage_id, 'lost_reason_id', NEW.lost_reason_id)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- DROP rồi tạo lại: CREATE OR REPLACE VIEW không đổi được tên cột đã có.
DROP VIEW IF EXISTS public.crm_opportunity_board;
CREATE VIEW public.crm_opportunity_board
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.code,
    o.name,
    o.pipeline,
    o.stage_id,
    s.name          AS stage_name,
    s.probability,
    s.forecast,
    s.sort_order,
    o.amount,
    o.quantity,
    o.expected_close_date,
    o.owner_id,
    p.full_name     AS owner_name,
    o.account_id,
    a.name          AS account_name,
    a.phone         AS account_phone,
    a.kind          AS account_kind,
    o.contact_id,
    o.model_id,
    o.order_id,
    o.closed_at,
    o.lost_reason_id,
    lr.name         AS lost_reason_name,
    o.lost_notes,
    o.created_at
FROM public.crm_opportunities o
JOIN public.crm_stages   s ON s.id = o.stage_id
LEFT JOIN public.crm_accounts a ON a.id = o.account_id
LEFT JOIN public.profiles p ON p.id = o.owner_id
LEFT JOIN public.crm_lost_reasons lr ON lr.id = o.lost_reason_id;

GRANT SELECT ON public.crm_opportunity_board TO authenticated;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_audit_stage() FROM PUBLIC;
