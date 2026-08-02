'use client';

// Biểu đồ thuần SVG/CSS cho trang Báo cáo — không thêm thư viện ngoài.
// Mỗi biểu đồ đúng MỘT series một màu; chữ (nhãn, giá trị) luôn dùng token chữ
// của giao diện chứ không nhuộm màu series; bảng số đầy đủ nằm ngay dưới nên
// biểu đồ chỉ lo phần đọc nhanh.

/** Viết gọn tiền: 29,5 tr / 1,2 tỷ. */
function fmtShortVnd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

export interface MonthlyDatum {
  label: string;
  value: number;
  hint: string;
}

/** Cột dọc 12 tháng. Nhãn số chỉ đặt ở cột cao nhất và cột mới nhất có số —
 *  các cột khác xem bằng hover (title) hoặc bảng dưới. */
export function MonthlyBarChart({ data, ariaLabel }: { data: MonthlyDatum[]; ariaLabel: string }) {
  const W = 720;
  const H = 190;
  const PAD_T = 18;
  const PAD_B = 24;
  const max = Math.max(...data.map(d => d.value), 1);
  const bw = W / Math.max(data.length, 1);
  const maxIdx = data.findIndex(d => d.value === max);
  let lastIdx = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].value > 0) { lastIdx = i; break; }
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label={ariaLabel}>
        <line x1={0} x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="var(--crm-line)" strokeWidth={1} />
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(4, ((d.value / max) * (H - PAD_B - PAD_T))) : 0;
          const x = i * bw + bw * 0.18;
          const w = bw * 0.64;
          const y = H - PAD_B - h;
          const labeled = d.value > 0 && (i === maxIdx || i === lastIdx);
          return (
            <g key={d.label}>
              {h > 0 && (
                <rect x={x} y={y} width={w} height={h} rx={4} fill="#d97706" opacity={0.9}>
                  <title>{d.hint}</title>
                </rect>
              )}
              {labeled && (
                <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="var(--crm-text)">
                  {fmtShortVnd(d.value)}
                </text>
              )}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--crm-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface HBarDatum {
  label: string;
  value: number;
  hint?: string;
}

/** Thanh ngang một series: nhãn — thanh — số. Dùng cho nguồn khách & lý do thua. */
export function HBarList({ data, color, formatValue }: {
  data: HBarDatum[];
  color: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const fmt = formatValue ?? ((n: number) => String(n));
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3" title={d.hint}>
          <span className="w-44 shrink-0 truncate text-sm text-[var(--crm-text)]">{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-md bg-[var(--crm-s3)]">
            <div
              className="h-full rounded-md"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color, opacity: 0.9 }}
            />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums text-[var(--crm-text)]">
            {fmt(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
