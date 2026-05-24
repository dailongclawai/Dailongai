BEGIN;
SELECT plan(3);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'newuser@example.com',
    '{"full_name":"New User","avatar_url":"https://lh3/avatar.png"}'::jsonb
);

SELECT results_eq(
    $$SELECT count(*)::int FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY[1],
    'profile row auto-created on auth.users INSERT'
);

SELECT results_eq(
    $$SELECT role::text, status::text FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    $$VALUES ('dealer','active')$$,
    'auto-created profile is an active dealer by default'
);

SELECT results_eq(
    $$SELECT full_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY['New User'],
    'full_name copied from raw_user_meta_data'
);

SELECT * FROM finish();
ROLLBACK;
