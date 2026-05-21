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
