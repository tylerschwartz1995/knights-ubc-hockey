import React from "react";
import { useTheme } from "../theme.js";

export default function PaceProjections({ data, totalGames }) {
  const C = useTheme();
  if (!data.length || !Number.isInteger(totalGames) || totalGames <= 0) return null;
  const top = [...data]
    .filter((r) => r.gp >= 3) // minimum 3 games to project
    .sort((a, b) => b.ppg - a.ppg)
    .slice(0, 10)
    .map((r) => {
      const remaining = Math.max(0, totalGames - r.gp);
      const projG = Math.round(r.g + (r.gp > 0 ? (r.g / r.gp) * remaining : 0));
      const projA = Math.round(r.a + (r.gp > 0 ? (r.a / r.gp) * remaining : 0));
      const projP = Math.round(r.p + (r.ppg * remaining));
      return { ...r, projG, projA, projP, remaining };
    });

  if (!top.length) return null;

  const maxProj = Math.max(...top.map((r) => r.projP), 1);

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
      <h3 style={{
        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 6, textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Season Pace
      </h3>
      <p style={{
        fontSize: 14, color: C.textFaint, fontFamily: "'DM Mono', monospace",
        marginBottom: 16, marginTop: 0,
      }}>
        Projected points over {totalGames} games
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map((r, i) => (
          <div key={r.player} style={{
            display: "grid", gridTemplateColumns: "100px 1fr 60px",
            alignItems: "center", gap: 12,
            animation: `fadeSlideUp 0.3s ease ${520 + i * 40}ms both`,
          }}>
            <span style={{
              fontSize: 14, color: C.textMid, textAlign: "right",
              fontWeight: 600, fontFamily: "'Outfit', sans-serif",
            }}>{r.player}</span>
            <div style={{ position: "relative", height: 24, borderRadius: 3, overflow: "hidden", background: C.bg, border: `1px solid ${C.border}` }}>
              {/* Current stats (solid) */}
              <div style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                width: `${(r.p / maxProj) * 100}%`,
                display: "flex",
              }}>
                <div style={{
                  width: r.p > 0 ? `${(r.g / r.p) * 100}%` : "0%", height: "100%",
                  background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright})`,
                }} />
                <div style={{
                  width: r.p > 0 ? `${(r.a / r.p) * 100}%` : "0%", height: "100%",
                  background: `linear-gradient(90deg, ${C.goldDim}, ${C.goldMuted})`,
                }} />
              </div>
              {/* Projected (striped/faded) */}
              <div style={{
                position: "absolute", left: `${(r.p / maxProj) * 100}%`, top: 0, height: "100%",
                width: `${((r.projP - r.p) / maxProj) * 100}%`,
                background: `repeating-linear-gradient(90deg, ${C.gold}20, ${C.gold}20 3px, transparent 3px, transparent 6px)`,
              }} />
            </div>
            <div style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{r.projP}</span>
              <span style={{ fontSize: 11, color: C.textFaint, marginLeft: 4 }}>({r.p})</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 12, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: C.gold }} />
          <span style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace" }}>CURRENT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: `repeating-linear-gradient(90deg, ${C.gold}40, ${C.gold}40 2px, transparent 2px, transparent 4px)` }} />
          <span style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace" }}>PROJECTED</span>
        </div>
      </div>
    </div>
  );
}

