-- Add image_url to product_models for visual product picker.
ALTER TABLE public.product_models ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.product_models
SET image_url = '/images/zhidun-2.webp'
WHERE code = 'ZHIDUN-CEO' AND image_url IS NULL;

-- Expose image_url through the public RPC used by /dat-don and registrations form.
CREATE OR REPLACE FUNCTION public.get_public_active_models()
RETURNS TABLE(id uuid, code text, name text, base_price numeric, image_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
        SELECT m.id, m.code, m.name, m.base_price, m.image_url
        FROM public.product_models m
        WHERE m.active = TRUE
        ORDER BY m.name;
END;
$function$;
