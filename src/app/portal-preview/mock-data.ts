// PROTOTYPE ONLY — wipe me after Boss picks a variant.
export const mockDealer = {
  fullName: 'Nguyễn Văn A',
  email: 'dealer-a@dailongai.com',
  avatar: 'NA',
  role: 'dealer' as const,
};

export const mockKpi = {
  monthSales: 245_000_000,
  commissionPending: 24_500_000,
  commissionPaid: 18_000_000,
  ordersPending: 2,
  ordersApproved: 3,
  ordersPaid: 6,
  monthTarget: 300_000_000,
};

export const mockMonthlySeries = [
  { month: 'T12/25', sales: 120_000_000 },
  { month: 'T01/26', sales: 180_000_000 },
  { month: 'T02/26', sales: 95_000_000 },
  { month: 'T03/26', sales: 210_000_000 },
  { month: 'T04/26', sales: 170_000_000 },
  { month: 'T05/26', sales: 245_000_000 },
];

export type OrderStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export const mockOrders: Array<{
  id: string;
  serial: string;
  customer: string;
  model: 'Zhi Dun CEO A' | 'Zhi Dun CEO B';
  price: number;
  date: string;
  status: OrderStatus;
  commission: number;
}> = [
  { id: '1', serial: 'SN-2026-0142', customer: 'Cô Lan – Q.Tân Phú', model: 'Zhi Dun CEO B', price: 92_000_000, date: '2026-05-21', status: 'pending', commission: 9_200_000 },
  { id: '2', serial: 'SN-2026-0141', customer: 'Chú Hùng – Q.7', model: 'Zhi Dun CEO A', price: 55_000_000, date: '2026-05-20', status: 'pending', commission: 5_000_000 },
  { id: '3', serial: 'SN-2026-0138', customer: 'Anh Khoa – Hà Đông', model: 'Zhi Dun CEO A', price: 58_000_000, date: '2026-05-18', status: 'approved', commission: 5_000_000 },
  { id: '4', serial: 'SN-2026-0135', customer: 'Cô Mai – Đà Nẵng', model: 'Zhi Dun CEO B', price: 88_000_000, date: '2026-05-15', status: 'approved', commission: 8_800_000 },
  { id: '5', serial: 'SN-2026-0131', customer: 'Chị Hồng – Cần Thơ', model: 'Zhi Dun CEO A', price: 52_000_000, date: '2026-05-10', status: 'paid', commission: 5_000_000 },
  { id: '6', serial: 'SN-2026-0128', customer: 'Anh Đức – Vũng Tàu', model: 'Zhi Dun CEO B', price: 95_000_000, date: '2026-05-06', status: 'paid', commission: 9_500_000 },
];

export const fmtVnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export const fmtShortVnd = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr';
  return new Intl.NumberFormat('vi-VN').format(n);
};

export const statusLabel: Record<OrderStatus, { vi: string; tone: string }> = {
  pending: { vi: 'Chờ duyệt', tone: 'bg-amber-100 text-amber-800' },
  approved: { vi: 'Đã duyệt', tone: 'bg-emerald-100 text-emerald-800' },
  paid: { vi: 'Đã chi', tone: 'bg-blue-100 text-blue-800' },
  rejected: { vi: 'Từ chối', tone: 'bg-rose-100 text-rose-800' },
};

// ─── Tier commission scheme ───────────────────────────────────────────────
export const tierScheme = {
  name: 'Phương án A — Tier theo số máy bán trong tháng',
  tiers: [
    { id: 1, label: 'Tier 1', minUnits: 0, percent: 15 },
    { id: 2, label: 'Tier 2', minUnits: 100, percent: 20 },
    { id: 3, label: 'Tier 3', minUnits: 200, percent: 25 },
    { id: 4, label: 'Tier 4', minUnits: 300, percent: 25 },
  ],
};

export const flatScheme = {
  name: 'Phương án B — Khoá cứng 20% mỗi máy',
  rate: 20,
};

export const mockDealerYtd = {
  unitsYtd: 145,
  revenueYtd: 7_350_000_000,
  commissionPaidYtd: 1_102_500_000,
  monthsActive: 11,
};

// Next pay-out window — auto-paid 5-10 of each month
export const nextPayout = {
  label: 'Chu kỳ T05/2026',
  windowStart: '2026-06-05',
  windowEnd: '2026-06-10',
  expectedAmount: 24_500_000,
};

// ─── Admin / fleet-wide ──────────────────────────────────────────────────
export const mockFleet = {
  revenueYtdAll: 78_400_000_000,
  unitsYtdAll: 1_568,
  unitsThisMonth: 142,
  activeDealers: 23,
  pendingRegistrations: 4,
  pendingApprovals: 11,
  commissionPaidYtd: 11_760_000_000,
  commissionPendingNow: 187_300_000,
  payoutDealersCount: 23,
};

export const mockTopDealers: Array<{
  id: string;
  name: string;
  city: string;
  unitsYtd: number;
  monthSales: number;
  tier: number;
  currentRate: number;
}> = [
  { id: 'd1', name: 'Nguyễn Văn A', city: 'TP.HCM', unitsYtd: 312, monthSales: 245_000_000, tier: 4, currentRate: 25 },
  { id: 'd2', name: 'Trần Thị B', city: 'Hà Nội', unitsYtd: 245, monthSales: 198_000_000, tier: 3, currentRate: 25 },
  { id: 'd3', name: 'Lê Minh C', city: 'Đà Nẵng', unitsYtd: 198, monthSales: 178_000_000, tier: 2, currentRate: 20 },
  { id: 'd4', name: 'Phạm Văn D', city: 'Cần Thơ', unitsYtd: 145, monthSales: 110_000_000, tier: 2, currentRate: 20 },
  { id: 'd5', name: 'Đỗ Thị E', city: 'Hải Phòng', unitsYtd: 88, monthSales: 92_000_000, tier: 1, currentRate: 15 },
];

export const mockMonthlyFleet = [
  { month: 'T06/25', revenue: 4_200_000_000 },
  { month: 'T07/25', revenue: 5_100_000_000 },
  { month: 'T08/25', revenue: 5_800_000_000 },
  { month: 'T09/25', revenue: 4_900_000_000 },
  { month: 'T10/25', revenue: 6_300_000_000 },
  { month: 'T11/25', revenue: 6_700_000_000 },
  { month: 'T12/25', revenue: 7_500_000_000 },
  { month: 'T01/26', revenue: 5_200_000_000 },
  { month: 'T02/26', revenue: 4_800_000_000 },
  { month: 'T03/26', revenue: 6_900_000_000 },
  { month: 'T04/26', revenue: 7_800_000_000 },
  { month: 'T05/26', revenue: 8_400_000_000 },
];
