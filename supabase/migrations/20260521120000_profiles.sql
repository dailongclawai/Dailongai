CREATE TYPE profile_role AS ENUM ('dealer', 'supervisor', 'admin');
CREATE TYPE profile_status AS ENUM ('pending', 'active', 'suspended');

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    role profile_role,
    status profile_status NOT NULL DEFAULT 'pending',
    supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    business_name TEXT,
    business_address TEXT,
    id_number TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT supervisor_only_for_dealer
        CHECK (supervisor_id IS NULL OR role = 'dealer')
);

CREATE INDEX idx_profiles_supervisor ON public.profiles(supervisor_id) WHERE supervisor_id IS NOT NULL;
CREATE INDEX idx_profiles_role_status ON public.profiles(role, status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
