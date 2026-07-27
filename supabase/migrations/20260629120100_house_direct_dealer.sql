-- House dealer for direct /san-pham purchases ("Đại Long trực tiếp").
--
-- PREREQUISITE (run once, in Supabase Studio before this migration):
--   Authentication -> Add user: email house@dailongai.com, Auto Confirm = ON.
--   (Or insert into auth.users directly.) profiles.id FK -> auth.users(id).
--
-- No external commission: the commission system has no 0-value path
-- (dealer_commissions_fixed_range_chk forces fixed ∈ [4.5M, 7.5M]; the tier
-- floor is 15%). So the house earns nothing via calc_commission instead — see
-- 20260629120200_calc_commission_skip_house.sql. Here we just give the house its
-- profile/slug and strip the auto-created default commission rule.

-- Tự tạo auth user nếu chưa có, để `supabase db reset` trên máy trắng không chết.
-- Trên prod migration này đã chạy xong nên nhánh này không đụng tới dữ liệu thật.
-- Tài khoản house không dùng để đăng nhập nên không cần mật khẩu / auth.identities.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'house@dailongai.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       '', '', '', ''
where not exists (select 1 from auth.users where email = 'house@dailongai.com');

insert into public.profiles (id, role, status, full_name, order_slug)
select u.id, 'dealer'::public.profile_role, 'active'::public.profile_status,
       'Đại Long trực tiếp', 'dai-long'
from auth.users u
where u.email = 'house@dailongai.com'
on conflict (id) do update
  set role = 'dealer'::public.profile_role,
      status = 'active'::public.profile_status,
      full_name = 'Đại Long trực tiếp',
      order_slug = 'dai-long';

-- Fail loud if the prerequisite auth user was not created.
do $$
begin
  if not exists (
    select 1 from public.profiles where order_slug = 'dai-long' and role = 'dealer'
  ) then
    raise exception 'House dealer not created: add auth user house@dailongai.com (Auth -> Add user) before running this migration';
  end if;
end $$;

-- House earns nothing; remove the default rule handle_new_user() auto-creates.
delete from public.dealer_commissions dc
using public.profiles p
where dc.dealer_id = p.id and p.order_slug = 'dai-long';
