import React from 'react';

export default function RevenueChart({ series = [] }) {
  if (!series.length) return null;

  const width = 560;
  const height = 195;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 32;

  const maxRev = Math.max(...series.map((d) => Number(d.revenue) || 0), 1500);
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const points = series.map((d, idx) => {
    const x = padLeft + (idx / Math.max(series.length - 1, 1)) * innerW;
    const y = padTop + innerH - ((Number(d.revenue) || 0) / maxRev) * innerH;
    return { x, y, ...d };
  });

  const buildSmoothPath = (pts) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + innerH} L ${points[0].x} ${padTop + innerH} Z`;
  const weekTotal = series.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);

  return (
    <div className="revenue-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="revenue-svg">
        <defs>
          <linearGradient id="orangeAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5200" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#FF5200" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t, idx) => {
          const y = padTop + innerH - t * innerH;
          const val = Math.round((t * maxRev) / 50) * 50;
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#F1F5F9" strokeDasharray="4 4" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10.5" fontWeight="600" fill="#64748B">
                ₹{val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#orangeAreaGrad)" />
        <path d={linePath} fill="none" stroke="#FF5200" strokeWidth="3" strokeLinecap="round" />

        {points.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4.5" fill="#FFFFFF" stroke="#FF5200" strokeWidth="2.5" />
            {pt.revenue > 0 && (
              <text x={pt.x} y={pt.y - 9} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#EA580C">
                ₹{pt.revenue}
              </text>
            )}
            <text x={pt.x} y={height - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569">
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-caption">
        <span className="positive-text">
          7-Day Gross Revenue: ₹{weekTotal.toLocaleString('en-IN')} • Live Auto-Syncing
        </span>
      </div>
    </div>
  );
}
