-- Payout bank account verification via Zalo OTP + QR upload audit trail.
--
-- Flow:
--   1. Dealer uploads QR (client decodes via jsQR, autofills form).
--   2. Dealer enters Zalo phone + clicks "Gửi mã".
--   3. RPC request_payout_otp() generates 6-digit code, stores pending change.
--   4. Edge function send-payout-otp delivers code via Zalo OA (zalo.longanhai.com bridge).
--   5. Dealer enters code → RPC verify_payout_otp() commits change + marks payout_verified_at.

-- 1. Profile columns -----------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS zalo_phone TEXT,
    ADD COLUMN IF NOT EXISTS payout_qr_path TEXT,
    ADD COLUMN IF NOT EXISTS payout_verified_at TIMESTAMPTZ;

-- 2. Storage bucket for uploaded QR images -------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dealer-payout-qr', 'dealer-payout-qr', FALSE, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS: owner can manage own folder (path prefix = user id)
CREATE POLICY dealer_payout_qr_owner_write
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'dealer-payout-qr'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY dealer_payout_qr_owner_update
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'dealer-payout-qr'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY dealer_payout_qr_owner_read
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'dealer-payout-qr'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.current_role() = 'admin'
      )
    );

CREATE POLICY dealer_payout_qr_owner_delete
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'dealer-payout-qr'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 3. Pending OTP table ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_otp (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    zalo_phone      TEXT NOT NULL,
    bank_short      TEXT NOT NULL,
    bank_account    TEXT NOT NULL,
    bank_holder     TEXT NOT NULL,
    qr_path         TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    attempts        INT NOT NULL DEFAULT 0,
    delivered_via   TEXT,           -- 'zalo' | 'telegram_fallback' | NULL
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_otp_user ON public.payout_otp(user_id, created_at DESC);

ALTER TABLE public.payout_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY payout_otp_owner_read
    ON public.payout_otp FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies — all mutations go through SECURITY DEFINER RPCs below.

-- 4. Zalo OA bridge state (token + phone↔user_id mapping) ----------------
-- Populated by the Zalo bot daemon (separate sync); read by the edge function.
CREATE TABLE IF NOT EXISTS public.zalo_oa_users (
    zalo_user_id    TEXT PRIMARY KEY,
    phone           TEXT,
    name            TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zalo_oa_users_phone ON public.zalo_oa_users(phone) WHERE phone IS NOT NULL;
ALTER TABLE public.zalo_oa_users ENABLE ROW LEVEL SECURITY;
-- No public access; only service_role (edge fn + bot sync) reads/writes.

-- 5. RPC: request_payout_otp --------------------------------------------
CREATE OR REPLACE FUNCTION public.request_payout_otp(
    p_phone        TEXT,
    p_bank_short   TEXT,
    p_bank_account TEXT,
    p_bank_holder  TEXT,
    p_qr_path      TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user UUID := auth.uid();
    v_code TEXT;
    v_id   UUID;
    v_recent INT;
BEGIN
    IF v_user IS NULL THEN
      RAISE EXCEPTION 'not authenticated';
    END IF;

    -- Basic input validation
    IF p_phone !~ '^0\d{9}$' THEN
      RAISE EXCEPTION 'phone_invalid';
    END IF;
    IF p_bank_short IS NULL OR length(p_bank_short) < 2 THEN
      RAISE EXCEPTION 'bank_required';
    END IF;
    IF p_bank_account !~ '^\d{6,20}$' THEN
      RAISE EXCEPTION 'account_invalid';
    END IF;
    IF p_bank_holder IS NULL OR length(trim(p_bank_holder)) < 2 THEN
      RAISE EXCEPTION 'holder_required';
    END IF;

    -- Throttle: max 5 OTP requests per user per hour
    SELECT count(*) INTO v_recent
    FROM public.payout_otp
    WHERE user_id = v_user AND created_at > NOW() - INTERVAL '1 hour';
    IF v_recent >= 5 THEN
      RAISE EXCEPTION 'rate_limited';
    END IF;

    -- 6-digit numeric code
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

    INSERT INTO public.payout_otp
      (user_id, code, zalo_phone, bank_short, bank_account, bank_holder, qr_path, expires_at)
    VALUES
      (v_user, v_code, p_phone, p_bank_short, p_bank_account, upper(trim(p_bank_holder)), p_qr_path,
       NOW() + INTERVAL '10 minutes')
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_payout_otp(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 6. RPC: verify_payout_otp ---------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_payout_otp(
    p_otp_id UUID,
    p_code   TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user UUID := auth.uid();
    r RECORD;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

    SELECT * INTO r FROM public.payout_otp
      WHERE id = p_otp_id AND user_id = v_user
      FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'otp_not_found'; END IF;
    IF r.used_at IS NOT NULL THEN RAISE EXCEPTION 'otp_used'; END IF;
    IF r.expires_at < NOW() THEN RAISE EXCEPTION 'otp_expired'; END IF;
    IF r.attempts >= 5 THEN RAISE EXCEPTION 'otp_locked'; END IF;

    IF r.code <> p_code THEN
      UPDATE public.payout_otp SET attempts = attempts + 1 WHERE id = p_otp_id;
      RAISE EXCEPTION 'otp_mismatch';
    END IF;

    -- Commit: write bank info onto profile + mark verified
    UPDATE public.profiles SET
      bank_name           = r.bank_short,
      bank_account_name   = r.bank_holder,
      bank_account_number = r.bank_account,
      zalo_phone          = r.zalo_phone,
      payout_qr_path      = COALESCE(r.qr_path, payout_qr_path),
      payout_verified_at  = NOW()
    WHERE id = v_user;

    UPDATE public.payout_otp SET used_at = NOW() WHERE id = p_otp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_payout_otp(UUID, TEXT) TO authenticated;
