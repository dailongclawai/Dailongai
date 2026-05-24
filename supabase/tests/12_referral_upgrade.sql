BEGIN;
SELECT plan(7);

TRUNCATE public.profiles CASCADE;
DELETE FROM auth.users;

-- A plain signup (no ref) becomes an active dealer automatically
INSERT INTO auth.users (instance_id, id, aud, role, email)
VALUES ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','new1@dailongai.com');
SELECT results_eq(
    $$SELECT role::text, status::text FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a1'$$,
    $$VALUES ('dealer','active')$$,
    'plain signup -> active dealer'
);
SELECT is(
    (SELECT supervisor_id FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a1'),
    NULL,
    'plain signup has no supervisor'
);

-- Seed a supervisor to refer under
INSERT INTO auth.users (instance_id, id, aud, role, email)
VALUES ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000b1','authenticated','authenticated','sup1@dailongai.com');
UPDATE public.profiles SET role='supervisor', status='active', supervisor_id=NULL WHERE id='00000000-0000-0000-0000-0000000000b1';

-- Signup carrying a valid ref in metadata lands under that supervisor
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a2','authenticated','authenticated','new2@dailongai.com',
        '{"ref":"00000000-0000-0000-0000-0000000000b1"}');
SELECT is(
    (SELECT supervisor_id FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a2'),
    '00000000-0000-0000-0000-0000000000b1'::uuid,
    'ref metadata signup -> dealer under that supervisor'
);

-- Garbage ref must not break signup (still becomes a dealer, no supervisor)
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a3','authenticated','authenticated','new3@dailongai.com',
        '{"ref":"not-a-uuid"}');
SELECT is(
    (SELECT supervisor_id FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a3'),
    NULL,
    'invalid ref ignored, signup still succeeds'
);

-- Admin promotes a dealer to supervisor by id; supervisor_id cleared
INSERT INTO auth.users (instance_id, id, aud, role, email)
VALUES ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin1@dailongai.com');
UPDATE public.profiles SET role='admin', status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT lives_ok(
    $$SELECT public.admin_set_supervisor('00000000-0000-0000-0000-0000000000a2'::uuid)$$,
    'admin promotes dealer to supervisor'
);
RESET ROLE;
SELECT results_eq(
    $$SELECT role::text, supervisor_id::text FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a2'$$,
    $$VALUES ('supervisor', NULL::text)$$,
    'promoted profile is supervisor with no supervisor_id'
);

-- claim_referral: a brand-new dealer with no supervisor claims a valid supervisor
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
SELECT public.claim_referral('00000000-0000-0000-0000-0000000000b1'::uuid);
RESET ROLE;
SELECT is(
    (SELECT supervisor_id FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a1'),
    '00000000-0000-0000-0000-0000000000b1'::uuid,
    'claim_referral attaches dealer to supervisor'
);

SELECT * FROM finish();
ROLLBACK;
