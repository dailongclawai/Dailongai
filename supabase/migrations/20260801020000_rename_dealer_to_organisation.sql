-- Đổi tên hai loại khách: "khách mua máy" → khách cá nhân, "đại lý tiềm năng"
-- → khách tổ chức.
--
-- Boss chốt 01/08/2026. Giá trị lưu trong cột `kind` giữ nguyên `customer` và
-- `dealer_prospect` — đây chỉ là mã nội bộ, người dùng không thấy, đổi thì phải
-- sửa ràng buộc, khung nhìn và mọi trigger đang so chuỗi mà chẳng được gì thêm.
-- Chỗ người dùng ĐỌC được thì phải đổi: nhãn trên giao diện (đã sửa trong
-- vi.ts/en.ts) và hai câu báo lỗi dưới đây.

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

    -- Khoảng giá cho khách tổ chức. Chỉ soát khi đã điền giá và đã chọn model;
    -- cơ hội mới lập còn để trống giá thì chưa chặn.
    IF NEW.amount > 0 AND NEW.model_id IS NOT NULL THEN
        SELECT kind INTO v_kind FROM public.crm_accounts WHERE id = NEW.account_id;
        IF v_kind = 'dealer_prospect' THEN
            SELECT dealer_price, base_price INTO v_dealer_unit, v_base_unit
              FROM public.product_models WHERE id = NEW.model_id;

            -- dealer_price NULL nghĩa là model chưa đặt giá riêng cho tổ chức:
            -- mua bằng giá niêm yết, không soát khoảng nào cả.
            IF v_dealer_unit IS NOT NULL THEN
                v_floor := round(v_dealer_unit * COALESCE(NEW.quantity, 1), 2);
                IF NEW.amount < v_floor THEN
                    RAISE EXCEPTION
                        'Giá bán cho khách tổ chức không được thấp hơn sàn % đ (% máy × % đ)',
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
                    RAISE EXCEPTION
                        'Khách tổ chức phải được chiết khấu ít nhất %, giá không được cao hơn % đ (% máy × % đ)',
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

COMMENT ON COLUMN public.crm_accounts.kind IS
    'customer = khách cá nhân, dealer_prospect = khách tổ chức. Giá trị giữ tên cũ để không phải sửa ràng buộc và trigger; nhãn người dùng thấy nằm ở tầng dịch.';

COMMENT ON COLUMN public.product_models.dealer_price IS
    'Giá sàn khi bán cho khách tổ chức. NULL nghĩa là tổ chức mua bằng giá niêm yết.';

COMMENT ON COLUMN public.crm_settings.dealer_discount_min IS
    'Chiết khấu tối thiểu phải dành cho khách tổ chức. Trần giá = base_price × (1 - mức này).';
