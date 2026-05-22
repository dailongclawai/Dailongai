import { getSupabaseClient } from './supabase';
import type { Order, DealerSummary, TeamMember, FleetSummary, ProductModel, CommissionPlan, PortalMessage, PayoutRow, AdminPayoutRow, SalesDocument, DocCategory, DocVisibility, AuditEntry } from './portal-types';

export async function getCommissionPlans(): Promise<CommissionPlan[]> {
  const { data } = await getSupabaseClient()
    .from('commission_plans')
    .select('*')
    .eq('active', true)
    .order('commission_type')
    .order('rate_value');
  return (data as CommissionPlan[]) ?? [];
}

export async function setDealerCommission(dealerId: string, planId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('supervisor_set_commission', {
    p_dealer_id: dealerId,
    p_plan_id: planId,
  });
  if (error) throw error;
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

// ── Sales documents ─────────────────────────────────────────────────────
export async function getSalesDocuments(): Promise<SalesDocument[]> {
  const { data } = await getSupabaseClient()
    .from('sales_documents')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as SalesDocument[]) ?? [];
}

export async function uploadSalesDoc(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await getSupabaseClient().storage.from('sales-docs').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getSalesDocUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().storage.from('sales-docs').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function createSalesDocument(input: {
  title: string;
  file_url: string;
  category: DocCategory;
  visible_to: DocVisibility;
}): Promise<void> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await getSupabaseClient()
    .from('sales_documents')
    .insert({ ...input, uploaded_by: session.user.id });
  if (error) throw error;
}

export async function deleteSalesDocument(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('sales_documents').delete().eq('id', id);
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

// ── Audit log (admin) ───────────────────────────────────────────────────
export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { data } = await getSupabaseClient()
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as AuditEntry[]) ?? [];
}
