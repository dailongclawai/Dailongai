import { getSupabaseClient } from './supabase';
import type { Order, DealerSummary, TeamMember, UnassignedDealer, FleetSummary, ProductModel, CommissionPlan, DealerCurrentCommission, PortalMessage, PayoutRow, AdminPayoutRow, AuditEntry, CrmStage, CrmAccount, CrmAccountKind, CrmSource, CrmOpportunityBoardRow, CrmActivityRow, CrmActivityKind, CrmAccountListRow, StaffSegment, CrmStaffCommission, CrmStaffReportRow, CrmLostReason, CrmPhoneMatch, CrmLinkableOrder, CrmSettings, CrmReconIssue,
  CrmTimelineEntry, CrmFollowupRow, CrmOrgType, StaffPeer, CrmContact,
  CrmMonthlyReportRow, CrmLostReasonReportRow, CrmSourceReportRow,
  CrmKpiDeviceMonth, CrmKpiNewAccountsDay,
  CrmEvidence, CrmEvidenceKind, CrmFeedback } from './portal-types';

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

export const HOUSE_ORDER_SLUG = 'dai-long';

export async function getPaymentStatusPublic(orderId: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().rpc('get_payment_status_public', { p_order_id: orderId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.status ?? null;
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

// ── CRM ──

export async function getCrmStages(): Promise<CrmStage[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_stages')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as CrmStage[]) ?? [];
}

export async function getCrmAccounts(kind?: CrmAccountKind): Promise<CrmAccountListRow[]> {
  // Đọc qua view crm_account_list để có tên người quản lý + người tạo; RLS của
  // crm_accounts vẫn lọc dòng vì view dùng security_invoker.
  // Khoá phụ theo mã: nhiều khách nhập cùng một lô có created_at giống hệt nhau,
  // Postgres không cam kết thứ tự giữa các dòng bằng nhau nên sau mỗi lần sửa là
  // dòng nhảy chỗ ngay trước mắt nhân viên.
  let q = getSupabaseClient().from('crm_account_list').select('*')
    .order('created_at', { ascending: false })
    .order('code', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data as CrmAccountListRow[]) ?? [];
}

export interface CrmAccountInput {
  name: string;
  kind: CrmAccountKind;
  isIndividual?: boolean;
  phone?: string | null;
  email?: string | null;
  zaloPhone?: string | null;
  taxCode?: string | null;
  province?: string | null;
  address?: string | null;
  source?: CrmSource | null;
  orgType?: CrmOrgType | null;
  notes?: string | null;
  ownerId: string;
}

function crmAccountRow(input: CrmAccountInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    is_individual: input.isIndividual ?? true,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    zalo_phone: input.zaloPhone?.trim() || null,
    tax_code: input.taxCode?.trim() || null,
    // Loại cơ sở chỉ có nghĩa với khách tổ chức; khách cá nhân luôn để trống.
    org_type: input.kind === 'dealer_prospect' ? (input.orgType ?? null) : null,
    province: input.province?.trim() || null,
    address: input.address?.trim() || null,
    source: input.source ?? null,
    notes: input.notes?.trim() || null,
    owner_id: input.ownerId,
  };
}

export async function createCrmAccount(input: CrmAccountInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_accounts').insert(crmAccountRow(input));
  if (error) throw error;
}

/** Nhập hàng loạt. Trigger chống trùng chạy từng dòng nên phải chia lô: một số
 *  trùng lọt lưới sẽ làm hỏng cả lô, chia nhỏ thì phần còn lại vẫn vào được. */
/** Trả id theo ĐÚNG thứ tự đầu vào để bên gọi lập tiếp cơ hội cho từng dòng. */
export async function createCrmAccountsBulk(inputs: CrmAccountInput[]): Promise<string[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_accounts')
    .insert(inputs.map(crmAccountRow))
    .select('id');
  if (error) throw error;
  return ((data as { id: string }[]) ?? []).map(r => r.id);
}

/** Tra số điện thoại xuyên RLS để biết khách đã tồn tại và ai đang phụ trách. */
export async function lookupCrmPhones(phones: string[]): Promise<CrmPhoneMatch[]> {
  const clean = phones.map(p => p.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const { data, error } = await getSupabaseClient().rpc('crm_lookup_phones', { p_phones: clean });
  if (error) throw error;
  return (data as CrmPhoneMatch[]) ?? [];
}

export async function updateCrmAccount(id: string, input: CrmAccountInput): Promise<void> {
  // KHÔNG ghi đè owner_id khi sửa: admin sửa hộ mà mang theo owner_id của mình
  // là cướp luôn khách của nhân viên. Đổi chủ đi đường bàn giao chính thức.
  const { owner_id: _owner, ...row } = crmAccountRow(input);
  const { error } = await getSupabaseClient().from('crm_accounts').update(row).eq('id', id);
  if (error) throw error;
}

/** Nhân viên tự chọn giai đoạn cho khách, không phải qua cơ hội. */
export async function setCrmAccountStage(accountId: string, stageId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_accounts')
    .update({ stage_id: stageId })
    .eq('id', accountId);
  if (error) throw error;
}





export async function getCrmBoard(): Promise<CrmOpportunityBoardRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_opportunity_board')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false })
    // Cùng lý do như bảng khách: thiếu khoá phụ thì thẻ nhảy chỗ trong cột.
    .order('code', { ascending: false });
  if (error) throw error;
  return (data as CrmOpportunityBoardRow[]) ?? [];
}

export interface CrmOpportunityInput {
  accountId: string;
  contactId?: string | null;
  stageId: string;
  name: string;
  modelId?: string | null;
  quantity?: number;
  amount: number;
  expectedCloseDate?: string | null;
  notes?: string | null;
  lostReasonId?: string | null;
  lostNotes?: string | null;
  trialDays?: number | null;
  ownerId: string;
}

function crmOpportunityRow(input: CrmOpportunityInput) {
  return {
    account_id: input.accountId,
    contact_id: input.contactId ?? null,
    stage_id: input.stageId,
    name: input.name.trim(),
    model_id: input.modelId ?? null,
    quantity: input.quantity ?? 1,
    amount: input.amount,
    ...(input.expectedCloseDate ? { expected_close_date: input.expectedCloseDate } : {}),
    notes: input.notes?.trim() || null,
    lost_reason_id: input.lostReasonId ?? null,
    lost_notes: input.lostNotes?.trim() || null,
    trial_days: input.trialDays ?? null,
    owner_id: input.ownerId,
  };
}

export async function createCrmOpportunity(input: CrmOpportunityInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_opportunities').insert(crmOpportunityRow(input));
  if (error) throw error;
}

export async function updateCrmOpportunity(id: string, input: CrmOpportunityInput): Promise<void> {
  // Cùng lý do với updateCrmAccount: sửa hộ không được đổi chủ, kẻo hoa hồng
  // về sau tính cho nhầm người.
  const { owner_id: _owner, ...row } = crmOpportunityRow(input);
  const { error } = await getSupabaseClient().from('crm_opportunities').update(row).eq('id', id);
  if (error) throw error;
}

export async function getCrmLostReasons(): Promise<CrmLostReason[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_lost_reasons')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as CrmLostReason[]) ?? [];
}

export async function moveOpportunityStage(
  id: string,
  stageId: string,
  lostReasonId?: string | null,
  lostNotes?: string | null,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_opportunities')
    .update({ stage_id: stageId, lost_reason_id: lostReasonId ?? null, lost_notes: lostNotes?.trim() || null })
    .eq('id', id);
  if (error) throw error;
}

/** Cấu hình CRM dùng chung. Ai đăng nhập cũng đọc được, chỉ admin sửa. */
export async function getCrmSettings(): Promise<CrmSettings | null> {
  const { data, error } = await getSupabaseClient()
    .from('crm_settings')
    .select('staff_rate, dealer_discount_min, followup_stale_days')
    .maybeSingle();
  if (error) throw error;
  return (data as CrmSettings) ?? null;
}

/** Chỉ admin qua được RLS; người khác gọi sẽ nhận lỗi từ chính sách ghi. */
export async function updateCrmSettings(input: CrmSettings): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_settings')
    .update({
      staff_rate: input.staff_rate,
      dealer_discount_min: input.dealer_discount_min,
      followup_stale_days: input.followup_stale_days,
    })
    .eq('id', true);
  if (error) throw error;
}

/** Danh bạ nhân viên kinh doanh, dùng cho ô chọn người nhận bàn giao. */
export async function getStaffPeers(): Promise<StaffPeer[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_staff_directory')
    .select('*')
    .order('full_name');
  if (error) throw error;
  return (data as StaffPeer[]) ?? [];
}

/** Bàn giao khách: khách + liên hệ + cơ hội đang mở + việc chưa xong sang người
 *  nhận. RPC dưới DB kiểm quyền (người phụ trách hoặc admin). */
export async function transferCrmAccount(accountId: string, toStaffId: string, note: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('staff_handover_account', {
    p_account_id: accountId,
    p_to_staff: toStaffId,
    p_note: note.trim() || null,
  });
  if (error) throw error;
}

/** Đơn giá gợi ý cho một model theo loại khách: đại lý phải được chiết khấu ít
 *  nhất `dealer_discount_min`, nên gợi ý đúng mức tối thiểu đó — còn dư địa cho
 *  nhân viên thương lượng xuống tới sàn `dealer_price`. */
export function suggestedUnitPrice(
  model: Pick<ProductModel, 'base_price' | 'dealer_price'>,
  kind: CrmAccountKind,
  settings: CrmSettings | null,
): number {
  const base = Number(model.base_price);
  if (kind !== 'dealer_prospect' || !model.dealer_price) return base;
  return Math.round(base * (1 - (settings?.dealer_discount_min ?? 0)));
}

/** Một khách kèm các cột tổng hợp, dùng cho trang chi tiết. */
export async function getCrmAccountById(id: string): Promise<CrmAccountListRow | null> {
  const { data, error } = await getSupabaseClient()
    .from('crm_account_list')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as CrmAccountListRow) ?? null;
}

/** Mọi cơ hội của một khách, mới nhất lên trước. */
export async function getAccountOpportunities(accountId: string): Promise<CrmOpportunityBoardRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_opportunity_board')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmOpportunityBoardRow[]) ?? [];
}

/** Dòng thời gian của một khách: hoạt động và những lần cơ hội đổi giai đoạn. */
export async function getAccountTimeline(accountId: string): Promise<CrmTimelineEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_account_timeline')
    .select('*')
    .eq('account_id', accountId);
  if (error) throw error;
  return (data as CrmTimelineEntry[]) ?? [];
}

/** Cơ hội quá hạn đóng hoặc lâu không ai động tới. */
export async function getFollowupDue(): Promise<CrmFollowupRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_followup_due')
    .select('*');
  if (error) throw error;
  return (data as CrmFollowupRow[]) ?? [];
}

/** Cơ hội còn đang mở của một khách, cũ nhất lên trước. */
export async function getOpenOpportunities(accountId: string): Promise<CrmOpportunityBoardRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_opportunity_board')
    .select('*')
    .eq('account_id', accountId)
    .eq('forecast', 'open')
    .order('created_at');
  if (error) throw error;
  return (data as CrmOpportunityBoardRow[]) ?? [];
}

/** Đổi số máy của một cơ hội. Giá đi theo để giữ nguyên đơn giá — nếu để giá cũ
 *  thì sàn giá đại lý (`crm_opportunity_before_write`) sẽ chặn khi tăng số máy. */
export async function setOpportunityQuantity(id: string, quantity: number, amount: number): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_opportunities')
    .update({ quantity, amount })
    .eq('id', id);
  if (error) throw error;
}

/** Đơn hàng chưa cơ hội nào nhận, đơn trùng số điện thoại khách xếp trước.
 *  Đi qua RPC vì nhân viên kinh doanh không có quyền đọc thẳng bảng orders. */
export async function getOrdersForAccount(accountId: string): Promise<CrmLinkableOrder[]> {
  const { data, error } = await getSupabaseClient()
    .rpc('crm_orders_for_account', { p_account_id: accountId });
  if (error) throw error;
  return (data as CrmLinkableOrder[]) ?? [];
}

/** Gắn đơn vào cơ hội; truyền null để gỡ. */
export async function linkOrderToOpportunity(opportunityId: string, orderId: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .rpc('crm_link_order', { p_opportunity_id: opportunityId, p_order_id: orderId });
  if (error) throw error;
}

export async function getCrmActivities(): Promise<CrmActivityRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_activity_inbox')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmActivityRow[]) ?? [];
}

export interface CrmActivityInput {
  kind: CrmActivityKind;
  subject: string;
  notes?: string | null;
  dueAt?: string | null;
  accountId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
  ownerId: string;
}

export async function createCrmActivity(input: CrmActivityInput): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_activities').insert({
    kind: input.kind,
    subject: input.subject.trim(),
    notes: input.notes?.trim() || null,
    due_at: input.dueAt ?? null,
    account_id: input.accountId ?? null,
    opportunity_id: input.opportunityId ?? null,
    contact_id: input.contactId ?? null,
    owner_id: input.ownerId,
  });
  if (error) throw error;
}

export async function completeActivity(id: string, outcome?: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_activities')
    .update({ done_at: new Date().toISOString(), outcome: outcome?.trim() || null })
    .eq('id', id);
  if (error) throw error;
}

// ── CRM staff (Plan 2) ──




export async function getMyStaffCommissions(): Promise<CrmStaffCommission[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_staff_commissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmStaffCommission[]) ?? [];
}

/** Chuyển những dòng đã hết hạn dùng thử sang payable. Chỉ admin. */
export async function releaseDueCommissions(): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('crm_release_due_commissions');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function adminPayStaffCommission(commissionId: string, paymentRef: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_pay_staff_commission', {
    p_commission_id: commissionId,
    p_payment_ref: paymentRef,
  });
  if (error) throw error;
}

export async function adminSetStaff(userId: string, segment: StaffSegment): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_staff', {
    p_user_id: userId,
    p_segment: segment,
  });
  if (error) throw error;
}

/** Đối soát cho quản trị. Khung nhìn tự lọc theo vai trò nên người khác gọi
 *  cũng chỉ nhận mảng rỗng. */
export async function getCrmReconIssues(): Promise<CrmReconIssue[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_recon_issues')
    .select('*');
  if (error) throw error;
  return (data as CrmReconIssue[]) ?? [];
}

export async function getCrmStaffReport(): Promise<CrmStaffReportRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_staff_report')
    .select('*')
    .order('staff_name');
  if (error) throw error;
  return (data as CrmStaffReportRow[]) ?? [];
}

/** 12 tháng gần nhất; khung nhìn tự chặn ai không phải admin (trả rỗng). */
export async function getCrmMonthlyReport(): Promise<CrmMonthlyReportRow[]> {
  const { data, error } = await getSupabaseClient().from('crm_report_monthly').select('*');
  if (error) throw error;
  return (data as CrmMonthlyReportRow[]) ?? [];
}

export async function getCrmLostReasonReport(): Promise<CrmLostReasonReportRow[]> {
  const { data, error } = await getSupabaseClient().from('crm_report_lost_reasons').select('*');
  if (error) throw error;
  return (data as CrmLostReasonReportRow[]) ?? [];
}

export async function getCrmSourceReport(): Promise<CrmSourceReportRow[]> {
  const { data, error } = await getSupabaseClient().from('crm_report_sources').select('*');
  if (error) throw error;
  return (data as CrmSourceReportRow[]) ?? [];
}

/** Nhân viên gửi yêu cầu xác nhận hoàn thành — quản trị duyệt mới vào bước thắng,
 *  lúc đó KPI máy và hoa hồng mới tính. DB chặn staff tự đẩy vào bước thắng. */
export async function requestAccountCompletion(accountId: string, staffId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_accounts')
    .update({ won_requested_at: new Date().toISOString(), won_requested_by: staffId })
    .eq('id', accountId);
  if (error) throw error;
}

/** Nhân viên rút lại yêu cầu hoàn thành khi khách đổi ý. */
export async function cancelAccountCompletionRequest(accountId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('crm_accounts')
    .update({ won_requested_at: null, won_requested_by: null })
    .eq('id', accountId);
  if (error) throw error;
}

// ── Tháng lịch Việt Nam ──

/** Mùng 1 tháng hiện tại theo giờ Việt Nam, dạng yyyy-mm-dd — trang KPI dùng
 *  để khớp cột thang của view crm_kpi_device_month. */
export function currentMonthVn(): string {
  const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── KPI nhân viên ──

/** KPI máy 12 tháng gần nhất. RLS: nhân viên thấy của mình, admin thấy cả đội. */
export async function getCrmKpiDeviceMonths(): Promise<CrmKpiDeviceMonth[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_kpi_device_month')
    .select('*')
    .order('thang');
  if (error) throw error;
  return (data as CrmKpiDeviceMonth[]) ?? [];
}

/** Khách mới lập theo ngày, 14 ngày gần nhất (giờ VN). */
export async function getCrmKpiNewAccountsDays(): Promise<CrmKpiNewAccountsDay[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_kpi_new_accounts_day')
    .select('*')
    .order('ngay');
  if (error) throw error;
  return (data as CrmKpiNewAccountsDay[]) ?? [];
}

// ── Chứng cứ khách hàng ──

export async function getCrmEvidences(accountId: string): Promise<CrmEvidence[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_evidences')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmEvidence[]) ?? [];
}

/** Tải file vào bucket riêng rồi ghi dòng chứng cứ. File xếp theo thư mục người
 *  tải lên — policy storage chỉ cho ghi vào thư mục của chính mình. */
export async function uploadCrmEvidence(
  userId: string, accountId: string, file: File, kind: CrmEvidenceKind, note: string,
): Promise<void> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${accountId}-${Date.now()}.${ext}`;
  const client = getSupabaseClient();
  const { error: upErr } = await client.storage.from('crm-evidence').upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { error } = await client.from('crm_evidences').insert({
    account_id: accountId, uploaded_by: userId, kind, file_path: path, note: note.trim() || null,
  });
  if (error) {
    // Dòng bị RLS chặn (vd. khách đã bàn giao) thì gỡ luôn file vừa tải,
    // kẻo rơi lại file mồ côi trong bucket.
    await client.storage.from('crm-evidence').remove([path]);
    throw error;
  }
}

export async function crmEvidenceSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from('crm-evidence').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

/** Số chứng cứ theo khách, cho huy hiệu trên bảng Khách hàng. RLS cắt theo quyền nhìn. */
export async function getCrmEvidenceCounts(): Promise<Record<string, number>> {
  const { data, error } = await getSupabaseClient().from('crm_evidences').select('account_id');
  if (error) throw error;
  const acc: Record<string, number> = {};
  for (const r of (data as { account_id: string }[]) ?? []) {
    acc[r.account_id] = (acc[r.account_id] ?? 0) + 1;
  }
  return acc;
}

// ── Góp ý xây dựng CRM ──

/** RLS: nhân viên thấy thư mình gửi, admin thấy hết. */
export async function getCrmFeedbacks(): Promise<CrmFeedback[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_feedbacks')
    .select('*, staff:profiles(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CrmFeedback[]) ?? [];
}

export async function createCrmFeedback(staffId: string, content: string, file?: File | null): Promise<void> {
  const client = getSupabaseClient();
  let filePath: string | null = null;
  if (file) {
    const ext = file.name.split('.').pop() ?? 'dat';
    filePath = `${staffId}/${Date.now()}.${ext}`;
    const { error: upErr } = await client.storage.from('crm-feedback').upload(filePath, file, { upsert: false });
    if (upErr) throw upErr;
  }
  const { error } = await client
    .from('crm_feedbacks')
    .insert({ staff_id: staffId, content: content.trim(), file_path: filePath });
  if (error) {
    // Dòng thư không ghi được thì gỡ luôn file vừa tải, kẻo rơi lại file mồ côi.
    if (filePath) await client.storage.from('crm-feedback').remove([filePath]);
    throw error;
  }
}

export async function crmFeedbackSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from('crm-feedback').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

// ── CRM danh bạ liên hệ ──

export async function getAccountContacts(accountId: string): Promise<CrmContact[]> {
  const { data, error } = await getSupabaseClient()
    .from('crm_contacts')
    .select('*')
    .eq('account_id', accountId)
    .order('is_primary', { ascending: false })
    .order('created_at');
  if (error) throw error;
  return (data as CrmContact[]) ?? [];
}

export interface CrmContactInput {
  accountId: string;
  fullName: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  zaloPhone?: string | null;
  isPrimary?: boolean;
  doNotCall?: boolean;
  doNotEmail?: boolean;
  notes?: string | null;
  ownerId: string;
}

function crmContactRow(input: CrmContactInput) {
  return {
    account_id: input.accountId,
    full_name: input.fullName.trim(),
    title: input.title?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    zalo_phone: input.zaloPhone?.trim() || null,
    is_primary: input.isPrimary ?? false,
    do_not_call: input.doNotCall ?? false,
    do_not_email: input.doNotEmail ?? false,
    notes: input.notes?.trim() || null,
  };
}

/** Mỗi khách chỉ một đầu mối chính: đặt chính cho người này thì hạ cờ người khác. */
async function clearPrimaryContact(accountId: string, exceptId?: string): Promise<void> {
  let q = getSupabaseClient()
    .from('crm_contacts')
    .update({ is_primary: false })
    .eq('account_id', accountId)
    .eq('is_primary', true);
  if (exceptId) q = q.neq('id', exceptId);
  const { error } = await q;
  if (error) throw error;
}

export async function createCrmContact(input: CrmContactInput): Promise<void> {
  if (input.isPrimary) await clearPrimaryContact(input.accountId);
  const { error } = await getSupabaseClient()
    .from('crm_contacts')
    .insert({ ...crmContactRow(input), owner_id: input.ownerId });
  if (error) throw error;
}

export async function updateCrmContact(id: string, input: CrmContactInput): Promise<void> {
  if (input.isPrimary) await clearPrimaryContact(input.accountId, id);
  const { error } = await getSupabaseClient()
    .from('crm_contacts')
    .update(crmContactRow(input))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCrmContact(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('crm_contacts').delete().eq('id', id);
  if (error) throw error;
}
