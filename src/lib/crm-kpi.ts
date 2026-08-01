// Luật KPI nhân viên kinh doanh — Boss chốt 01/08/2026:
//   * Tháng đầu tiên: đạt 3 máy, TRÊN 5 máy là rất tốt.
//   * Từ tháng thứ 2: đạt 5 máy, TRÊN 10 máy là xuất sắc.
//   * Đơn chứa máy thứ 10 trở đi trong tháng: +5% hoa hồng trên giá đơn.
//   * Khách mới mỗi ngày: 3–5 khách bán lẻ hoặc 1–3 khách tổ chức.
// Ngưỡng theo tháng nằm cả ở view crm_kpi_device_month (DB) — sửa luật thì sửa cả hai.

export const KPI_BONUS_FROM_DEVICE = 10;
export const KPI_BONUS_RATE = 0.05;

export const DAILY_RETAIL_MIN = 3;
export const DAILY_RETAIL_MAX = 5;
export const DAILY_ORG_MIN = 1;
export const DAILY_ORG_MAX = 3;

export type KpiStatus = 'missed' | 'met' | 'excellent';

export function kpiThresholds(tenureMonth: number): { target: number; excellent: number } {
  return tenureMonth <= 1 ? { target: 3, excellent: 5 } : { target: 5, excellent: 10 };
}

/** "Trên" mốc xuất sắc mới tính xuất sắc — đúng 5 máy tháng đầu vẫn chỉ là đạt. */
export function kpiStatus(devices: number, tenureMonth: number): KpiStatus {
  const { target, excellent } = kpiThresholds(tenureMonth);
  if (devices > excellent) return 'excellent';
  if (devices >= target) return 'met';
  return 'missed';
}

/** Chỉ tiêu ngày đạt khi đủ mức tối thiểu một trong hai nhánh khách. */
export function dailyKpiMet(retail: number, org: number): boolean {
  return retail >= DAILY_RETAIL_MIN || org >= DAILY_ORG_MIN;
}
