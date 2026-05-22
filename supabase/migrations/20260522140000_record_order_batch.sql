-- Record several machines (each its own serial) as one checkout. Persists one
-- order row per machine (existing per-serial model) atomically.
CREATE OR REPLACE FUNCTION public.record_order_batch(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_address TEXT,
    p_sale_date DATE,
    p_receipt_image_url TEXT,
    p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_item JSONB;
    v_count INTEGER := 0;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'dealer' THEN
        RAISE EXCEPTION 'record_order_batch: only dealers can record orders';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'record_order_batch: no machines in the order';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.orders
            (dealer_id, model_id, serial_number, customer_name, customer_phone, customer_address, sale_price, sale_date, status, receipt_image_url)
        VALUES
            (auth.uid(),
             (v_item->>'model_id')::uuid,
             v_item->>'serial_number',
             p_customer_name, p_customer_phone, p_customer_address,
             (v_item->>'sale_price')::numeric,
             p_sale_date, 'pending', p_receipt_image_url);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_order_batch TO authenticated;
