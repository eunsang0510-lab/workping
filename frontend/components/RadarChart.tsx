"use client";

interface RadarChartProps {
  data: { axis: string; score: number }[];
  size?: number;
}

export default function RadarChart({ data, size = 260 }: RadarChartProps) {
  if (data.length < 3) {
    return <div className="text-[#6b6b6b] text-xs">역량 데이터가 부족해요</div>;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 36;
  const n = data.length;

  const pointAt = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    return { x: cx + radius * ratio * Math.cos(angle), y: cy + radius * ratio * Math.sin(angle) };
  };

  const gridRatios = [0.25, 0.5, 0.75, 1];
  const gridPolygons = gridRatios.map((ratio) =>
    Array.from({ length: n }, (_, i) => pointAt(i, ratio))
      .map((p) => `${p.x},${p.y}`)
      .join(" ")
  );

  const dataPolygon = data
    .map((d, i) => pointAt(i, Math.max(0, Math.min(100, d.score)) / 100))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridPolygons.map((points, i) => (
        <polygon key={i} points={points} fill="none" stroke="#e5e5e5" strokeWidth={1} />
      ))}
      {data.map((_, i) => {
        const p = pointAt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e5e5" strokeWidth={1} />;
      })}
      <polygon points={dataPolygon} fill="rgba(91,94,244,0.25)" stroke="#5b5ef4" strokeWidth={2} />
      {data.map((d, i) => {
        const p = pointAt(i, 1.18);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="#0a0a0a"
            fontWeight={600}
          >
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}
