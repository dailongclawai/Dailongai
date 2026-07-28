-- Chuyển khách chéo B2C ↔ B2B giữa staff.
-- Deal thắng ĐẦU TIÊN của người nhận trên khách này sẽ tất toán handover
-- và sinh thưởng 5% giá cơ sở chia đôi (xem migration hoa hồng).

CREATE TABLE IF NOT EXISTS public.crm_handovers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    from_staff_id uuid NOT NULL REFERENCES public.profiles(id),
    to_staff_id uuid NOT NULL REFERENCES public.profiles(id),
    from_segment text NOT NULL CHECK (from_segment IN ('b2c', 'b2b')),
    to_segment text NOT NULL CHECK (to_segment IN ('b2c', 'b2b')),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    settled_at timestamptz,
    settled_opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
    CONSTRAINT crm_handovers_cross_segment CHECK (from_segment <> to_segment),
    CONSTRAINT crm_handovers_two_people CHECK (from_staff_id <> to_staff_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_handovers_account ON public.crm_handovers(account_id, settled_at);
CREATE INDEX IF NOT EXISTS idx_crm_handovers_from ON public.crm_handovers(from_staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_handovers_to ON public.crm_handovers(to_staff_id, created_at DESC);

ALTER TABLE public.crm_handovers ENABLE ROW LEVEL SECURITY;

-- Hai bên liên quan và admin đọc được; ghi CHỈ qua RPC bên dưới.
DROP POLICY IF EXISTS crm_handovers_select ON public.crm_handovers;
CREATE POLICY crm_handovers_select ON public.crm_handovers
    FOR SELECT TO authenticated
    USING (
        from_staff_id = auth.uid()
        OR to_staff_id = auth.uid()
        OR public.current_role() = 'admin'
    );

-- Bắn khách sang staff mảng đối diện. Đổi luôn chủ sở hữu khách + liên hệ,
-- người bắn vẫn đọc được khách đó nhờ policy crm_accounts_select.
CREATE OR REPLACE FUNCTION public.staff_handover_account(
    p_account_id uuid,
    p_to_staff uuid,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_from_segment text;
    v_to_segment text;
    v_owner uuid;
    v_id uuid;
BEGIN
    SELECT staff_segment INTO v_from_segment
      FROM public.profiles WHERE id = auth.uid() AND role = 'staff';
    IF v_from_segment IS NULL THEN
        RAISE EXCEPTION 'Chỉ staff có mảng phụ trách mới bắn khách được';
    END IF;

    SELECT staff_segment INTO v_to_segment
      FROM public.profiles
     WHERE id = p_to_staff AND role = 'staff' AND status = 'active';
    IF v_to_segment IS NULL THEN
        RAISE EXCEPTION 'Người nhận phải là staff đang hoạt động';
    END IF;

    IF v_to_segment = v_from_segment THEN
        RAISE EXCEPTION 'Chỉ bắn khách sang staff mảng khác (% -> %)', v_from_segment, v_to_segment;
    END IF;

    SELECT owner_id INTO v_owner FROM public.crm_accounts WHERE id = p_account_id;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy khách hàng %', p_account_id;
    END IF;
    IF v_owner <> auth.uid() THEN
        RAISE EXCEPTION 'Chỉ bắn được khách của chính mình';
    END IF;

    INSERT INTO public.crm_handovers
        (account_id, from_staff_id, to_staff_id, from_segment, to_segment, note)
    VALUES (p_account_id, auth.uid(), p_to_staff, v_from_segment, v_to_segment, p_note)
    RETURNING id INTO v_id;

    UPDATE public.crm_accounts SET owner_id = p_to_staff WHERE id = p_account_id;
    UPDATE public.crm_contacts SET owner_id = p_to_staff WHERE account_id = p_account_id;

    PERFORM public.write_audit('crm_handover', 'crm_accounts', p_account_id,
        jsonb_build_object('owner_id', v_owner),
        jsonb_build_object('owner_id', p_to_staff, 'handover_id', v_id));

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_handover_account(uuid, uuid, text) TO authenticated;
