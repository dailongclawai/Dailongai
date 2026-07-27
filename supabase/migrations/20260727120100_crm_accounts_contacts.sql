-- CRM khách hàng + liên hệ.
-- owner_id = người sở hữu bản ghi (dealer/supervisor/admin trong profiles).
-- Phân quyền dùng chung helper crm_owner_visible: self / team của supervisor / admin.

CREATE OR REPLACE FUNCTION public.crm_owner_visible(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p_owner = auth.uid()
        OR public.current_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.profiles d
            WHERE d.id = p_owner AND d.supervisor_id = auth.uid()
        );
$$;

REVOKE EXECUTE ON FUNCTION public.crm_owner_visible(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_owner_visible(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_owner_visible(uuid) TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.crm_account_code_seq;
-- Trigger sinh mã KH chạy dưới quyền người gọi (không SECURITY DEFINER),
-- nên role authenticated phải có USAGE trên sequence, không dựa vào default privileges.
GRANT USAGE, SELECT ON SEQUENCE public.crm_account_code_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    kind text NOT NULL DEFAULT 'customer'
        CHECK (kind IN ('customer', 'dealer_prospect')),
    name text NOT NULL,
    is_individual boolean NOT NULL DEFAULT true,
    phone text,
    email text,
    zalo_phone text,
    tax_code text,
    province text,
    address text,
    source text CHECK (source IS NULL OR source IN
        ('website', 'zalo', 'facebook', 'google_ads', 'tiktok', 'referral', 'hotline', 'event', 'other')),
    referrer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_owner ON public.crm_accounts(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_kind ON public.crm_accounts(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_phone ON public.crm_accounts(phone);

CREATE OR REPLACE FUNCTION public.crm_set_account_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.code := 'KH-' || lpad(nextval('public.crm_account_code_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_accounts_set_code ON public.crm_accounts;
CREATE TRIGGER crm_accounts_set_code
BEFORE INSERT ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.crm_set_account_code();

DROP TRIGGER IF EXISTS crm_accounts_set_updated_at ON public.crm_accounts;
CREATE TRIGGER crm_accounts_set_updated_at
BEFORE UPDATE ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_accounts_select ON public.crm_accounts;
CREATE POLICY crm_accounts_select ON public.crm_accounts
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

DROP POLICY IF EXISTS crm_accounts_insert ON public.crm_accounts;
CREATE POLICY crm_accounts_insert ON public.crm_accounts
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_accounts_update ON public.crm_accounts;
CREATE POLICY crm_accounts_update ON public.crm_accounts
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin')
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_accounts_delete ON public.crm_accounts;
CREATE POLICY crm_accounts_delete ON public.crm_accounts
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    title text,
    phone text,
    email text,
    zalo_phone text,
    is_primary boolean NOT NULL DEFAULT false,
    do_not_call boolean NOT NULL DEFAULT false,
    do_not_email boolean NOT NULL DEFAULT false,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON public.crm_contacts(account_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner ON public.crm_contacts(owner_id, created_at DESC);

DROP TRIGGER IF EXISTS crm_contacts_set_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_set_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_contacts_select ON public.crm_contacts;
CREATE POLICY crm_contacts_select ON public.crm_contacts
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

DROP POLICY IF EXISTS crm_contacts_insert ON public.crm_contacts;
CREATE POLICY crm_contacts_insert ON public.crm_contacts
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_contacts_update ON public.crm_contacts;
CREATE POLICY crm_contacts_update ON public.crm_contacts
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin')
    WITH CHECK (owner_id = auth.uid() OR public.current_role() = 'admin');

DROP POLICY IF EXISTS crm_contacts_delete ON public.crm_contacts;
CREATE POLICY crm_contacts_delete ON public.crm_contacts
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');
