import { describe, it, expect } from 'vitest';
import { kpiThresholds, kpiStatus, dailyKpiMet } from '@/lib/crm-kpi';

describe('kpiThresholds', () => {
  it('tháng đầu: đạt 3 máy, mốc rất tốt 5', () => {
    expect(kpiThresholds(1)).toEqual({ target: 3, excellent: 5 });
  });
  it('từ tháng thứ 2: đạt 5 máy, mốc xuất sắc 10', () => {
    expect(kpiThresholds(2)).toEqual({ target: 5, excellent: 10 });
    expect(kpiThresholds(12)).toEqual({ target: 5, excellent: 10 });
  });
});

describe('kpiStatus', () => {
  it('tháng đầu: đúng 5 máy vẫn là đạt, trên 5 mới rất tốt', () => {
    expect(kpiStatus(2, 1)).toBe('missed');
    expect(kpiStatus(3, 1)).toBe('met');
    expect(kpiStatus(5, 1)).toBe('met');
    expect(kpiStatus(6, 1)).toBe('excellent');
  });
  it('tháng 2+: đúng 10 máy vẫn là đạt, trên 10 mới xuất sắc', () => {
    expect(kpiStatus(4, 2)).toBe('missed');
    expect(kpiStatus(5, 2)).toBe('met');
    expect(kpiStatus(10, 3)).toBe('met');
    expect(kpiStatus(11, 3)).toBe('excellent');
  });
});

describe('dailyKpiMet', () => {
  it('đạt khi 3 khách lẻ hoặc 1 khách tổ chức', () => {
    expect(dailyKpiMet(0, 0)).toBe(false);
    expect(dailyKpiMet(2, 0)).toBe(false);
    expect(dailyKpiMet(3, 0)).toBe(true);
    expect(dailyKpiMet(0, 1)).toBe(true);
    expect(dailyKpiMet(2, 1)).toBe(true);
  });
});
