-- Khoảng chiết khấu cho đại lý: 15% tới 20%.
--
-- Boss chốt 01/08/2026: nhân viên được phép chiết khấu cho đại lý 15–20% so với
-- giá niêm yết 29.500.000. Trước đây chỉ chặn một đầu (không được bán dưới
-- dealer_price = 23.600.000, tức không quá 20%), còn bán gần như nguyên giá thì
-- không ai cản.
--
-- Mức chiết khấu TỐI THIỂU để trong crm_settings chứ không phải từng model:
-- đây là chính sách chung, thêm model mới là trần tự suy ra, admin đổi một chỗ.
-- Bảng này ai đăng nhập cũng đọc được (chỉ admin sửa) nên giao diện lấy được.

ALTER TABLE public.crm_settings
    ADD COLUMN IF NOT EXISTS dealer_discount_min numeric(5,4) NOT NULL DEFAULT 0.1500
        CHECK (dealer_discount_min >= 0 AND dealer_discount_min <= 1);

COMMENT ON COLUMN public.crm_settings.dealer_discount_min IS
    'Mức chiết khấu tối thiểu phải dành cho đại lý. Trần giá = base_price × (1 - mức này).';

-- Thay bản ở 20260729130000: thêm trần giá cho đại lý, giữ nguyên phần còn lại.
CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_forecast    text;
    v_stage       text;
    v_kind        text;
    v_dealer_unit numeric(14,2);
    v_base_unit   numeric(14,2);
    v_floor       numeric(14,2);
    v_ceiling     numeric(14,2);
    v_min_disc    numeric(5,4);
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

    -- Khoảng giá cho khách là đại lý. Chỉ soát khi đã điền giá và đã chọn model;
    -- cơ hội mới lập còn để trống giá thì chưa chặn.
    IF NEW.amount > 0 AND NEW.model_id IS NOT NULL THEN
        SELECT kind INTO v_kind FROM public.crm_accounts WHERE id = NEW.account_id;
        IF v_kind = 'dealer_prospect' THEN
            SELECT dealer_price, base_price INTO v_dealer_unit, v_base_unit
              FROM public.product_models WHERE id = NEW.model_id;

            -- dealer_price NULL nghĩa là model chưa có chính sách đại lý: đại lý
            -- mua bằng giá niêm yết, không soát khoảng nào cả.
            IF v_dealer_unit IS NOT NULL THEN
                v_floor := round(v_dealer_unit * COALESCE(NEW.quantity, 1), 2);
                IF NEW.amount < v_floor THEN
                    RAISE EXCEPTION
                        'Giá bán cho đại lý không được thấp hơn sàn % đ (% máy × % đ)',
                        to_char(v_floor, 'FM999,999,999,999'),
                        COALESCE(NEW.quantity, 1),
                        to_char(v_dealer_unit, 'FM999,999,999,999');
                END IF;

                SELECT dealer_discount_min INTO v_min_disc FROM public.crm_settings WHERE id;
                -- GREATEST giữ khoảng giá không bao giờ rỗng: nếu ai đó đặt mức
                -- chiết khấu tối thiểu cao hơn cả mức tối đa của model thì trần
                -- tụt về đúng sàn thay vì chặn sạch mọi giá.
                v_ceiling := GREATEST(
                    round(v_base_unit * (1 - COALESCE(v_min_disc, 0)) * COALESCE(NEW.quantity, 1), 2),
                    v_floor
                );
                IF NEW.amount > v_ceiling THEN
                    -- Ghép sẵn dấu phần trăm vào tham số: trong RAISE, '%%' là dấu
                    -- phần trăm còn '%' là chỗ thay, để cạnh nhau sẽ ra "%15" ngược.
                    RAISE EXCEPTION
                        'Đại lý phải được chiết khấu ít nhất %, giá không được cao hơn % đ (% máy × % đ)',
                        rtrim(to_char(COALESCE(v_min_disc, 0) * 100, 'FM999999.99'), '.') || '%',
                        to_char(v_ceiling, 'FM999,999,999,999'),
                        COALESCE(NEW.quantity, 1),
                        to_char(round(v_ceiling / COALESCE(NEW.quantity, 1), 2), 'FM999,999,999,999');
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC;
