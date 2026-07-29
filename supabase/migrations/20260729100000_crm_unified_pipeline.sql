-- Gộp hai pipeline B2C/B2B thành một chuỗi giai đoạn duy nhất.
--
-- Boss chốt 29/07/2026: không còn phân biệt B2C với B2B nữa, và bảng khách hàng
-- phải hiện trạng thái chạy từ lúc bắt đầu kết nối cho tới khi hoàn thành đơn.
-- Vì vậy bỏ hẳn cột `pipeline` thay vì để nó với một giá trị duy nhất.
--
-- An toàn: lúc chạy migration này production có 0 cơ hội và 0 dòng hoa hồng, nên
-- xoá và gieo lại danh mục giai đoạn không mất dữ liệu nào.

DROP VIEW IF EXISTS public.crm_opportunity_board;

ALTER TABLE public.crm_opportunities     DROP COLUMN IF EXISTS pipeline;
ALTER TABLE public.crm_staff_commissions DROP COLUMN IF EXISTS pipeline;
ALTER TABLE public.crm_lost_reasons      DROP COLUMN IF EXISTS pipeline;

-- Danh mục giai đoạn: xoá sạch hai chuỗi cũ rồi gieo một chuỗi dùng chung.
ALTER TABLE public.crm_stages DROP CONSTRAINT IF EXISTS crm_stages_pipeline_sort_order_key;
ALTER TABLE public.crm_stages DROP CONSTRAINT IF EXISTS crm_stages_pipeline_name_key;
ALTER TABLE public.crm_stages DROP CONSTRAINT IF EXISTS crm_stages_pipeline_check;
DELETE FROM public.crm_stages;
ALTER TABLE public.crm_stages DROP COLUMN IF EXISTS pipeline;
ALTER TABLE public.crm_stages ADD CONSTRAINT crm_stages_sort_order_key UNIQUE (sort_order);
ALTER TABLE public.crm_stages ADD CONSTRAINT crm_stages_name_key UNIQUE (name);

-- Chuỗi trạng thái từ lúc bắt đầu kết nối tới khi hoàn thành đơn.
-- "Chốt đơn" vẫn là open vì tiền chỉ thực sự về khi khách thanh toán; giai đoạn
-- won là "Hoàn thành đơn", do trigger trên bảng orders tự đẩy sang.
INSERT INTO public.crm_stages (name, probability, forecast, sort_order) VALUES
    ('Mới tiếp nhận',       10, 'open', 1),
    ('Đã liên hệ',          25, 'open', 2),
    ('Đang tư vấn',         40, 'open', 3),
    ('Đã trải nghiệm máy',  60, 'open', 4),
    ('Đàm phán giá',        75, 'open', 5),
    ('Chốt đơn',            90, 'open', 6),
    ('Hoàn thành đơn',     100, 'won',  7),
    ('Không mua',            0, 'lost', 8)
ON CONFLICT (sort_order) DO NOTHING;

-- Thay bản ở 20260728120100: bỏ phần soát pipeline khớp nhau.
CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_forecast text;
    v_stage    text;
BEGIN
    SELECT forecast, name INTO v_forecast, v_stage
    FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_forecast IS NULL THEN
        RAISE EXCEPTION 'crm_opportunities: stage_id % không tồn tại', NEW.stage_id;
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

    IF NEW.lost_reason_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.crm_lost_reasons r
        WHERE r.id = NEW.lost_reason_id AND r.active
    ) THEN
        RAISE EXCEPTION 'crm_opportunities: lý do mất không hợp lệ';
    END IF;

    IF v_forecast = 'lost' AND NEW.lost_reason_id IS NULL
       AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
        RAISE EXCEPTION 'crm_opportunities: phải chọn lý do mất khi chuyển sang giai đoạn "%"', v_stage;
    END IF;

    RETURN NEW;
END;
$$;

CREATE VIEW public.crm_opportunity_board
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.code,
    o.name,
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
