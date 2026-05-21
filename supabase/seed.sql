INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'd2@dailongai.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, phone, email, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Boss Admin', '0900000001', 'admin@dailongai.com', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'Supervisor 1', '0900000002', 'sv1@dailongai.com', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'Dealer 1', '0900000003', 'd1@dailongai.com', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'Dealer 2', '0900000004', 'd2@dailongai.com', 'dealer', 'active', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_models (id, code, name, description, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 'Máy laser bán dẫn dòng A', 50000000),
    ('10000000-0000-0000-0000-000000000002', 'ZD-B', 'Zhi Dun B', 'Máy laser bán dẫn dòng B', 80000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by) VALUES
    ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'fixed', 5000000, '2026-01-01', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000004', NULL, 'percent', 8, '2026-01-01', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.supervisor_overrides (supervisor_id, dealer_id, model_id, override_percent, effective_from, set_by) VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, 2.5, '2026-01-01', '00000000-0000-0000-0000-000000000001');
