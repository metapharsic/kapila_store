import React from "react";
import { COLORS } from "../../styles/colors";

const PriceTrendChart = ({ points }) => {
  if (!points || points.length < 2) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, background: COLORS.bg + "44", borderRadius: 6, border: `1px dashed ${COLORS.border}` }}>
        <p style={{ color: COLORS.muted, fontSize: 12 }}>Need at least 2 price records to plot trend</p>
      </div>
    );
  }

  const width = 450;
  const height = 150;
  const padding = { top: 15, right: 15, bottom: 20, left: 35 };

  const prices = points.map(p => parseFloat(p.price));
  const minPrice = Math.min(...prices) * 0.9;
  const maxPrice = Math.max(...prices) * 1.1;
  const priceRange = maxPrice - minPrice;

  const getX = (idx) => {
    return padding.left + (idx / (points.length - 1)) * (width - padding.left - padding.right);
  };

  const getY = (val) => {
    return height - padding.bottom - ((val - minPrice) / priceRange) * (height - padding.top - padding.bottom);
  };

  let pathD = "";
  let areaD = "";
  points.forEach((p, idx) => {
    const x = getX(idx);
    const y = getY(parseFloat(p.price));
    if (idx === 0) {
      pathD = `M ${x} ${y}`;
      areaD = `M ${x} ${height - padding.bottom} L ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    }
    if (idx === points.length - 1) {
      areaD += ` L ${x} ${height - padding.bottom} Z`;
    }
  });

  return (
    <div style={{ background: COLORS.bg + "55", borderRadius: 6, padding: 12, border: `1px solid ${COLORS.border}44` }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.brand} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={COLORS.brand} stopOpacity="0.0"/>
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((r, i) => {
          const val = minPrice + r * priceRange;
          const y = getY(val);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={COLORS.border} strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={padding.left - 6} y={y + 3} fill={COLORS.muted} fontSize="8" textAnchor="end">₹{val.toFixed(0)}</text>
            </g>
          );
        })}

        <path d={areaD} fill="url(#chartGrad)" />
        <path d={pathD} fill="none" stroke={COLORS.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, idx) => {
          const x = getX(idx);
          const y = getY(parseFloat(p.price));
          return (
            <g key={idx} style={{ cursor: "pointer" }}>
              <circle cx={x} cy={y} r="4" fill={COLORS.bg} stroke={COLORS.brand} strokeWidth="2" />
              <title>{`${p.date}\n₹${parseFloat(p.price).toFixed(2)}/unit\nSupplier: ${p.supplier || '—'}`}</title>
            </g>
          );
        })}

        {points.map((p, idx) => {
          if (idx === 0 || idx === points.length - 1 || points.length <= 5) {
            const x = getX(idx);
            return (
              <text key={idx} x={x} y={height - 4} fill={COLORS.muted} fontSize="8" textAnchor="middle">
                {p.date.slice(5)}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
};

export default PriceTrendChart;
