-- Boss chốt 01/08/2026: tài khoản mới đăng ký mặc định là STAFF (nhân viên
-- kinh doanh), không còn là dealer.
--
-- Ngoại lệ giữ nguyên: đăng ký qua link giới thiệu của supervisor (?ref=...)
-- vẫn thành DEALER thuộc supervisor đó — đó là phễu tuyển đại lý có chủ đích,
-- kèm gói hoa hồng phẳng 15% như cũ. Gói 15% này KHÔNG sinh cho staff nữa
-- (hoa hồng staff đi đường crm_staff_commissions theo crm_settings.staff_rate).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_ref_text TEXT;
    v_ref UUID;
    v_supervisor UUID := NULL;
    v_role public.profile_role;
BEGIN
    v_ref_text := NULLIF(NEW.raw_user_meta_data->>'ref', '');
    IF v_ref_text IS NOT NULL THEN
        BEGIN
            v_ref := v_ref_text::uuid;
        EXCEPTION WHEN others THEN
            v_ref := NULL;
        END;
    END IF;

    IF v_ref IS NOT NULL AND v_ref <> NEW.id
       AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_ref AND role = 'supervisor') THEN
        v_supervisor := v_ref;
    END IF;

    -- Có người giới thiệu hợp lệ → dealer dưới supervisor đó; còn lại → staff.
    v_role := CASE WHEN v_supervisor IS NOT NULL THEN 'dealer'::public.profile_role
                   ELSE 'staff'::public.profile_role END;

    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status, supervisor_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url',
        v_role,
        'active',
        v_supervisor
    )
    ON CONFLICT (id) DO NOTHING;

    -- Gói hoa hồng phẳng 15% chỉ dành cho dealer.
    IF v_role = 'dealer' THEN
        INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
        SELECT NEW.id, NULL, 'percent', 15, CURRENT_DATE, NEW.id
        WHERE NOT EXISTS (SELECT 1 FROM public.dealer_commissions WHERE dealer_id = NEW.id);
    END IF;

    RETURN NEW;
END;
$$;
