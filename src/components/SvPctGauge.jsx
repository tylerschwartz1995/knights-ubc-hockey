import React from "react";
import { useTheme } from "../theme.js";

export default function SvPctGauge({ data }) {
  const C = useTheme();
  if (!data.length) return null;

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
      <h3 style={{
        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 20, textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Save Percentage
      </h3>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 16, justifyItems: "center",
      }}>
        {[...data].sort((a, b) => b.svPct - a.svPct).map((g) => {
          const pct = g.svPct;
          // Map 0.750–1.000 range to 0–180 degrees
          const minPct = 0.75;
          const normalised = Math.max(0, Math.min(1, (pct - minPct) / (1 - minPct)));
          const angle = normalised * 180;
          const rad = (angle * Math.PI) / 180;
          const r = 50, cx = 60, cy = 60;
          // Arc from left (180deg) to computed angle
          const startX = cx - r;
          const startY = cy;
          const endX = cx - r * Math.cos(rad);
          const endY = cy - r * Math.sin(rad);
          const largeArc = 0; // always short arc for semicircle gauge

          return (
            <div key={g.player} style={{ textAlign: "center" }}>
              <svg width="120" height="72" viewBox="0 0 120 72">
                {/* Background arc */}
                <path
                  d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`}
                  fill="none" stroke={C.border} strokeWidth="8" strokeLinecap="round"
                />
                {/* Value arc */}
                {angle > 0 && (
                  <path
                    d={`M${startX},${startY} A${r},${r} 0 ${largeArc} 1 ${endX},${endY}`}
                    fill="none"
                    stroke={pct >= 0.9 ? C.gold : pct >= 0.85 ? C.goldMuted : C.goldDim}
                    strokeWidth="8" strokeLinecap="round"
                  />
                )}
                <text x={cx} y={cy - 8} textAnchor="middle" fill={C.gold}
                  fontSize="18" fontWeight="700" fontFamily="Outfit, sans-serif">
                  {(pct * 100).toFixed(1)}%
                </text>
              </svg>
              <div style={{
                fontSize: 14, color: C.textMid, fontWeight: 600,
                fontFamily: "'Outfit', sans-serif", marginTop: -4,
              }}>{g.player}</div>
              <div style={{
                fontSize: 13, color: C.textFaint, fontFamily: "'DM Mono', monospace",
              }}>{g.gp} GP</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

