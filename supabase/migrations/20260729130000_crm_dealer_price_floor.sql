-- Sàn giá đại lý.
--
-- Boss chốt 29/07/2026: giá đại lý được phép chiết khấu 20% so với giá niêm yết
-- 29.500.000, tức 23.600.000. 20% là mức TỐI ĐA, nên dealer_price đóng vai trò
-- sàn: cơ hội bán cho đại lý không được ghi giá thấp hơn.
--
-- Chặn ở tầng dữ liệu chứ không chỉ ở giao diện: portal là static export, trình
-- duyệt gọi thẳng PostgREST nên mọi ràng buộc về tiền phải nằm dưới đây.
--
-- Bán lẻ không bị chặn — Boss chưa đặt sàn cho kênh đó, giao diện chỉ cảnh báo.

CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_forecast    text;
    v_stage       text;
    v_kind        text;
    v_dealer_unit numeric(14,2);
    v_floor       numeric(14,2);
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

    -- Sàn giá cho khách là đại lý. Chỉ soát khi đã điền giá và đã chọn model;
    -- cơ hội mới lập còn để trống giá thì chưa chặn.
    IF NEW.amount > 0 AND NEW.model_id IS NOT NULL THEN
        SELECT kind INTO v_kind FROM public.crm_accounts WHERE id = NEW.account_id;
        IF v_kind = 'dealer_prospect' THEN
            SELECT dealer_price INTO v_dealer_unit
              FROM public.product_models WHERE id = NEW.model_id;
            IF v_dealer_unit IS NOT NULL THEN
                v_floor := round(v_dealer_unit * COALESCE(NEW.quantity, 1), 2);
                IF NEW.amount < v_floor THEN
                    RAISE EXCEPTION
                        'Giá bán cho đại lý không được thấp hơn sàn % đ (% máy × % đ)',
                        to_char(v_floor, 'FM999,999,999,999'),
                        COALESCE(NEW.quantity, 1),
                        to_char(v_dealer_unit, 'FM999,999,999,999');
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC;
