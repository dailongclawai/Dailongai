-- Hoa hồng staff. Snapshot base_price + rate vào từng dòng để đổi cấu hình
-- sau này KHÔNG viết lại quá khứ.
-- Vòng đời: pending (cơ hội thắng) -> payable (admin duyệt) -> paid (đã chi).

CREATE TABLE IF NOT EXISTS public.crm_staff_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES public.profiles(id),
    role_in_deal text NOT NULL CHECK (role_in_deal IN ('closer', 'referrer')),
    pipeline text NOT NULL CHECK (pipeline IN ('b2c_device', 'b2b_dealer')),
    base_price numeric(14,2) NOT NULL CHECK (base_price > 0),
    rate numeric(5,4) NOT NULL CHECK (rate > 0 AND rate <= 1),
    amount numeric(14,2) NOT NULL CHECK (amount >= 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'payable', 'paid', 'void')),
    handover_id uuid REFERENCES public.crm_handovers(id) ON DELETE SET NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    confirmed_at timestamptz,
    confirmed_by uuid REFERENCES public.profiles(id),
    paid_at timestamptz,
    payment_ref text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- một cơ hội chỉ sinh một dòng cho mỗi người ở mỗi vai trò
    UNIQUE (opportunity_id, staff_id, role_in_deal)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_comm_staff
    ON public.crm_staff_commissions(staff_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_staff_comm_status
    ON public.crm_staff_commissions(status, created_at DESC);

DROP TRIGGER IF EXISTS crm_staff_commissions_set_updated_at ON public.crm_staff_commissions;
CREATE TRIGGER crm_staff_commissions_set_updated_at
BEFORE UPDATE ON public.crm_staff_commissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_staff_commissions ENABLE ROW LEVEL SECURITY;

-- Staff chỉ xem của mình; admin xem tất cả. Ghi CHỈ qua trigger/RPC.
DROP POLICY IF EXISTS crm_staff_comm_select ON public.crm_staff_commissions;
CREATE POLICY crm_staff_comm_select ON public.crm_staff_commissions
    FOR SELECT TO authenticated
    USING (staff_id = auth.uid() OR public.current_role() = 'admin');

-- Cơ hội vào giai đoạn thắng -> sinh hoa hồng người chốt + (nếu có handover
-- chưa tất toán) thưởng chéo chia đôi.
CREATE OR REPLACE FUNCTION public.crm_opportunity_accrue_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_forecast text;
    v_cfg public.crm_settings;
    v_rate numeric(5,4);
    v_bonus_total numeric(14,2);
    v_bonus_each numeric(14,2);
    v_handover public.crm_handovers;
    v_owner_role public.profile_role;
BEGIN
    SELECT forecast INTO v_forecast FROM public.crm_stages WHERE id = NEW.stage_id;
    IF v_forecast <> 'won' THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_owner_role FROM public.profiles WHERE id = NEW.owner_id;
    IF v_owner_role <> 'staff' THEN
        RETURN NEW;   -- admin tự chốt hộ thì không phát sinh hoa hồng
    END IF;

    SELECT * INTO v_cfg FROM public.crm_settings WHERE id;
    v_rate := CASE NEW.pipeline
                  WHEN 'b2c_device' THEN v_cfg.staff_rate_b2c
                  ELSE v_cfg.staff_rate_b2b
              END;

    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, role_in_deal, pipeline, base_price, rate, amount, order_id)
    VALUES (NEW.id, NEW.owner_id, 'closer', NEW.pipeline,
            v_cfg.base_price, v_rate,
            round(v_cfg.base_price * v_rate, 2), NEW.order_id)
    ON CONFLICT (opportunity_id, staff_id, role_in_deal) DO NOTHING;

    -- thưởng chuyển khách chéo: handover chưa tất toán, người nhận đúng là
    -- chủ cơ hội này
    SELECT * INTO v_handover
      FROM public.crm_handovers h
     WHERE h.account_id = NEW.account_id
       AND h.settled_at IS NULL
       AND h.to_staff_id = NEW.owner_id
     ORDER BY h.created_at
     LIMIT 1;

    IF v_handover.id IS NOT NULL THEN
        v_bonus_total := round(v_cfg.base_price * v_cfg.crossover_bonus_rate, 2);
        v_bonus_each := round(v_bonus_total / 2, 2);

        INSERT INTO public.crm_staff_commissions
            (opportunity_id, staff_id, role_in_deal, pipeline, base_price, rate, amount, handover_id, order_id)
        VALUES
            (NEW.id, v_handover.from_staff_id, 'referrer', NEW.pipeline,
             v_cfg.base_price, v_cfg.crossover_bonus_rate / 2, v_bonus_each, v_handover.id, NEW.order_id),
            (NEW.id, v_handover.to_staff_id, 'referrer', NEW.pipeline,
             v_cfg.base_price, v_cfg.crossover_bonus_rate / 2, v_bonus_each, v_handover.id, NEW.order_id)
        ON CONFLICT (opportunity_id, staff_id, role_in_deal) DO NOTHING;

        UPDATE public.crm_handovers
           SET settled_at = now(), settled_opportunity_id = NEW.id
         WHERE id = v_handover.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_opportunities_accrue_commission ON public.crm_opportunities;
CREATE TRIGGER crm_opportunities_accrue_commission
AFTER INSERT OR UPDATE OF stage_id ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_accrue_commission();

-- Admin duyệt: pending -> payable (kèm gắn đơn hàng nếu có)
CREATE OR REPLACE FUNCTION public.admin_confirm_staff_deal(
    p_opportunity_id uuid,
    p_order_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được duyệt hoa hồng staff';
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'payable',
           confirmed_at = now(),
           confirmed_by = auth.uid(),
           order_id = COALESCE(p_order_id, order_id)
     WHERE opportunity_id = p_opportunity_id
       AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM public.write_audit('confirm_staff_deal', 'crm_staff_commissions', p_opportunity_id,
        NULL, jsonb_build_object('rows', v_count, 'order_id', p_order_id));
    RETURN v_count;
END;
$$;

-- Admin chi: payable -> paid
CREATE OR REPLACE FUNCTION public.admin_pay_staff_commission(
    p_commission_id uuid,
    p_payment_ref text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb;
BEGIN
    IF public.current_role() <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ admin được chi hoa hồng staff';
    END IF;

    SELECT jsonb_build_object('status', status, 'amount', amount)
      INTO v_before FROM public.crm_staff_commissions WHERE id = p_commission_id;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy dòng hoa hồng %', p_commission_id;
    END IF;
    IF v_before->>'status' <> 'payable' THEN
        RAISE EXCEPTION 'Chỉ chi được dòng đang ở trạng thái payable, hiện tại %', v_before->>'status';
    END IF;

    UPDATE public.crm_staff_commissions
       SET status = 'paid', paid_at = now(), payment_ref = p_payment_ref
     WHERE id = p_commission_id;

    PERFORM public.write_audit('pay_staff_commission', 'crm_staff_commissions', p_commission_id,
        v_before, jsonb_build_object('status', 'paid', 'payment_ref', p_payment_ref));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_opportunity_accrue_commission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_staff_deal(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_staff_deal(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_staff_deal(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_pay_staff_commission(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_pay_staff_commission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_pay_staff_commission(uuid, text) TO authenticated;
