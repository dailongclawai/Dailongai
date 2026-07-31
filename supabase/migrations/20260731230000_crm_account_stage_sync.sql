-- Đổi giai đoạn của khách thì cơ hội đang mở của khách đó đi theo.
--
-- Boss chốt 31/07/2026: bảng Khách hàng và trang Cơ hội phải luôn khớp nhau.
-- Từ 29/07 `crm_accounts.stage_id` là cột riêng do nhân viên tự chọn
-- (20260729110000), nên đổi ở bảng Khách hàng không động gì tới cơ hội.
--
-- Luật: chỉ kéo những cơ hội CÒN ĐANG MỞ. Cơ hội đã thắng hoặc đã thua giữ
-- nguyên vì chúng đã đóng sổ.
--
-- Giai đoạn đích là "lost" thì trigger KHÔNG kéo: `crm_opportunity_before_write`
-- bắt buộc có lý do mất, mà lý do thì phải hỏi người dùng. Giao diện lo phần đó
-- rồi gọi thẳng lên từng cơ hội kèm lý do.
--
-- SECURITY DEFINER: người gọi đã qua được RLS của `crm_accounts` để sửa khách
-- này, nên có quyền kéo cơ hội của chính khách đó — kể cả cơ hội đã bàn giao
-- cho nhân viên mảng khác.

CREATE OR REPLACE FUNCTION public.crm_account_stage_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_forecast text;
BEGIN
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

DROP TRIGGER IF EXISTS crm_accounts_stage_sync ON public.crm_accounts;
CREATE TRIGGER crm_accounts_stage_sync
AFTER UPDATE OF stage_id ON public.crm_accounts
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.crm_account_stage_sync();
