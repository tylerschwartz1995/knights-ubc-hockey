import React, { useMemo } from "react";
import { useTheme } from "../theme.js";
import { computeAwards } from "../awards.js";

export default function AwardsView({ skaterData, goalieData, manualAwards }) {
  const C = useTheme();
  const allAwards = useMemo(
    () => computeAwards(skaterData, goalieData, manualAwards),
    [skaterData, goalieData, manualAwards],
  );

  if (allAwards.length === 0) return (
    <p style={{ textAlign: "center", padding: 40, color: C.textDim }}>
      Awards will appear once games have been played.
    </p>
  );

  return (
    <div style={{ animation: "fadeSlideUp 0.5s ease 100ms both" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
      }}>
        {allAwards.map((award) => (
          <div key={award.name} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "20px 18px",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{
              fontSize: 13, color: C.gold, fontWeight: 600, letterSpacing: "2px",
              textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
            }}>{award.name}</div>
            <div style={{
              fontSize: 11, color: C.textDim, fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.5px",
            }}>{award.description}</div>
            <div style={{
              fontSize: 18, color: C.text, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif", marginTop: 4,
            }}>{award.winner}</div>
            {award.stat && (
              <div style={{
                fontSize: 14, color: C.goldMuted, fontWeight: 500,
                fontFamily: "'DM Mono', monospace",
              }}>{award.stat}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
