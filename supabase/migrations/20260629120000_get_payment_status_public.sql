-- Anon/public cannot SELECT orders (RLS only covers admin/dealer/supervisor),
-- so the public PaymentQRCard poll never sees status='paid'. This SECURITY DEFINER
-- RPC exposes ONLY status + paid time for a single order id (uuid = unguessable).
create or replace function public.get_payment_status_public(p_order_id uuid)
returns table (status public.order_status, paid_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.status, o.updated_at
  from public.orders o
  where o.id = p_order_id;
$$;

grant execute on function public.get_payment_status_public(uuid) to anon, authenticated;
