import React, { useState, useEffect, useMemo } from "react";
import { useTheme, plainButton } from "../theme.js";
import PlayerCard from "./PlayerCard.jsx";

export default function StatsView({ data, columns, seasonData }) {
  const C = useTheme();
  const [sortKey, setSortKey] = useState("p");
  const [sortAsc, setSortAsc] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  useEffect(() => { setSortKey("p"); setSortAsc(false); }, [data]);

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

  const maxP = Math.max(...data.map((d) => d.p));
  const topScorer = data.reduce((a, b) => (a.p >= b.p ? a : b));
  const topGoals = data.reduce((a, b) => (a.g >= b.g ? a : b));
  const topAssists = data.reduce((a, b) => (a.a >= b.a ? a : b));

  const leaders = [
    { label: "TOP SCORER", player: topScorer.player, value: topScorer.p, unit: "PTS" },
    { label: "GOAL LEADER", player: topGoals.player, value: topGoals.g, unit: "G" },
    { label: "ASSIST LEADER", player: topAssists.player, value: topAssists.a, unit: "A" },
  ];

  // Radar chart config
  const radarAxes = [
    { key: "g", label: "G" },
    { key: "a", label: "A" },
    { key: "ppg", label: "P/GP" },
    { key: "ppp", label: "PPP", format: (value) => value == null ? "—" : value },
    { key: "gwg", label: "GWG" },
    { key: "pm", label: "PIM" },
  ].filter((axis) => axis.key !== "ppp" || data.some((player) => player.ppp !== null));
  const radarMaxes = {};
  radarAxes.forEach(({ key }) => {
    radarMaxes[key] = Math.max(...data.map((d) => d[key] || 0), 1);
  });

  const RadarChart = ({ player }) => {
    const size = 220, cx = size / 2, cy = size / 2, r = 55;
    const n = radarAxes.length;
    const angleStep = (Math.PI * 2) / n;
    const startAngle = -Math.PI / 2;

    const getPoint = (i, pct) => ({
      x: cx + r * pct * Math.cos(startAngle + i * angleStep),
      y: cy + r * pct * Math.sin(startAngle + i * angleStep),
    });

    const values = radarAxes.map(({ key }) => {
      const val = player[key] || 0;
      return Math.min(val / radarMaxes[key], 1);
    });

    const polyPoints = values.map((v, i) => {
      const pt = getPoint(i, v);
      return `${pt.x},${pt.y}`;
    }).join(" ");

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <polygon key={pct} points={
            Array.from({ length: n }, (_, i) => {
              const pt = getPoint(i, pct);
              return `${pt.x},${pt.y}`;
            }).join(" ")
          } fill="none" stroke={C.border} strokeWidth="1" opacity={pct === 1 ? 0.6 : 0.3} />
        ))}
        {/* Axis lines */}
        {radarAxes.map((_, i) => {
          const pt = getPoint(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke={C.border} strokeWidth="1" opacity="0.3" />;
        })}
        {/* Player shape */}
        <polygon points={polyPoints} fill={`${C.gold}30`} stroke={C.gold} strokeWidth="2" />
        {/* Dots at vertices */}
        {values.map((v, i) => {
          const pt = getPoint(i, v);
          return <circle key={i} cx={pt.x} cy={pt.y} r="3" fill={C.gold} />;
        })}
        {/* Labels */}
        {radarAxes.map(({ label, key }, i) => {
          const pt = getPoint(i, 1.45);
          const val = player[key] || 0;
          const displayVal = typeof val === "number" && val % 1 !== 0 ? val.toFixed(1) : val;
          return (
            <g key={i}>
              <text x={pt.x} y={pt.y - 6} textAnchor="middle" dominantBaseline="central"
                fill={C.textFaint} fontSize="9" fontFamily="DM Mono, monospace" letterSpacing="1">
                {label}
              </text>
              <text x={pt.x} y={pt.y + 7} textAnchor="middle" dominantBaseline="central"
                fill={C.gold} fontSize="12" fontFamily="DM Mono, monospace" fontWeight="600">
                {displayVal}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

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
                const barWidth = maxP > 0 ? (row.p / maxP) * 100 : 0;
                const isTop3 = idx < 3;
                const isExpanded = expandedPlayer === row.player;
                return (
                  <React.Fragment key={row.player}>
                    <tr
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        background: isHovered
                          ? "rgba(201, 168, 76, 0.04)"
                          : idx % 2 === 1 ? "rgba(255,255,255,0.006)" : "transparent",
                        transition: "background 0.15s",
                        cursor: seasonData ? "pointer" : "default",
                      }}
                      onClick={() => seasonData && setExpandedPlayer(isExpanded ? null : row.player)}
                    >
                      <td style={{
                        padding: "12px 10px", textAlign: "center",
                        color: isTop3 ? C.goldMuted : C.textFaint,
                        fontSize: 12, fontWeight: 600,
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
                            fontWeight: col.key === "player" ? 600 : col.key === "p" ? 600 : 400,
                            fontFamily: col.key === "player" ? "'Outfit', sans-serif" : "'DM Mono', monospace",
                            fontSize: col.key === "player" ? 16 : 15,
                            letterSpacing: col.key === "player" ? "0.3px" : "0.5px",
                            color:
                              col.key === "player" ? (isTop3 ? C.text : C.textMid)
                              : col.key === "p" ? C.gold
                              : col.key === "ppg" ? C.gold
                              : col.key === "gwg" ? C.goldBright
                              : col.key === "g" ? C.goldBright
                              : col.key === "a" ? C.goldMuted
                              : col.key === "seasons" ? C.gold
                              : C.textDim,
                            position: "relative",
                          }}
                        >
                          {col.key === "player" && (
                            <div style={{
                              position: "absolute", left: 0, bottom: 0, height: 2,
                              width: `${barWidth}%`,
                              background: `linear-gradient(90deg, ${C.gold}22, ${C.gold}04)`,
                              borderRadius: 1,
                            }} />
                          )}
                          {col.key === "player" && seasonData ? (
                            <button type="button" style={plainButton} aria-expanded={isExpanded}
                              onClick={(event) => { event.stopPropagation(); setExpandedPlayer(isExpanded ? null : row.player); }}>
                              {row.player}
                              <span aria-hidden="true" style={{ marginLeft: 6, fontSize: 10, color: C.textFaint }}>{isExpanded ? "▾" : "▸"}</span>
                            </button>
                          ) : (col.format ? col.format(row[col.key]) : row[col.key])}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && seasonData && (
                      <tr>
                        <td colSpan={columns.length + 1} style={{ padding: 0, background: `${C.bg}cc` }}>
                          <div className="vgk-player-expand" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", padding: "16px 20px", gap: 32 }}>
                            <div style={{ flex: "0 0 auto" }}>
                              <PlayerCard player={row.player} seasonData={seasonData} />
                            </div>
                            <div style={{
                              flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                            }}>
                              <div style={{ fontSize: 12, color: C.textFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>
                                Player Profile
                              </div>
                              <RadarChart player={row} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}

