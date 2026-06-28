-- Anon/public cannot SELECT orders (RLS only covers admin/dealer/supervisor),
-- so the public PaymentQRCard poll never sees status='paid'. This SECURITY DEFINER
-- RPC exposes ONLY the status enum for a single order id (uuid = unguessable).
create or replace function public.get_payment_status_public(p_order_id uuid)
returns table (status public.order_status)
language sql
security definer
set search_path = public
as $$
  select o.status
  from public.orders o
  where o.id = p_order_id;
$$;

grant execute on function public.get_payment_status_public(uuid) to anon, authenticated;
