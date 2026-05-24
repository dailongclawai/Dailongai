export type ProfileRole = 'dealer' | 'supervisor' | 'admin';
export type ProfileStatus = 'pending' | 'active' | 'suspended';

export interface Profile {
  id: string;
  account_no: number | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: ProfileRole | null;
  status: ProfileStatus;
  supervisor_id: string | null;
  business_name: string | null;
  business_address: string | null;
  id_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  zalo_phone: string | null;
  payout_qr_path: string | null;
  payout_verified_at: string | null;
  province: string | null;
  approved_at: string | null;
  approved_by: string | null;
  order_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  base_price: string;
  active: boolean;
  created_at: string;
}

export interface CommissionRule {
  id: string;
  dealer_id: string;
  model_id: string | null;
  commission_type: 'fixed' | 'percent';
  rate_value: string;
  effective_from: string;
  effective_to: string | null;
}

export interface Order {
  id: string;
  dealer_id: string;
  model_id: string;
  serial_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  sale_price: number;
  sale_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'voided';
  receipt_image_url: string | null;
  rejection_reason: string | null;
  invoice_required: boolean;
  invoice_company_name: string | null;
  invoice_tax_code: string | null;
  invoice_email: string | null;
  created_at: string;
}

export interface DealerSummary {
  dealer_id: string;
  orders_pending: number;
  orders_approved: number;
  orders_paid: number;
  units_ytd: number;
  month_sales: number;
  commission_pending: number;
  commission_paid: number;
}

export interface TeamMember {
  supervisor_id: string;
  dealer_id: string;
  dealer_account_no: number | null;
  dealer_name: string | null;
  orders_pending: number;
  units_ytd: number;
  month_sales: number;
}

export interface UnassignedDealer {
  dealer_id: string;
  dealer_name: string | null;
  dealer_account_no: number | null;
  orders_pending: number;
  units_ytd: number;
  month_sales: number;
}

export interface CommissionPlan {
  id: string;
  label: string;
  commission_type: 'fixed' | 'percent';
  rate_value: number;
  active: boolean;
}

export interface DealerCurrentCommission {
  dealer_id: string;
  override_type: 'fixed' | 'percent' | null;
  override_amount: number | null;
  override_from: string | null;
  tier_no: number;
  tier_label: string;
  tier_percent: number;
  units_ytd: number;
  rate_display: string;
  source: 'fixed' | 'tier_auto';
}

export type NotificationCategory = 'order' | 'commission' | 'payout' | 'legal' | 'policy' | 'system' | 'general';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface PortalMessage {
  id: string;
  sender_id: string | null;
  recipient_id: string;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  action_url: string | null;
  action_label: string | null;
}

export interface PayoutRow {
  id: string;
  order_id: string;
  recipient_id: string;
  recipient_role: 'dealer' | 'supervisor';
  amount: string;
  calculated_at: string;
  paid_at: string | null;
  payment_proof_url: string | null;
  voided_at: string | null;
}

export interface AdminPayoutRow extends PayoutRow {
  recipient_name: string | null;
  recipient_email: string | null;
  serial_number: string;
  sale_date: string;
  sale_price: number;
  customer_name: string;
}

export interface FleetSummary {
  active_dealers: number;
  units_ytd: number;
  units_month: number;
  orders_pending: number;
  revenue_ytd: number;
  commission_pending: number;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}
