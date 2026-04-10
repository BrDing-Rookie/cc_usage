import type { MaterializedHistoryPoint } from '@vibe-monitor/shared';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function Sparkline({
  points,
  stroke = 'currentColor'
}: {
  points: MaterializedHistoryPoint[];
  stroke?: string;
}) {
  if (points.length < 2) {
    return <div className="sparkline sparkline--empty" aria-hidden="true" />;
  }

  const width = 120;
  const height = 32;

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - minValue) / range) * height;
    return `${clamp(x, 0, width).toFixed(2)},${clamp(y, 0, height).toFixed(2)}`;
  });

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}

