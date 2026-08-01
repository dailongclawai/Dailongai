-- Boss chốt 02/08/2026: bỏ thao tác gắn đơn tay của nhân viên — hệ thống tự gắn
-- đơn hàng vào cơ hội theo số điện thoại khách. Ba lớp:
--   1) Đơn mới tạo: trigger tìm khách CRM trùng SĐT/Zalo → cơ hội đang mở chưa
--      gắn đơn (tạo sớm nhất) → điền order_id.
--   2) Đơn chuyển paid mà vẫn chưa gắn: hàm hoa hồng thử match lần cuối.
--   3) Đối soát: đơn paid trùng SĐT khách CRM mà không gắn cơ hội nào → cảnh báo
--      để admin gắn tay (ca hiếm: mua hộ bằng số khác, sửa SĐT sau khi lên đơn).
-- UI đi kèm: ô "Đơn hàng đã gắn" chỉ còn admin thấy.

-- ── 1. Tự gắn khi đơn được tạo ───────────────────────────────────────────────

create function public.crm_autolink_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
    v_phone  text;
    v_opp_id uuid;
BEGIN
    v_phone := public.crm_normalize_phone(NEW.customer_phone);
    IF v_phone IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT o.id INTO v_opp_id
      FROM public.crm_opportunities o
      JOIN public.crm_accounts a ON a.id = o.account_id
      JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'open'
     WHERE o.order_id IS NULL
       AND v_phone IN (public.crm_normalize_phone(a.phone), public.crm_normalize_phone(a.zalo_phone))
     ORDER BY o.created_at
     LIMIT 1;

    IF v_opp_id IS NOT NULL THEN
        UPDATE public.crm_opportunities SET order_id = NEW.id WHERE id = v_opp_id;
    END IF;
    RETURN NEW;
END;
$$;

create trigger orders_crm_autolink
    after insert on public.orders
    for each row execute function public.crm_autolink_order();

-- ── 2. Hàm hoa hồng: match theo SĐT lần cuối lúc đơn paid ────────────────────
-- Chép nguyên bản đang chạy (20260802110000-era, đã có thưởng +5% theo vị trí máy),
-- chỉ thêm khối fallback ngay sau lượt tìm theo order_id.

create or replace function public.crm_accrue_staff_commission_on_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
    v_opp         public.crm_opportunities;
    v_owner_role  public.profile_role;
    v_rate        numeric(5,4);
    v_won_stage   uuid;
    v_eligible_at timestamptz;
    v_status      text;
    v_closed      timestamptz;
    v_before      integer;
BEGIN
    IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_opp
      FROM public.crm_opportunities
     WHERE order_id = NEW.id
     ORDER BY created_at
     LIMIT 1;
    IF v_opp.id IS NULL THEN
        -- Đơn chưa được gắn (tạo trước khi khách vào CRM, trigger tự gắn trượt…):
        -- thử match theo SĐT lần cuối rồi mới bỏ qua.
        SELECT o.* INTO v_opp
          FROM public.crm_opportunities o
          JOIN public.crm_accounts a ON a.id = o.account_id
          JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'open'
         WHERE o.order_id IS NULL
           AND public.crm_normalize_phone(NEW.customer_phone) IS NOT NULL
           AND public.crm_normalize_phone(NEW.customer_phone)
               IN (public.crm_normalize_phone(a.phone), public.crm_normalize_phone(a.zalo_phone))
         ORDER BY o.created_at
         LIMIT 1;
        IF v_opp.id IS NULL THEN
            RETURN NEW;
        END IF;
        UPDATE public.crm_opportunities SET order_id = NEW.id WHERE id = v_opp.id;
        v_opp.order_id := NEW.id;
    END IF;

    SELECT id INTO v_won_stage
      FROM public.crm_stages WHERE forecast = 'won' AND active ORDER BY sort_order LIMIT 1;

    IF v_won_stage IS NOT NULL THEN
        IF v_opp.stage_id IS DISTINCT FROM v_won_stage THEN
            UPDATE public.crm_opportunities SET stage_id = v_won_stage WHERE id = v_opp.id;
        END IF;
        UPDATE public.crm_accounts
           SET stage_id = v_won_stage
         WHERE id = v_opp.account_id AND stage_id IS DISTINCT FROM v_won_stage;
    END IF;

    SELECT role INTO v_owner_role FROM public.profiles WHERE id = v_opp.owner_id;
    IF v_owner_role <> 'staff' THEN
        RETURN NEW;   -- admin tự chốt hộ thì không phát sinh hoa hồng
    END IF;

    SELECT staff_rate INTO v_rate FROM public.crm_settings WHERE id;

    -- KPI Boss 01/08/2026: đơn CHỨA máy thứ 10 trở đi trong tháng được +5%
    -- trên giá đơn. Máy xếp thứ tự theo closed_at trong tháng chốt thắng
    -- (giờ VN) — cùng thước đo với crm_kpi_device_month — nên thanh toán trễ
    -- hay về lệch thứ tự không làm sai thưởng. v_opp chụp trước khi đẩy won:
    -- closed_at còn NULL nghĩa là câu UPDATE ở trên vừa điền now() (cùng
    -- transaction) — COALESCE cho ra đúng mốc đó.
    v_closed := COALESCE(v_opp.closed_at, now());
    SELECT COALESCE(sum(o.quantity), 0) INTO v_before
      FROM public.crm_opportunities o
      JOIN public.crm_stages s ON s.id = o.stage_id AND s.forecast = 'won'
     WHERE o.owner_id = v_opp.owner_id
       AND o.id <> v_opp.id
       AND o.closed_at IS NOT NULL
       AND date_trunc('month', o.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
         = date_trunc('month', v_closed AT TIME ZONE 'Asia/Ho_Chi_Minh')
       AND (o.closed_at, o.id) < (v_closed, v_opp.id);
    IF v_before + v_opp.quantity >= 10 THEN
        v_rate := v_rate + 0.05;
    END IF;

    -- Có đồng hành hoàn tiền thì treo tới hết chương trình; không thì chi được ngay.
    IF v_opp.trial_days IS NULL THEN
        v_eligible_at := now();
        v_status := 'payable';
    ELSE
        v_eligible_at := now() + (v_opp.trial_days || ' days')::interval;
        v_status := 'pending';
    END IF;

    INSERT INTO public.crm_staff_commissions
        (opportunity_id, staff_id, order_id, order_value, rate, amount, status, eligible_at)
    VALUES (v_opp.id, v_opp.owner_id, NEW.id, NEW.sale_price, v_rate,
            round(NEW.sale_price * v_rate, 2), v_status, v_eligible_at)
    ON CONFLICT (opportunity_id, staff_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ── 3. Đối soát: đơn paid trùng SĐT khách CRM nhưng chưa gắn cơ hội ──────────

create or replace view public.crm_recon_issues as
SELECT issue,
    ref_id,
    ref_code,
    title,
    party_name,
    who,
    amount,
    expected_amount,
    at
   FROM ( SELECT 'won_no_order'::text AS issue,
            o.id AS ref_id,
            o.code AS ref_code,
            o.name AS title,
            a.name AS party_name,
            COALESCE(d.full_name, d.email) AS who,
            o.amount,
            NULL::numeric AS expected_amount,
            o.closed_at AS at
           FROM crm_opportunities o
             JOIN crm_stages s ON s.id = o.stage_id AND s.forecast = 'won'::text
             LEFT JOIN crm_accounts a ON a.id = o.account_id
             LEFT JOIN crm_staff_directory d ON d.id = o.owner_id
          WHERE o.order_id IS NULL
        UNION ALL
         SELECT 'price_mismatch'::text,
            ord.id,
            ord.serial_number,
            m.name,
            ord.customer_name,
            COALESCE(p.full_name, p.email) AS "coalesce",
            ord.sale_price,
            m.base_price * ord.quantity::numeric,
            ord.created_at
           FROM orders ord
             JOIN product_models m ON m.id = ord.model_id
             LEFT JOIN profiles p ON p.id = ord.dealer_id
          WHERE ord.sale_price <> (m.base_price * ord.quantity::numeric)
        UNION ALL
         SELECT 'paid_order_unlinked'::text,
            ord.id,
            ord.serial_number,
            COALESCE(m.name, '—'),
            ord.customer_name,
            COALESCE(d2.full_name, d2.email),
            ord.sale_price,
            NULL::numeric,
            ord.created_at
           FROM orders ord
             LEFT JOIN product_models m ON m.id = ord.model_id
             JOIN crm_accounts a2
               ON public.crm_normalize_phone(ord.customer_phone) IS NOT NULL
              AND public.crm_normalize_phone(ord.customer_phone)
                  IN (public.crm_normalize_phone(a2.phone), public.crm_normalize_phone(a2.zalo_phone))
             LEFT JOIN crm_staff_directory d2 ON d2.id = a2.owner_id
          WHERE ord.status = 'paid'
            AND NOT EXISTS (SELECT 1 FROM crm_opportunities o2 WHERE o2.order_id = ord.id)) x
  WHERE "current_role"() = 'admin'::profile_role
  ORDER BY at DESC NULLS LAST;
