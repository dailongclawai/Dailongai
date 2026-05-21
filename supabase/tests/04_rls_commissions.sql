BEGIN;
SELECT plan(4);

-- Hermetic: clear any seed data so test fixtures load cleanly. ROLLBACK restores.
TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sv1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'd1@dailongai.com');

INSERT INTO public.profiles (id, full_name, role, status, supervisor_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'active', NULL),
    ('00000000-0000-0000-0000-000000000002', 'SV1', 'supervisor', 'active', NULL),
    ('00000000-0000-0000-0000-000000000003', 'D1', 'dealer', 'active', '00000000-0000-0000-0000-000000000002');

INSERT INTO public.dealer_commissions
    (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000003', NULL, 'fixed', 5000000, '2026-01-01', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.supervisor_overrides
    (supervisor_id, dealer_id, model_id, override_percent, effective_from, set_by)
VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, 2.5, '2026-01-01', '00000000-0000-0000-0000-000000000001');

-- Dealer sees own commission rule
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
SELECT results_eq(
    'SELECT count(*)::int FROM public.dealer_commissions',
    ARRAY[1],
    'dealer sees own commission rule'
);

SELECT results_eq(
    'SELECT count(*)::int FROM public.supervisor_overrides',
    ARRAY[0],
    'dealer cannot see supervisor_overrides'
);

-- Supervisor sees own override
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
SELECT results_eq(
    'SELECT count(*)::int FROM public.supervisor_overrides',
    ARRAY[1],
    'supervisor sees own override'
);

-- Admin sees all rules
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
SELECT results_eq(
    'SELECT (SELECT count(*)::int FROM public.dealer_commissions) + (SELECT count(*)::int FROM public.supervisor_overrides)',
    ARRAY[2],
    'admin sees all commission + override rules'
);

SELECT * FROM finish();
ROLLBACK;
