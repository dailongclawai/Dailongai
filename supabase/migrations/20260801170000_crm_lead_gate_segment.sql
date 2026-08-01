-- Boss duyệt 01/08/2026: đăng ký công khai giờ mặc định thành staff, nên vòng
-- chia lead phải có chốt — CHỈ nhân viên đã được admin GÁN MẢNG PHỤ TRÁCH
-- (staff_segment khác NULL, gán ở trang Nâng cấp) mới được nhận lead tự động.
-- Người lạ tự đăng ký thành staff sẽ không nhận được gì cho tới khi admin duyệt
-- bằng cách gán mảng. Thay bản ở 20260801150000, chỉ đổi câu chọn người nhận.

CREATE OR REPLACE FUNCTION public.crm_intake_lead(
    p_name text,
    p_phone text,
    p_email text DEFAULT NULL,
    p_source text DEFAULT 'website',
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_norm     text;
    v_existing public.crm_accounts;
    v_owner    uuid;
    v_source   text;
    v_due      timestamptz;
    v_id       uuid;
    v_code     text;
BEGIN
    IF coalesce(trim(p_name), '') = '' AND coalesce(trim(p_phone), '') = '' THEN
        RAISE EXCEPTION 'crm_intake_lead: cần ít nhất tên hoặc số điện thoại';
    END IF;

    v_source := CASE WHEN p_source IN
        ('website','zalo','facebook','google_ads','tiktok','referral','hotline','event','other')
        THEN p_source ELSE 'other' END;

    IF (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < time '16:00' THEN
        v_due := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + time '17:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';
    ELSE
        v_due := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1 + time '10:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';
    END IF;

    v_norm := public.crm_normalize_phone(p_phone);

    IF v_norm IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.crm_accounts a
         WHERE public.crm_normalize_phone(a.phone) = v_norm LIMIT 1;
        IF v_existing.id IS NOT NULL THEN
            INSERT INTO public.crm_activities (kind, subject, notes, due_at, account_id, owner_id)
            VALUES ('task',
                    'Khách liên hệ lại (' || v_source || '): ' || v_existing.name,
                    '[tự động] ' || coalesce(nullif(trim(p_notes), ''), 'Khách để lại thông tin lần nữa.'),
                    v_due, v_existing.id, v_existing.owner_id);
            RETURN jsonb_build_object('result', 'existing', 'account_code', v_existing.code);
        END IF;
    END IF;

    -- Chốt an toàn: phải có mảng phụ trách mới được vào vòng chia lead.
    SELECT p.id INTO v_owner
      FROM public.profiles p
     WHERE p.role = 'staff' AND p.status = 'active' AND p.staff_segment IS NOT NULL
     ORDER BY (SELECT count(*) FROM public.crm_accounts a
                WHERE a.owner_id = p.id AND a.created_at > now() - interval '30 days') ASC,
              p.account_no ASC
     LIMIT 1;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'crm_intake_lead: chưa có nhân viên nào được gán mảng phụ trách để nhận lead';
    END IF;

    INSERT INTO public.crm_accounts (name, kind, phone, email, source, notes, owner_id)
    VALUES (coalesce(nullif(trim(p_name), ''), 'Khách ' || coalesce(v_norm, '?')),
            'customer', nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
            v_source, nullif(trim(p_notes), ''), v_owner)
    RETURNING id, code INTO v_id, v_code;

    RETURN jsonb_build_object('result', 'created', 'account_code', v_code,
        'owner_email', (SELECT email FROM public.profiles WHERE id = v_owner));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_intake_lead(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_intake_lead(text, text, text, text, text) TO service_role;
