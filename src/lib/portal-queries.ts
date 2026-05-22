import { getSupabaseClient } from './supabase';
import type { Order, DealerSummary, TeamMember, FleetSummary, ProductModel, CommissionPlan } from './portal-types';

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
