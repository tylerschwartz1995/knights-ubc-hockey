import React, { useState } from "react";
import { useTheme } from "../theme.js";

export default function ScoringDonut({ data }) {
  const C = useTheme();
  const [hoveredSeg, setHoveredSeg] = useState(null);

  if (!data.length) return null;

  const totalGoals = data.reduce((s, r) => s + r.g, 0);
  if (totalGoals === 0) return null;

  // Top 8 scorers + "Others"
  const sorted = [...data].filter((r) => r.g > 0).sort((a, b) => b.g - a.g);
  const top = sorted.slice(0, 8);
  const othersGoals = sorted.slice(8).reduce((s, r) => s + r.g, 0);
  const segments = [...top.map((r) => ({ label: r.player, value: r.g }))];
  if (othersGoals > 0) segments.push({ label: "Others", value: othersGoals });

  const size = 180;
  const cx = size / 2, cy = size / 2;
  const outerR = 80, innerR = 52;
  let cumAngle = -Math.PI / 2;

  const goldShades = [
    C.gold, C.goldBright, C.goldMuted, C.goldDim,
    "#b89a40", "#a08838", "#d4b45e", "#7a6a3a", "#e8c96e",
  ];

  const paths = segments.map((seg, i) => {
    const angle = (seg.value / totalGoals) * Math.PI * 2;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const x1o = cx + outerR * Math.cos(startAngle);
    const y1o = cy + outerR * Math.sin(startAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(endAngle);
    const y2i = cy + innerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(startAngle);
    const y1i = cy + innerR * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const midAngle = (startAngle + endAngle) / 2;
    const isHovered = hoveredSeg === i;
    const isDimmed = hoveredSeg !== null && !isHovered;
    // Push slice outward slightly on hover
    const offset = isHovered ? 6 : 0;
    const ox = offset * Math.cos(midAngle);
    const oy = offset * Math.sin(midAngle);

    return (
      <path
        key={i}
        d={`M${x1o + ox},${y1o + oy} A${outerR},${outerR} 0 ${largeArc} 1 ${x2o + ox},${y2o + oy} L${x2i + ox},${y2i + oy} A${innerR},${innerR} 0 ${largeArc} 0 ${x1i + ox},${y1i + oy} Z`}
        fill={goldShades[i % goldShades.length]}
        opacity={isDimmed ? 0.4 : 0.85}
        stroke={C.bg}
        strokeWidth="1"
        style={{ cursor: "pointer", transition: "opacity 0.2s" }}
        onMouseEnter={() => setHoveredSeg(i)}
        onMouseLeave={() => setHoveredSeg(null)}
      />
    );
  });

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
      <h3 style={{
        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 20, textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Goal Distribution
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths}
          {hoveredSeg !== null ? (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fill={C.gold}
                fontSize="22" fontWeight="700" fontFamily="Outfit, sans-serif">
                {segments[hoveredSeg].value} ({Math.round((segments[hoveredSeg].value / totalGoals) * 100)}%)
              </text>
              <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textDim}
                fontSize="8" letterSpacing="1.5" fontFamily="DM Mono, monospace">
                {segments[hoveredSeg].label.split(" ")[1] || segments[hoveredSeg].label}
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fill={C.gold}
                fontSize="24" fontWeight="700" fontFamily="Outfit, sans-serif">{totalGoals}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textDim}
                fontSize="9" letterSpacing="2" fontFamily="DM Mono, monospace">GOALS</text>
            </>
          )}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {segments.map((seg, i) => {
            const isLegendHovered = hoveredSeg === i;
            const isLegendDimmed = hoveredSeg !== null && !isLegendHovered;
            return (
              <div key={seg.label} style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                opacity: isLegendDimmed ? 0.4 : 1, transition: "opacity 0.2s",
              }}
                onMouseEnter={() => setHoveredSeg(i)}
                onMouseLeave={() => setHoveredSeg(null)}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: goldShades[i % goldShades.length], opacity: 0.85, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 14, color: C.textMid, fontFamily: "'Outfit', sans-serif", fontWeight: isLegendHovered ? 700 : 500,
                }}>{seg.label}</span>
                <span style={{
                  fontSize: 14, color: C.textDim, fontFamily: "'DM Mono', monospace", marginLeft: "auto",
                }}>{seg.value} ({Math.round((seg.value / totalGoals) * 100)}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

