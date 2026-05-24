BEGIN;
SELECT plan(8);

TRUNCATE public.profiles, public.product_models CASCADE;
DELETE FROM auth.users;
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','d1@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d2','authenticated','authenticated','d2@dailongai.com'),
    ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@dailongai.com');
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.profiles SET role='dealer', status='active' WHERE id='00000000-0000-0000-0000-0000000000d2';
UPDATE public.profiles SET role='admin',  status='active' WHERE id='00000000-0000-0000-0000-0000000000c1';
INSERT INTO public.product_models (id, code, name, base_price) VALUES
    ('10000000-0000-0000-0000-000000000001','ZD-A','Zhi Dun A',50000000);

-- Record order as dealer1
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT public.record_order(
    '10000000-0000-0000-0000-000000000001','INB-001','Khach','0901234567',NULL,50000000,'2026-05-22',NULL);
RESET ROLE;

-- 1. Approving order fires trigger → dealer gets 1 unread inbox message
UPDATE public.orders
    SET status='approved', approved_at=NOW(),
        approved_by='00000000-0000-0000-0000-0000000000c1'
    WHERE serial_number='INB-001';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.portal_messages
      WHERE recipient_id='00000000-0000-0000-0000-0000000000d1' AND is_read=FALSE$$,
    ARRAY[1],
    'order approval trigger creates 1 unread notification for dealer'
);

-- 2. Dealer can read own messages via RLS
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.portal_messages$$,
    ARRAY[1],
    'dealer sees own inbox messages via RLS'
);

-- 3. Other dealer sees nothing (RLS isolation)
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d2';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.portal_messages$$,
    ARRAY[0],
    'other dealer cannot see dealer1 messages'
);

-- 4. Dealer can send feedback to admin
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT lives_ok(
    $$SELECT public.send_feedback('Feedback tiêu đề', 'Nội dung góp ý từ đại lý')$$,
    'dealer can call send_feedback'
);
RESET ROLE;

-- 5. Admin has 1 feedback message in inbox
SELECT results_eq(
    $$SELECT count(*)::int FROM public.portal_messages
      WHERE recipient_id='00000000-0000-0000-0000-0000000000c1'$$,
    ARRAY[1],
    'feedback message delivered to admin inbox'
);

-- 6. Admin can read all messages (notification + feedback = 2)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c1';
SELECT results_eq(
    $$SELECT count(*)::int FROM public.portal_messages$$,
    ARRAY[2],
    'admin can read all portal messages'
);

-- 7. mark_message_read succeeds
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d1';
SELECT lives_ok(
    $$SELECT public.mark_message_read(
        (SELECT id FROM public.portal_messages
         WHERE recipient_id='00000000-0000-0000-0000-0000000000d1' LIMIT 1))$$,
    'mark_message_read executes without error'
);

-- 8. Message is now marked read
SELECT results_eq(
    $$SELECT count(*)::int FROM public.portal_messages
      WHERE recipient_id='00000000-0000-0000-0000-0000000000d1' AND is_read=FALSE$$,
    ARRAY[0],
    'message is marked as read after mark_message_read'
);

SELECT * FROM finish();
ROLLBACK;
