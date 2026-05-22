CREATE OR REPLACE FUNCTION public.record_order(
    p_model_id UUID,
    p_serial_number TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_address TEXT,
    p_sale_price NUMERIC,
    p_sale_date DATE,
    p_receipt_image_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_caller_role profile_role;
    v_order_id UUID;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'dealer' THEN
        RAISE EXCEPTION 'record_order: only dealers can record orders';
    END IF;

    INSERT INTO public.orders
        (dealer_id, model_id, serial_number, customer_name, customer_phone, customer_address, sale_price, sale_date, status, receipt_image_url)
    VALUES
        (auth.uid(), p_model_id, p_serial_number, p_customer_name, p_customer_phone, p_customer_address, p_sale_price, p_sale_date, 'pending', p_receipt_image_url)
    RETURNING id INTO v_order_id;

    RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_order TO authenticated;
