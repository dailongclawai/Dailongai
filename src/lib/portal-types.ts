export type ProfileRole = 'dealer' | 'supervisor' | 'admin' | 'staff';
export type StaffSegment = 'b2c' | 'b2b';
export type ProfileStatus = 'pending' | 'active' | 'suspended';

export interface Profile {
  id: string;
  account_no: number | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: ProfileRole | null;
  staff_segment: StaffSegment | null;
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
  /** Giá bán cho đại lý. NULL nghĩa là đại lý mua bằng base_price. */
  dealer_price: string | null;
  image_url: string | null;
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

// ── CRM ──

export type CrmForecast = 'open' | 'won' | 'lost';
export type CrmAccountKind = 'customer' | 'dealer_prospect';
export type CrmActivityKind = 'task' | 'call' | 'meeting';
export type CrmSource =
  | 'website' | 'zalo' | 'facebook' | 'google_ads'
  | 'tiktok' | 'referral' | 'hotline' | 'event' | 'other';

export type CrmOrgType =
  | 'benh_vien_cong' | 'benh_vien_tu' | 'phong_kham' | 'spa' | 'dai_ly' | 'khac';

/** Một mốc trên dòng thời gian của khách: hoạt động hoặc lần đổi giai đoạn. */
export interface CrmTimelineEntry {
  account_id: string;
  at: string | null;
  entry: 'activity' | 'stage';
  sub_kind: string | null;
  title: string;
  detail: string | null;
  who: string | null;
}

/** Cơ hội quá hạn đóng hoặc lâu không ai động tới. */
export interface CrmFollowupRow {
  id: string;
  code: string | null;
  name: string;
  account_id: string;
  account_name: string;
  stage_name: string;
  amount: string;
  expected_close_date: string;
  last_activity_at: string | null;
  days_idle: number;
  reason: 'overdue' | 'stale';
  owner_name: string | null;
}

export interface CrmStage {
  id: string;
  name: string;
  probability: number;
  forecast: CrmForecast;
  sort_order: number;
  active: boolean;
}

export interface CrmAccount {
  id: string;
  code: string | null;
  kind: CrmAccountKind;
  name: string;
  is_individual: boolean;
  phone: string | null;
  email: string | null;
  zalo_phone: string | null;
  tax_code: string | null;
  province: string | null;
  address: string | null;
  source: CrmSource | null;
  /** Loại cơ sở của khách tổ chức. Chỉ 'dai_ly' mới có dải chiết khấu. */
  org_type: CrmOrgType | null;
  referrer_profile_id: string | null;
  linked_profile_id: string | null;
  owner_id: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** crm_account_list: khách hàng kèm tên người quản lý + người tạo (join qua danh bạ). */
export interface CrmAccountListRow extends CrmAccount {
  owner_name: string | null;
  owner_email: string | null;
  owner_segment: StaffSegment | null;
  creator_name: string | null;
  creator_email: string | null;
  was_handed_over: boolean;
  /** Tên giai đoạn nhân viên đang chọn cho khách này. */
  status_label: string;
  stage_id: string | null;
  /** Tổng số máy khách đặt, cộng từ các cơ hội chưa thua. */
  total_quantity: number;
  /** Hoa hồng nhân viên dự kiến nhận từ khách này = tổng giá trị × staff_rate. */
  expected_commission: string;
  /** Số cơ hội còn đang mở của khách. */
  open_deals: number;
  /** Mốc vào trạng thái hiện tại. Chưa đổi lần nào thì bằng ngày đưa khách vào. */
  stage_since: string;
  /** Đã "Hoàn thành đơn" hoặc "Không mua" thì chốt sổ, không đổi trạng thái nữa. */
  stage_locked: boolean;
}

export interface CrmContact {
  id: string;
  account_id: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  zalo_phone: string | null;
  is_primary: boolean;
  do_not_call: boolean;
  do_not_email: boolean;
  owner_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmOpportunityBoardRow {
  id: string;
  code: string | null;
  name: string;
  stage_id: string;
  stage_name: string;
  probability: number;
  forecast: CrmForecast;
  sort_order: number;
  amount: number;
  quantity: number;
  /** Số ngày khách dùng thử. NULL = bán đứt, hoa hồng chi ngay khi thanh toán. */
  trial_days: number | null;
  /** Hoa hồng nhân viên sẽ nhận nếu deal thành công = amount × staff_rate. */
  expected_commission: string;
  expected_close_date: string;
  owner_id: string;
  owner_name: string | null;
  account_id: string;
  // LEFT JOIN trong crm_opportunity_board: nếu RLS che bản ghi khách hàng thì
  // các cột này về NULL, cơ hội vẫn hiện trên bảng thay vì biến mất.
  account_name: string | null;
  account_phone: string | null;
  account_kind: CrmAccountKind | null;
  contact_id: string | null;
  model_id: string | null;
  order_id: string | null;
  closed_at: string | null;
  lost_reason_id: string | null;
  lost_reason_name: string | null;
  lost_notes: string | null;
  created_at: string;
  notes: string | null;
}

/** Danh mục lý do mất, dùng chung cho mọi cơ hội. */
export interface CrmLostReason {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

/** Đơn hàng chưa gắn cơ hội nào, trả về từ crm_orders_for_account. */
export interface CrmLinkableOrder {
  order_id: string;
  serial_number: string;
  customer_name: string;
  sale_price: string;
  sale_date: string;
  status: string;
  phone_matches: boolean;
}

/** Kết quả tra số điện thoại xuyên RLS — đủ để biết phải xin bắn khách từ ai. */
export interface CrmPhoneMatch {
  phone_norm: string;
  account_id: string;
  code: string | null;
  name: string;
  owner_id: string;
  owner_name: string | null;
  is_mine: boolean;
}

export interface CrmActivityRow {
  id: string;
  kind: CrmActivityKind;
  subject: string;
  notes: string | null;
  due_at: string | null;
  done_at: string | null;
  outcome: string | null;
  account_id: string | null;
  account_name: string | null;
  account_phone: string | null;
  opportunity_id: string | null;
  opportunity_name: string | null;
  contact_id: string | null;
  owner_id: string;
  created_at: string;
}

// ── CRM staff (Plan 2) ──

export interface CrmSettings {
  /** Một mức duy nhất cho mọi nhân viên. Boss chốt 29/07/2026: 10%. */
  staff_rate: number;
  /** Chiết khấu tối thiểu phải dành cho đại lý. Boss chốt 01/08/2026: 15%. */
  dealer_discount_min: number;
  /** Bao nhiêu ngày không ai động tới thì cơ hội bị coi là đứng yên. */
  followup_stale_days: number;
}

/** Dòng đối soát cho quản trị. `won_no_order` = cơ hội đã thắng nhưng chưa gắn
 *  đơn nào; `price_mismatch` = đơn ghi giá lệch bảng giá. */
export interface CrmReconIssue {
  issue: 'won_no_order' | 'price_mismatch';
  ref_id: string;
  ref_code: string | null;
  title: string;
  party_name: string | null;
  who: string | null;
  amount: string;
  expected_amount: string | null;
  at: string | null;
}

export type CrmCommissionStatus = 'pending' | 'payable' | 'paid' | 'void';

export interface CrmStaffCommission {
  id: string;
  opportunity_id: string;
  staff_id: string;
  /** Giá trị đơn hàng lúc phát sinh, chốt cứng để đổi cấu hình không viết lại quá khứ. */
  order_value: string;
  rate: string;
  amount: string;
  status: CrmCommissionStatus;
  /** Mốc đủ điều kiện chi. Có dùng thử thì bằng ngày thanh toán cộng số ngày thử. */
  eligible_at: string;
  order_id: string;
  confirmed_at: string | null;
  paid_at: string | null;
  payment_ref: string | null;
  created_at: string;
}

export interface CrmStaffReportRow {
  staff_id: string;
  staff_name: string | null;
  staff_email: string | null;
  staff_segment: StaffSegment | null;
  deals_won: number;
  deals_open: number;
  commission_total: string;
  amount_pending: string;
  amount_payable: string;
  amount_paid: string;
}

export interface StaffPeer {
  id: string;
  full_name: string | null;
  email: string | null;
  staff_segment: StaffSegment | null;
}
