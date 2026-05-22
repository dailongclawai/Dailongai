export type ProfileRole = 'dealer' | 'supervisor' | 'admin';
export type ProfileStatus = 'pending' | 'active' | 'suspended';

export interface Profile {
  id: string;
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
  approved_at: string | null;
  approved_by: string | null;
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
  dealer_name: string | null;
  orders_pending: number;
  units_ytd: number;
  month_sales: number;
}

export interface FleetSummary {
  active_dealers: number;
  units_ytd: number;
  units_month: number;
  orders_pending: number;
  revenue_ytd: number;
  commission_pending: number;
}
