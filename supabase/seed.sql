-- Seed users with email/password login enabled (local testing).
-- Password for all 4 accounts: dailong2026
-- Token columns must be '' (not NULL) or GoTrue's user lookup crashes on Scan.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com', crypt('dailong2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sv1@dailongai.com', crypt('dailong2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com', crypt('dailong2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'd2@dailongai.com', crypt('dailong2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    confirmation_token = '', recovery_token = '', email_change = '', email_change_token_new = '';

-- GoTrue requires a matching identities row per email-provider user.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@dailongai.com","email_verified":true}', 'email', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '{"sub":"00000000-0000-0000-0000-000000000002","email":"sv1@dailongai.com","email_verified":true}', 'email', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '{"sub":"00000000-0000-0000-0000-000000000003","email":"d1@dailongai.com","email_verified":true}', 'email', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '{"sub":"00000000-0000-0000-0000-000000000004","email":"d2@dailongai.com","email_verified":true}', 'email', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Profiles: handle_new_user trigger creates blank pending rows on the INSERT above,
-- so DO UPDATE (not DO NOTHING) is required for seed roles to take effect.
INSERT INTO public.profiles (id, full_name, phone, email, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Boss Admin', '0900000001', 'admin@dailongai.com', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'Supervisor 1', '0900000002', 'sv1@dailongai.com', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'Dealer 1', '0900000003', 'd1@dailongai.com', 'dealer', 'active', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000004', 'Dealer 2', '0900000004', 'd2@dailongai.com', 'dealer', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    supervisor_id = EXCLUDED.supervisor_id;

INSERT INTO public.product_models (id, code, name, description, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001', 'ZD-A', 'Zhi Dun A', 'Máy laser bán dẫn dòng A', 50000000),
    ('10000000-0000-0000-0000-000000000002', 'ZD-B', 'Zhi Dun B', 'Máy laser bán dẫn dòng B', 80000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dealer_commissions (dealer_id, model_id, commission_type, rate_value, effective_from, set_by) VALUES
    ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'fixed', 5000000, '2026-01-01', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000004', NULL, 'percent', 8, '2026-01-01', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.supervisor_overrides (supervisor_id, dealer_id, model_id, override_percent, effective_from, set_by) VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, 2.5, '2026-01-01', '00000000-0000-0000-0000-000000000001');

-- Sample orders for visual testing: 3 approved (Dealer 1) → commission payouts + dashboard numbers, 2 pending → admin approval queue.
INSERT INTO public.orders (id, dealer_id, model_id, serial_number, customer_name, customer_phone, sale_price, sale_date, status) VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'SEED-A-001', 'Nguyễn Văn An', '0911000001', 50000000, '2026-05-05', 'pending'),
    ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'SEED-A-002', 'Trần Thị Bình', '0911000002', 50000000, '2026-05-10', 'pending'),
    ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'SEED-A-003', 'Lê Văn Cường', '0911000003', 50000000, '2026-05-15', 'pending'),
    ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'SEED-A-004', 'Phạm Thị Dung', '0911000004', 50000000, '2026-05-18', 'pending'),
    ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'SEED-B-001', 'Hoàng Văn Em', '0911000005', 80000000, '2026-05-20', 'pending');

-- Approve the first 3 → fires commission trigger (dealer fixed 5M each + supervisor 2.5% override).
UPDATE public.orders
SET status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000000001'
WHERE id IN (
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003'
);
