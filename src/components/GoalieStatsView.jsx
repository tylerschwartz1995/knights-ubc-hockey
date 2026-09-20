import React, { useState, useEffect, useMemo } from "react";
import { useTheme, plainButton } from "../theme.js";

export default function GoalieStatsView({ data, columns }) {
  const C = useTheme();
  const [sortKey, setSortKey] = useState("svPct");
  const [sortAsc, setSortAsc] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  useEffect(() => { setSortKey("svPct"); setSortAsc(false); }, [data]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }, [data, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (!data.length) return null;

  const bestSvPct = data.reduce((a, b) => (a.svPct >= b.svPct ? a : b));
  const mostSaves = data.reduce((a, b) => (a.sv >= b.sv ? a : b));
  const bestGAA = data.reduce((a, b) => (a.gaa <= b.gaa && a.gp > 0 ? a : b));

  const leaders = [
    { label: "BEST SV%", player: bestSvPct.player, value: bestSvPct.svPct.toFixed(3), unit: "SV%" },
    { label: "MOST SAVES", player: mostSaves.player, value: mostSaves.sv, unit: "SV" },
    { label: "BEST GAA", player: bestGAA.player, value: bestGAA.gaa.toFixed(2), unit: "GAA" },
  ];

  return (
    <>
      {/* Leader Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 12, marginBottom: 40,
      }}>
        {leaders.map((l, i) => (
          <div key={l.label} style={{
            background: `linear-gradient(145deg, ${C.surface} 0%, ${C.surfaceLight} 100%)`,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.gold}`,
            borderRadius: 6, padding: "20px 22px 18px",
            position: "relative", overflow: "hidden",
            animation: `fadeSlideUp 0.5s ease ${100 + i * 70}ms both`,
          }}>
            <div style={{
              position: "absolute", top: -20, right: -20, width: 80, height: 80,
              background: `radial-gradient(circle, rgba(201,168,76,0.04), transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div style={{
              fontSize: 13, color: C.goldMuted, letterSpacing: "2.5px",
              fontWeight: 500, marginBottom: 10,
              fontFamily: "'DM Mono', monospace",
            }}>
              {l.label}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: C.text,
              fontFamily: "'Outfit', sans-serif", letterSpacing: "0.5px",
            }}>
              {l.player}
            </div>
            <div style={{
              fontSize: 17, color: C.gold, fontWeight: 600, marginTop: 4,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {l.value} <span style={{ fontSize: 14, color: C.goldMuted }}>{l.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 8, overflow: "hidden",
        animation: "fadeSlideUp 0.5s ease 350ms both",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.gold}33` }}>
                <th style={{
                  padding: "14px 10px", textAlign: "center", width: 36,
                  color: C.textFaint, fontSize: 14, fontWeight: 500,
                  fontFamily: "'DM Mono', monospace", letterSpacing: "1px",
                }}>#</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : "none"}
                    style={{
                      padding: "14px 10px",
                      textAlign: col.align || "center",
                      color: sortKey === col.key ? C.gold : C.textDim,
                      fontSize: 15, fontWeight: 500, letterSpacing: "1.5px",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                      fontFamily: "'DM Mono', monospace",
                      transition: "color 0.2s",
                    }}
                  >
                    <button type="button" style={plainButton} onClick={() => handleSort(col.key)}>
                      {col.label}
                      {sortKey === col.key && (
                        <span aria-hidden="true" style={{ marginLeft: 3, fontSize: 8 }}>{sortAsc ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const isHovered = hoveredRow === idx;
                const isTop3 = idx < 3;
                return (
                  <tr
                    key={row.player}
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: isHovered
                        ? "rgba(201, 168, 76, 0.04)"
                        : idx % 2 === 1 ? "rgba(255,255,255,0.006)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <td style={{
                      padding: "12px 10px", textAlign: "center",
                      color: isTop3 ? C.goldMuted : C.textFaint,
                      fontSize: 14, fontWeight: 600,
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {idx + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: "12px 10px",
                          textAlign: col.align || "center",
                          borderBottom: `1px solid ${C.bg}`,
                          fontWeight: col.key === "player" ? 600 : col.key === "svPct" ? 600 : 400,
                          fontFamily: col.key === "player" ? "'Outfit', sans-serif" : "'DM Mono', monospace",
                          fontSize: col.key === "player" ? 16 : 15,
                          letterSpacing: col.key === "player" ? "0.3px" : "0.5px",
                          color:
                            col.key === "player" ? (isTop3 ? C.text : C.textMid)
                            : col.key === "svPct" ? C.gold
                            : col.key === "gaa" ? C.goldBright
                            : col.key === "sv" ? C.goldMuted
                            : col.key === "seasons" ? C.gold
                            : C.textDim,
                        }}
                      >
                        {col.format ? col.format(row[col.key]) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

