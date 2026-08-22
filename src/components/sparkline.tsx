export interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

/** Minimal SVG sparkline — no chart library. */
export function Sparkline({ points, width = 160, height = 28, color = "#3fb950", fill = true }: SparklineProps) {
  if (points.length < 2) {
    return (
      <svg data-testid="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden="true">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeOpacity="0.25" strokeWidth="1" />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const step = width / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = coords.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg data-testid="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden="true">
      {fill && <polygon points={area} fill={color} opacity="0.15" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
