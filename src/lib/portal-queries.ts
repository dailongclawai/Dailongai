import { getSupabaseClient } from './supabase';
import type { Order, DealerSummary, TeamMember, UnassignedDealer, FleetSummary, ProductModel, CommissionPlan, DealerCurrentCommission, PortalMessage, PayoutRow, AdminPayoutRow, AuditEntry } from './portal-types';

export async function getCommissionPlans(): Promise<CommissionPlan[]> {
  const { data } = await getSupabaseClient()
    .from('commission_plans')
    .select('*')
    .eq('active', true)
    .order('commission_type')
    .order('rate_value');
  return (data as CommissionPlan[]) ?? [];
}

export async function setDealerFixedCommission(dealerId: string, amount: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc('supervisor_set_dealer_fixed_commission', {
    p_dealer_id: dealerId,
    p_amount: amount,
  });
  if (error) throw error;
}

export async function clearDealerFixedCommission(dealerId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('supervisor_clear_dealer_fixed_commission', {
    p_dealer_id: dealerId,
  });
  if (error) throw error;
}

export interface LeaderboardRow {
  dealer_id: string;
  dealer_name: string | null;
  month_sales: number;
  month_units: number;
  units_ytd: number;
  sales_7d: number;
}

export interface SupervisorFunnel {
  period_days: number;
  views: number;
  unique_visitors: number;
  signups: number;
  first_orders: number;
  view_to_signup_pct: number;
  signup_to_order_pct: number;
  view_to_order_pct: number;
}

export async function getSupervisorFunnel(days = 30, supervisorId?: string): Promise<SupervisorFunnel | null> {
  const { data, error } = await getSupabaseClient().rpc('get_supervisor_funnel', {
    p_supervisor_id: supervisorId ?? null,
    p_days: days,
  });
  if (error) throw error;
  return (data as SupervisorFunnel[])?.[0] ?? null;
}

export interface DealerQrFunnel {
  period_days: number;
  views: number;
  unique_visitors: number;
  orders_via_qr: number;
  conversion_pct: number;
}

export async function getDealerQrFunnel(days = 30, dealerId?: string): Promise<DealerQrFunnel | null> {
  const { data, error } = await getSupabaseClient().rpc('get_dealer_qr_funnel', {
    p_dealer_id: dealerId ?? null,
    p_days: days,
  });
  if (error) throw error;
  return (data as DealerQrFunnel[])?.[0] ?? null;
}

export async function getTeamLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('team_leaderboard')
    .select('*');
  if (error) throw error;
  return (data as LeaderboardRow[]) ?? [];
}

export async function getDealerCurrentCommissions(dealerIds: string[]): Promise<Record<string, DealerCurrentCommission>> {
  if (dealerIds.length === 0) return {};
  const { data, error } = await getSupabaseClient()
    .from('dealer_current_commission')
    .select('*')
    .in('dealer_id', dealerIds);
  if (error) throw error;
  const map: Record<string, DealerCurrentCommission> = {};
  for (const row of (data as DealerCurrentCommission[]) ?? []) map[row.dealer_id] = row;
  return map;
}

export async function getDealerSummary(dealerId: string): Promise<DealerSummary | null> {
  const { data } = await getSupabaseClient()
    .from('dealer_dashboard_summary')
    .select('*')
    .eq('dealer_id', dealerId)
    .maybeSingle();
  return (data as DealerSummary) ?? null;
}

export async function getDealerOrders(dealerId: string): Promise<Order[]> {
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('*')
    .eq('dealer_id', dealerId)
    .order('sale_date', { ascending: false });
  return (data as Order[]) ?? [];
}

// ── Public order intake via QR slug ─────────────────────────────────
export interface PublicActiveModel {
  id: string;
  code: string;
  name: string;
  base_price: number;
  image_url: string | null;
}

export async function getPublicDealerInfo(slug: string): Promise<{ dealer_id: string; dealer_name: string } | null> {
  const { data, error } = await getSupabaseClient().rpc('get_public_dealer_info', { p_slug: slug });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.dealer_name ? { dealer_id: row.dealer_id, dealer_name: row.dealer_name } : null;
}

export async function getPublicActiveModels(): Promise<PublicActiveModel[]> {
  const { data, error } = await getSupabaseClient().rpc('get_public_active_models');
  if (error || !data) return [];
  return (data as Array<{ id: string; code: string; name: string; base_price: number | string; image_url: string | null }>).map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    base_price: Number(m.base_price),
    image_url: m.image_url ?? null,
  }));
}

export interface OrderInvoiceInput {
  invoice_required?: boolean;
  invoice_company_name?: string | null;
  invoice_tax_code?: string | null;
  invoice_email?: string | null;
}

export async function recordDealerOrder(input: {
  model_id: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  sale_date?: string;
} & OrderInvoiceInput): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('record_dealer_order', {
    p_model_id: input.model_id,
    p_quantity: input.quantity,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_shipping_address: input.shipping_address,
    p_sale_date: input.sale_date,
    p_invoice_required: input.invoice_required ?? false,
    p_invoice_company_name: input.invoice_company_name ?? null,
    p_invoice_tax_code: input.invoice_tax_code ?? null,
    p_invoice_email: input.invoice_email ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function submitPublicOrder(input: {
  slug: string;
  model_id: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
} & OrderInvoiceInput): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('submit_public_order', {
    p_slug: input.slug,
    p_model_id: input.model_id,
    p_quantity: input.quantity,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_shipping_address: input.shipping_address,
    p_invoice_required: input.invoice_required ?? false,
    p_invoice_company_name: input.invoice_company_name ?? null,
    p_invoice_tax_code: input.invoice_tax_code ?? null,
    p_invoice_email: input.invoice_email ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getActiveModels(): Promise<ProductModel[]> {
  const { data } = await getSupabaseClient()
    .from('product_models')
    .select('*')
    .eq('active', true)
    .order('code');
  return (data as ProductModel[]) ?? [];
}

export async function getSupervisorTeam(supervisorId: string): Promise<TeamMember[]> {
  const { data } = await getSupabaseClient()
    .from('supervisor_team_summary')
    .select('*')
    .eq('supervisor_id', supervisorId);
  return (data as TeamMember[]) ?? [];
}

export async function getAdminFleet(): Promise<FleetSummary | null> {
  const { data } = await getSupabaseClient().from('admin_fleet_summary').select('*').maybeSingle();
  return (data as FleetSummary) ?? null;
}

export async function getPendingOrders(): Promise<Order[]> {
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return (data as Order[]) ?? [];
}

export async function getRecentOrdersAll(limit = 200): Promise<Order[]> {
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as Order[]) ?? [];
}

export interface RecordOrderInput {
  modelId: string;
  serialNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  salePrice: number;
  saleDate: string;
  receiptImageUrl: string | null;
}

export async function recordOrder(input: RecordOrderInput): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('record_order', {
    p_model_id: input.modelId,
    p_serial_number: input.serialNumber,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_address: input.customerAddress,
    p_sale_price: input.salePrice,
    p_sale_date: input.saleDate,
    p_receipt_image_url: input.receiptImageUrl,
  });
  if (error) throw error;
  return data as string;
}

export interface BatchItem {
  model_id: string;
  serial_number: string;
  sale_price: number;
}

export async function recordOrderBatch(input: {
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  saleDate: string;
  receiptImageUrl: string | null;
  items: BatchItem[];
}): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('record_order_batch', {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_address: input.customerAddress,
    p_sale_date: input.saleDate,
    p_receipt_image_url: input.receiptImageUrl,
    p_items: input.items,
  });
  if (error) throw error;
  return data as number;
}

export async function uploadReceipt(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const client = getSupabaseClient();
  const { error } = await client.storage.from('receipts').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function approveOrder(orderId: string, adminId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('orders')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: adminId })
    .eq('id', orderId);
  if (error) throw error;
}

export async function rejectOrder(orderId: string, reason: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('orders')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', orderId);
  if (error) throw error;
}

// Manual override when Casso webhook misses a payment (rare). Bumps pending→approved→paid.
export async function markOrderPaid(orderId: string, adminId: string): Promise<void> {
  const { error: appErr } = await getSupabaseClient()
    .from('orders')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: adminId })
    .eq('id', orderId)
    .eq('status', 'pending');
  if (appErr) throw appErr;
  const { error: paidErr } = await getSupabaseClient()
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId);
  if (paidErr) throw paidErr;
}

// Void a paid order (e.g. refund / customer cancellation). Marks voided_at on commission too.
export async function voidOrder(orderId: string, adminId: string, reason: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error: ordErr } = await sb
    .from('orders')
    .update({ status: 'voided', voided_at: new Date().toISOString(), voided_by: adminId, rejection_reason: reason })
    .eq('id', orderId);
  if (ordErr) throw ordErr;
  // Cascade: void related commission payouts
  await sb
    .from('commission_payouts')
    .update({ voided_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .is('voided_at', null);
}

export async function getInboxMessages(): Promise<PortalMessage[]> {
  const { data } = await getSupabaseClient()
    .from('portal_messages')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as PortalMessage[]) ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session) return 0;
  const { count } = await getSupabaseClient()
    .from('portal_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', session.user.id)
    .eq('is_read', false);
  return count ?? 0;
}

export async function sendFeedback(subject: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('send_feedback', {
    p_subject: subject,
    p_body: body,
  });
  if (error) throw error;
}

export async function markMessageRead(messageId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_message_read', {
    p_message_id: messageId,
  });
  if (error) throw error;
}

export async function markAllMessagesRead(): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('mark_all_messages_read');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function adminReply(messageId: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_reply', {
    p_message_id: messageId,
    p_body: body,
  });
  if (error) throw error;
}

export async function getMyPayouts(): Promise<PayoutRow[]> {
  const { data } = await getSupabaseClient()
    .from('commission_payouts')
    .select('*')
    .is('voided_at', null)
    .order('calculated_at', { ascending: false });
  return (data as PayoutRow[]) ?? [];
}

export async function getAdminPayoutQueue(): Promise<AdminPayoutRow[]> {
  const { data } = await getSupabaseClient()
    .from('admin_payout_queue')
    .select('*')
    .order('calculated_at', { ascending: false });
  return (data as AdminPayoutRow[]) ?? [];
}

export async function adminProcessPayout(payoutId: string, proofRef: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_process_payout', {
    p_payout_id: payoutId,
    p_proof_ref: proofRef,
  });
  if (error) throw error;
}

// ── Product models (admin) ──────────────────────────────────────────────
export async function getAllModels(): Promise<ProductModel[]> {
  const { data } = await getSupabaseClient()
    .from('product_models')
    .select('*')
    .order('active', { ascending: false })
    .order('code');
  return (data as ProductModel[]) ?? [];
}

export interface ModelInput {
  code: string;
  name: string;
  description: string | null;
  base_price: number;
  active: boolean;
}

export async function createModel(input: ModelInput): Promise<void> {
  const { error } = await getSupabaseClient().from('product_models').insert(input);
  if (error) throw error;
}

export async function updateModel(id: string, input: Partial<ModelInput>): Promise<void> {
  const { error } = await getSupabaseClient().from('product_models').update(input).eq('id', id);
  if (error) throw error;
}

// ── Commission ledger (dealer) ──────────────────────────────────────────
export interface LedgerCommission {
  amount: string;
  paid_at: string | null;
  voided_at: string | null;
  payment_proof_url: string | null;
  recipient_role: 'dealer' | 'supervisor';
}
export interface LedgerRow {
  id: string;
  serial_number: string;
  customer_name: string;
  sale_price: number;
  sale_date: string;
  status: Order['status'];
  commission: LedgerCommission | null;
}

export async function getDealerLedger(dealerId: string): Promise<LedgerRow[]> {
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('id, serial_number, customer_name, sale_price, sale_date, status, commission_payouts(amount, paid_at, voided_at, payment_proof_url, recipient_role)')
    .eq('dealer_id', dealerId)
    .order('sale_date', { ascending: false });
  type Raw = Omit<LedgerRow, 'commission'> & { commission_payouts: LedgerCommission[] | null };
  return ((data as Raw[] | null) ?? []).map((o) => ({
    id: o.id,
    serial_number: o.serial_number,
    customer_name: o.customer_name,
    sale_price: o.sale_price,
    sale_date: o.sale_date,
    status: o.status,
    commission: (o.commission_payouts ?? []).find((p) => p.recipient_role === 'dealer') ?? null,
  }));
}

// ── Dealer / Supervisor tier badge (rolling 12m revenue) ───────────────
export interface DealerTierStatus {
  revenue_12m: number;
  current_slug: string;
  current_name: string;
  current_min: number;
  current_color: string;
  current_icon: string;
  next_slug: string | null;
  next_name: string | null;
  next_min: number | null;
  progress_pct: number;
  amount_to_next: number;
  role: string;
}

export async function getDealerTierStatus(profileId: string): Promise<DealerTierStatus | null> {
  const { data, error } = await getSupabaseClient().rpc('get_dealer_tier_status', { p_profile_id: profileId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    revenue_12m: Number(row.revenue_12m ?? 0),
    current_slug: row.current_slug,
    current_name: row.current_name,
    current_min: Number(row.current_min ?? 0),
    current_color: row.current_color,
    current_icon: row.current_icon,
    next_slug: row.next_slug ?? null,
    next_name: row.next_name ?? null,
    next_min: row.next_min == null ? null : Number(row.next_min),
    progress_pct: Number(row.progress_pct ?? 0),
    amount_to_next: Number(row.amount_to_next ?? 0),
    role: row.role,
  };
}

// ── Supervisors (admin) ─────────────────────────────────────────────────
export interface SupervisorRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export async function getAllSupervisors(): Promise<SupervisorRow[]> {
  const { data } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'supervisor')
    .order('created_at');
  return (data as SupervisorRow[]) ?? [];
}

export async function getAllTeamMembers(): Promise<TeamMember[]> {
  const { data } = await getSupabaseClient().from('supervisor_team_summary').select('*');
  return (data as TeamMember[]) ?? [];
}

export async function getUnassignedDealers(): Promise<UnassignedDealer[]> {
  const { data } = await getSupabaseClient().from('unassigned_dealers_summary').select('*');
  return (data as UnassignedDealer[]) ?? [];
}

// ── Supervisor ledger (overrides earned across team dealers) ───────────
export interface SupervisorLedgerRow extends LedgerRow {
  dealer_name: string | null;
}

export async function getSupervisorLedger(_supervisorId: string): Promise<SupervisorLedgerRow[]> {
  // RLS limits supervisor to orders belonging to their team (dealer.supervisor_id = auth.uid()).
  const { data } = await getSupabaseClient()
    .from('orders')
    .select('id, serial_number, customer_name, sale_price, sale_date, status, dealer:profiles!orders_dealer_id_fkey(full_name), commission_payouts(amount, paid_at, voided_at, payment_proof_url, recipient_role)')
    .order('sale_date', { ascending: false });
  type Raw = Omit<LedgerRow, 'commission'> & {
    dealer: { full_name: string | null } | null;
    commission_payouts: LedgerCommission[] | null;
  };
  return ((data as Raw[] | null) ?? []).map((o) => ({
    id: o.id,
    serial_number: o.serial_number,
    customer_name: o.customer_name,
    sale_price: o.sale_price,
    sale_date: o.sale_date,
    status: o.status,
    dealer_name: o.dealer?.full_name ?? null,
    commission: (o.commission_payouts ?? []).find((p) => p.recipient_role === 'supervisor') ?? null,
  }));
}

// ── Payout requests ────────────────────────────────────────────────────
export interface PayoutRequest {
  id: string;
  requester_id: string;
  requester_role: 'dealer' | 'supervisor';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  notes: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  processor_notes: string | null;
}

export interface PayoutRequestWithRequester extends PayoutRequest {
  requester: { full_name: string | null; email: string | null } | null;
}

export async function getMyPayoutRequests(): Promise<PayoutRequest[]> {
  const { data } = await getSupabaseClient()
    .from('payout_requests')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as PayoutRequest[]) ?? [];
}

export async function getAdminPayoutRequests(): Promise<PayoutRequestWithRequester[]> {
  const { data } = await getSupabaseClient()
    .from('payout_requests')
    .select('*, requester:profiles!payout_requests_requester_id_fkey(full_name, email)')
    .order('created_at', { ascending: false });
  return (data as PayoutRequestWithRequester[]) ?? [];
}

export async function createPayoutRequest(
  amount: number,
  role: 'dealer' | 'supervisor',
  notes?: string,
): Promise<PayoutRequest> {
  const sb = getSupabaseClient();
  const { data: { user }, error: ue } = await sb.auth.getUser();
  if (ue || !user) throw new Error(ue?.message ?? 'unauthenticated');
  const { data, error } = await sb
    .from('payout_requests')
    .insert({ requester_id: user.id, requester_role: role, amount, notes: notes ?? null })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as PayoutRequest;
}

export async function adminProcessPayoutRequest(
  id: string,
  decision: 'approved' | 'rejected' | 'paid',
  processorNotes?: string,
): Promise<PayoutRequest> {
  const { data, error } = await getSupabaseClient()
    .rpc('admin_process_payout_request', { p_request_id: id, p_decision: decision, p_processor_notes: processorNotes ?? null })
    .single();
  if (error) throw new Error(error.message);
  return data as PayoutRequest;
}

// ── Audit log (admin) ───────────────────────────────────────────────────
export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { data } = await getSupabaseClient()
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as AuditEntry[]) ?? [];
}
