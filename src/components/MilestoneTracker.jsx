import React from "react";
import { useTheme } from "../theme.js";

export default function MilestoneTracker({ allTimeData }) {
  const C = useTheme();
  if (!allTimeData.length) return null;

  const thresholds = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  const milestones = [];
  allTimeData.forEach((p) => {
    // Goals milestones
    for (const t of thresholds) {
      const diff = t - p.g;
      if (diff > 0 && diff <= 5) {
        milestones.push({ player: p.player, stat: "goals", current: p.g, target: t, diff });
      }
    }
    // Points milestones
    for (const t of thresholds) {
      const diff = t - p.p;
      if (diff > 0 && diff <= 5) {
        milestones.push({ player: p.player, stat: "points", current: p.p, target: t, diff });
      }
    }
    // Games played milestones
    for (const t of thresholds) {
      const diff = t - p.gp;
      if (diff > 0 && diff <= 5) {
        milestones.push({ player: p.player, stat: "games", current: p.gp, target: t, diff });
      }
    }
    // Assists milestones
    for (const t of thresholds) {
      const diff = t - p.a;
      if (diff > 0 && diff <= 5) {
        milestones.push({ player: p.player, stat: "assists", current: p.a, target: t, diff });
      }
    }
  });

  milestones.sort((a, b) => a.diff - b.diff);
  const shown = milestones.slice(0, 6);

  if (!shown.length) return null;

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 550ms both" }}>
      <h3 style={{
        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 16, textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Milestone Watch
      </h3>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: 8,
      }}>
        {shown.map((m, i) => {
          const pct = (m.current / m.target) * 100;
          return (
            <div key={`${m.player}-${m.stat}-${m.target}`} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "14px 16px",
              animation: `fadeSlideUp 0.35s ease ${600 + i * 50}ms both`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: C.text,
                  fontFamily: "'Outfit', sans-serif",
                }}>{m.player}</span>
                <span style={{
                  fontSize: 15, color: C.goldMuted, fontFamily: "'DM Mono', monospace",
                }}>{m.diff} {m.stat} to {m.target}</span>
              </div>
              <div style={{
                height: 6, background: C.bg, borderRadius: 3,
                border: `1px solid ${C.border}`, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${pct}%`, borderRadius: 3,
                  background: `linear-gradient(90deg, ${C.goldDim}, ${C.gold})`,
                  transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
              </div>
              <div style={{
                fontSize: 15, color: C.textFaint, marginTop: 4,
                fontFamily: "'DM Mono', monospace",
              }}>{m.current} / {m.target} {m.stat}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

