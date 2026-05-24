'use client';

interface SparklineBarProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  gap?: number;
  minBarHeight?: number;
}

export function SparklineBar({
  data,
  width = 200,
  height = 36,
  color = '#ff5625',
  gap = 1,
  minBarHeight = 1,
}: SparklineBarProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-md bg-[#1a1f26]"
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  const max = Math.max(...data, 1);
  const barWidth = Math.max(1, (width - gap * (data.length - 1)) / data.length);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Biểu đồ doanh số 30 ngày"
    >
      {data.map((v, i) => {
        const h = v > 0 ? Math.max(minBarHeight, (v / max) * height) : minBarHeight;
        const x = i * (barWidth + gap);
        const y = height - h;
        const opacity = v > 0 ? 1 : 0.18;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={Math.min(1, barWidth / 2)}
            fill={color}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
