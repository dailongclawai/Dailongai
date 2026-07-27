-- CRM cơ hội bán hàng. stage_id phải thuộc đúng pipeline của cơ hội.
-- Khi vào giai đoạn won/lost thì tự đóng (closed_at); quay lại open thì mở lại.

CREATE SEQUENCE IF NOT EXISTS public.crm_opportunity_code_seq;
GRANT USAGE, SELECT ON SEQUENCE public.crm_opportunity_code_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    pipeline text NOT NULL CHECK (pipeline IN ('b2c_device', 'b2b_dealer')),
    stage_id uuid NOT NULL REFERENCES public.crm_stages(id),
    name text NOT NULL,
    model_id uuid REFERENCES public.product_models(id) ON DELETE SET NULL,
    quantity smallint NOT NULL DEFAULT 1 CHECK (quantity > 0),
    amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    expected_close_date date NOT NULL DEFAULT (current_date + 15),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    closed_at timestamptz,
    lost_reason text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_opps_owner ON public.crm_opportunities(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_opps_stage ON public.crm_opportunities(pipeline, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_account ON public.crm_opportunities(account_id);

CREATE OR REPLACE FUNCTION public.crm_opportunity_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_pipeline text;
    v_forecast text;
BEGIN
    SELECT pipeline, forecast INTO v_pipeline, v_forecast
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
        NEW.lost_reason := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_opportunities_before_write ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_before_write
BEFORE INSERT OR UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_before_write();

DROP TRIGGER IF EXISTS crm_opportunities_set_updated_at ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_set_updated_at
BEFORE UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ghi audit khi đổi giai đoạn (dùng lại write_audit sẵn có)
CREATE OR REPLACE FUNCTION public.crm_opportunity_audit_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
        PERFORM public.write_audit(
            'crm_stage_change',
            'crm_opportunities',
            NEW.id,
            jsonb_build_object('stage_id', OLD.stage_id),
            jsonb_build_object('stage_id', NEW.stage_id)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_opportunities_audit_stage ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_audit_stage
AFTER UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_audit_stage();

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_opps_select ON public.crm_opportunities;
CREATE POLICY crm_opps_select ON public.crm_opportunities
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

-- Ghi phải kiểm CẢ bản ghi cha: khoá ngoại KHÔNG chịu RLS, nên nếu chỉ kiểm
-- owner_id thì một đại lý biết UUID khách của đại lý khác (UUID nằm trên URL vì
-- portal là static export) vẫn tạo được cơ hội gắn vào khách đó.
-- Dùng phép thử SỞ HỮU (a.owner_id), không phải crm_owner_visible: supervisor
-- được ĐỌC khách của nhánh nhưng không được ghi lên đó.
DROP POLICY IF EXISTS crm_opps_insert ON public.crm_opportunities;
CREATE POLICY crm_opps_insert ON public.crm_opportunities
    FOR INSERT TO authenticated
    WITH CHECK (
        (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS crm_opps_update ON public.crm_opportunities;
CREATE POLICY crm_opps_update ON public.crm_opportunities
    FOR UPDATE TO authenticated
    USING (
        (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    )
    WITH CHECK (
        (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS crm_opps_delete ON public.crm_opportunities;
CREATE POLICY crm_opps_delete ON public.crm_opportunities
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_before_write() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_opportunity_audit_stage() FROM PUBLIC;
