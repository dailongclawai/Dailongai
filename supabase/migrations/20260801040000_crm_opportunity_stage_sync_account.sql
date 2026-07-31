-- Kéo thẻ ở bảng Cơ hội thì trạng thái khách phải đi theo.
--
-- Boss báo 01/08/2026: đồng bộ mới chỉ có một chiều. Trigger
-- crm_accounts_stage_sync (20260731230000) kéo cơ hội theo khách, nhưng kéo thẻ
-- trên kanban thì khách đứng im. Đã dựng lại đúng lỗi bằng psql trước khi vá.
--
-- Chiều mới KHÔNG được để hai trigger đá nhau: cơ hội đẩy khách, khách lại đẩy
-- mọi cơ hội còn lại của khách đó, thành ra kéo một thẻ làm cả nhóm nhảy theo.
-- Chặn bằng pg_trigger_depth(): trigger khách chỉ lan toả khi CHÍNH người dùng
-- đổi trạng thái khách, không lan khi nó bị trigger cơ hội gọi.

CREATE OR REPLACE FUNCTION public.crm_opportunity_sync_account_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_forecast text;
BEGIN
    SELECT forecast INTO v_forecast FROM public.crm_stages WHERE id = NEW.stage_id;

    -- Một cơ hội thua không có nghĩa là mất khách: khi khách còn cơ hội khác
    -- đang sống thì giữ nguyên trạng thái, đừng dán nhãn "Không mua".
    IF v_forecast = 'lost' AND EXISTS (
        SELECT 1
        FROM public.crm_opportunities o
        JOIN public.crm_stages s ON s.id = o.stage_id
        WHERE o.account_id = NEW.account_id
          AND o.id <> NEW.id
          AND s.forecast <> 'lost'
    ) THEN
        RETURN NEW;
    END IF;

    UPDATE public.crm_accounts
       SET stage_id = NEW.stage_id
     WHERE id = NEW.account_id
       AND stage_id IS DISTINCT FROM NEW.stage_id;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_sync_account_stage() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_opportunities_sync_account ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_sync_account
AFTER UPDATE OF stage_id ON public.crm_opportunities
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.crm_opportunity_sync_account_stage();

-- Thay bản ở 20260731230000: thêm chốt chặn lan ngược.
CREATE OR REPLACE FUNCTION public.crm_account_stage_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_forecast text;
BEGIN
    -- Đang nằm trong một trigger khác nghĩa là trạng thái khách vừa bị chính
    -- trigger cơ hội đẩy sang. Lan tiếp sẽ kéo oan những cơ hội khác của khách.
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    SELECT forecast INTO v_forecast FROM public.crm_stages WHERE id = NEW.stage_id;

    IF v_forecast IS NULL OR v_forecast = 'lost' THEN
        RETURN NEW;
    END IF;

    UPDATE public.crm_opportunities o
       SET stage_id = NEW.stage_id
     WHERE o.account_id = NEW.id
       AND o.stage_id IS DISTINCT FROM NEW.stage_id
       AND o.stage_id IN (SELECT id FROM public.crm_stages WHERE forecast = 'open');

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_account_stage_sync() FROM PUBLIC;
