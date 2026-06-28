-- House dealer for direct /san-pham purchases. No external commission:
-- a FIXED rate_value=0 rule makes calc_commission emit a 0d payout row.
--
-- PREREQUISITE (run once, manually in Supabase Studio before this migration):
--   Authentication -> Add user: email house@dailongai.com, Auto Confirm = ON.
-- profiles.id FK -> auth.users(id), so the auth user must exist first.

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

-- Fail loud if the prerequisite auth user was not created: otherwise the migration
-- exits 0 but submit_public_order('dai-long') throws 'Mã đại lý không hợp lệ' on every
-- direct purchase, with no signal to the operator.
do $$
begin
  if not exists (
    select 1 from public.profiles where order_slug = 'dai-long' and role = 'dealer'
  ) then
    raise exception 'House dealer not created: add auth user house@dailongai.com (Auth -> Add user) before running this migration';
  end if;
end $$;

insert into public.dealer_commissions
  (dealer_id, model_id, commission_type, rate_value, effective_from, set_by)
select p.id, null, 'fixed'::public.commission_type, 0, date '2020-01-01', p.id
from public.profiles p
where p.order_slug = 'dai-long'
  and not exists (
    select 1 from public.dealer_commissions dc
    where dc.dealer_id = p.id and dc.commission_type = 'fixed'
      and dc.model_id is null
  );
