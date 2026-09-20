import React from "react";
import { useTheme } from "../theme.js";
import { SEASONS } from "../config.js";

export default function PlayerCard({ player, seasonData }) {
  const C = useTheme();
  const seasons = SEASONS.map((s) => {
    const rows = seasonData[s.id] || [];
    const match = rows.find((r) => r.player === player);
    return match ? { label: s.label, ...match } : null;
  }).filter(Boolean);

  if (!seasons.length) return null;

  return (
    <div style={{
      animation: "fadeSlideUp 0.25s ease both",
    }}>
      <div style={{
        fontSize: 12, color: C.textFaint, letterSpacing: "1.5px", marginBottom: 12,
        fontFamily: "'DM Mono', monospace", textTransform: "uppercase",
      }}>
        Season Breakdown
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {seasons.map((s) => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              fontSize: 13, color: C.textMid, fontFamily: "'DM Mono', monospace", minWidth: 64,
            }}>{s.label}</span>
            <span style={{ fontSize: 13, color: C.textDim, fontFamily: "'DM Mono', monospace", textAlign: "center", minWidth: 34 }}>
              {s.gp}<span style={{ fontSize: 9, color: C.textFaint, marginLeft: 2 }}>GP</span>
            </span>
            <span style={{ fontSize: 13, color: C.goldBright, fontFamily: "'DM Mono', monospace", textAlign: "center", minWidth: 34 }}>
              {s.g}<span style={{ fontSize: 9, color: C.textFaint, marginLeft: 2 }}>G</span>
            </span>
            <span style={{ fontSize: 13, color: C.goldMuted, fontFamily: "'DM Mono', monospace", textAlign: "center", minWidth: 34 }}>
              {s.a}<span style={{ fontSize: 9, color: C.textFaint, marginLeft: 2 }}>A</span>
            </span>
            <span style={{ fontSize: 13, color: C.gold, fontWeight: 600, fontFamily: "'DM Mono', monospace", textAlign: "center", minWidth: 34 }}>
              {s.p}<span style={{ fontSize: 9, color: C.textFaint, marginLeft: 2 }}>P</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

