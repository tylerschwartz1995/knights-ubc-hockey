import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";

// ── Config ──────────────────────────────────────────────
// Add each season file here. First entry = current season.
const SEASONS = [
  { id: "2025-26", label: "2025–26", dir: "/seasons/2025-26" },
  { id: "2024-25", label: "2024–25", dir: "/seasons/2024-25" },
  // { id: "2023-24", label: "2023–24", dir: "/seasons/2023-24" },
];

const CONFIG = {
  teamName: "UBC Knights",
  established: "2023",
};

// ── Colors ──────────────────────────────────────────────
const DARK = {
  bg: "#151311",
  surface: "#1c1a17",
  surfaceLight: "#222019",
  border: "#2e2a21",
  gold: "#c9a84c",
  goldBright: "#dfc06a",
  goldMuted: "#8a7a52",
  goldDim: "#5c5238",
  text: "#e8e0cc",
  textMid: "#a89d85",
  textDim: "#6b6352",
  textFaint: "#3d3830",
};

const LIGHT = {
  bg: "#f5f2eb",
  surface: "#ffffff",
  surfaceLight: "#faf8f4",
  border: "#e0d9c8",
  gold: "#9a7b2e",
  goldBright: "#7a6020",
  goldMuted: "#a89060",
  goldDim: "#c4b68e",
  text: "#1a1710",
  textMid: "#4a4435",
  textDim: "#7a7060",
  textFaint: "#c0b8a8",
};

let C = DARK;

// ── CSV parsing ─────────────────────────────────────────
function parseCSV(text) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return result.data.map((row) => {
    const norm = {};
    Object.entries(row).forEach(([k, v]) => {
      norm[k.trim().toLowerCase()] = (v || "").trim();
    });
    const g = parseInt(norm.g || norm.goals || 0) || 0;
    const a = parseInt(norm.a || norm.assists || 0) || 0;
    const p = parseInt(norm.p || norm.pts || norm.points || 0) || g + a;
    const gp = parseInt(norm.gp || norm.games_played || norm.games || 0) || 0;
    return {
      player: norm.player || norm.name || "Unknown",
      gp, g, a, p,
      ppg: gp > 0 ? Math.round((p / gp) * 100) / 100 : 0,
      pm: parseInt(norm.pm || norm.pim || norm.penalty_minutes || norm.penalties || 0) || 0,
    };
  });
}

function parseGoalieCSV(text) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return result.data.map((row) => {
    const norm = {};
    Object.entries(row).forEach(([k, v]) => {
      norm[k.trim().toLowerCase()] = (v || "").trim();
    });
    return {
      player: norm.player || norm.name || "Unknown",
      gp: parseInt(norm.gp || 0) || 0,
      gaa: parseFloat(norm.gaa || 0) || 0,
      svPct: parseFloat(norm["sv%"] || 0) || 0,
      sv: parseInt(norm.sv || 0) || 0,
      ga: parseInt(norm.ga || 0) || 0,
      sa: parseInt(norm.sa || 0) || 0,
      min: parseInt(norm.min || 0) || 0,
      otl: parseInt(norm.otl || 0) || 0,
    };
  });
}

function parseGamesCSV(text) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return result.data.map((row) => {
    const norm = {};
    Object.entries(row).forEach(([k, v]) => {
      norm[k.trim().toLowerCase()] = (v || "").trim();
    });
    return {
      date: norm.date || "",
      opponent: norm.opponent || "Unknown",
      gf: parseInt(norm.gf || 0) || 0,
      ga: parseInt(norm.ga || 0) || 0,
      result: norm.result || "",
      ot: norm.ot === "1",
      home: norm.home === "1",
    };
  });
}

function aggregateAllTime(seasonDataMap) {
  const totals = {};
  Object.values(seasonDataMap).forEach((rows) => {
    rows.forEach((r) => {
      const key = r.player;
      if (!totals[key]) totals[key] = { player: key, gp: 0, g: 0, a: 0, p: 0, pm: 0, seasons: 0 };
      totals[key].gp += r.gp;
      totals[key].g += r.g;
      totals[key].a += r.a;
      totals[key].p += r.p;
      totals[key].pm += r.pm;
      totals[key].seasons += 1;
    });
  });
  return Object.values(totals).map((t) => ({
    ...t,
    ppg: t.gp > 0 ? Math.round((t.p / t.gp) * 100) / 100 : 0,
  }));
}

function aggregateGoalieAllTime(seasonDataMap) {
  const totals = {};
  Object.values(seasonDataMap).forEach((rows) => {
    rows.forEach((r) => {
      const key = r.player;
      if (!totals[key]) totals[key] = { player: key, gp: 0, sv: 0, ga: 0, sa: 0, min: 0, otl: 0, seasons: 0 };
      totals[key].gp += r.gp;
      totals[key].sv += r.sv;
      totals[key].ga += r.ga;
      totals[key].sa += r.sa;
      totals[key].min += r.min;
      totals[key].otl += r.otl;
      totals[key].seasons += 1;
    });
  });
  return Object.values(totals).map((t) => ({
    ...t,
    gaa: t.min > 0 ? Math.round((t.ga / t.min) * 60 * 100) / 100 : 0,
    svPct: t.sa > 0 ? Math.round((t.sv / t.sa) * 1000) / 1000 : 0,
  }));
}

// ── Columns ─────────────────────────────────────────────
const BASE_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "gp", label: "GP" },
  { key: "g", label: "G" },
  { key: "a", label: "A" },
  { key: "p", label: "PTS" },
  { key: "ppg", label: "PPG", format: (v) => v.toFixed(2) },
  { key: "pm", label: "PIM" },
];

const ALLTIME_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "seasons", label: "SZN" },
  { key: "gp", label: "GP" },
  { key: "g", label: "G" },
  { key: "a", label: "A" },
  { key: "p", label: "PTS" },
  { key: "ppg", label: "PPG", format: (v) => v.toFixed(2) },
  { key: "pm", label: "PIM" },
];

const GOALIE_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "gp", label: "GP" },
  { key: "gaa", label: "GAA", format: (v) => v.toFixed(2) },
  { key: "svPct", label: "SV%", format: (v) => v.toFixed(3) },
  { key: "sv", label: "SV" },
  { key: "ga", label: "GA" },
  { key: "sa", label: "SA" },
  { key: "min", label: "MIN" },
  { key: "otl", label: "OTL" },
];

const GOALIE_ALLTIME_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "seasons", label: "SZN" },
  { key: "gp", label: "GP" },
  { key: "gaa", label: "GAA", format: (v) => v.toFixed(2) },
  { key: "svPct", label: "SV%", format: (v) => v.toFixed(3) },
  { key: "sv", label: "SV" },
  { key: "ga", label: "GA" },
  { key: "sa", label: "SA" },
  { key: "min", label: "MIN" },
  { key: "otl", label: "OTL" },
];

// ── Knight Logo SVG ─────────────────────────────────────
function KnightLogo({ size = 64 }) {
  const h = size * (72 / 64);
  return (
    <svg width={size} height={h} viewBox="0 0 64 72" fill="none" style={{
      opacity: 0.85, flexShrink: 0,
      filter: "drop-shadow(0 2px 8px rgba(201,168,76,0.15))",
    }}>
      <path d="M32 2L4 14V38C4 52 16 64 32 70C48 64 60 52 60 38V14L32 2Z"
        fill="#1a1814" stroke={C.gold} strokeWidth="1.5" />
      <path d="M32 7L9 17V37C9 49 19 59 32 65C45 59 55 49 55 37V17L32 7Z"
        fill="#111" stroke={C.goldDim} strokeWidth="0.5" />
      <path d="M22 28C22 20 26 15 32 13C38 15 42 20 42 28V36H22V28Z"
        fill={C.gold} opacity="0.9" />
      <path d="M25 26L32 33L39 26" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 36V42C22 44 24 46 26 46H38C40 46 42 44 42 42V36"
        fill={C.goldMuted} stroke={C.gold} strokeWidth="0.5" />
      <line x1="28" y1="36" x2="28" y2="46" stroke="#111" strokeWidth="1" opacity="0.4" />
      <line x1="32" y1="36" x2="32" y2="46" stroke="#111" strokeWidth="1" opacity="0.4" />
      <line x1="36" y1="36" x2="36" y2="46" stroke="#111" strokeWidth="1" opacity="0.4" />
      <line x1="6" y1="56" x2="26" y2="20" stroke={C.goldDim} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="58" y1="56" x2="38" y2="20" stroke={C.goldDim} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

// ── History Dropdown ────────────────────────────────────
function HistoryDropdown({ seasons, activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = seasons.some((s) => s.id === activeId);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const activeLabel = isActive ? seasons.find((s) => s.id === activeId)?.label : null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="vgk-tab"
        style={{
          padding: "12px 20px", fontSize: 13, fontWeight: 500, letterSpacing: "1.5px",
          textTransform: "uppercase", fontFamily: "'Outfit', sans-serif",
          border: "none",
          borderBottom: isActive ? `2px solid ${C.gold}` : "2px solid transparent",
          background: isActive ? "rgba(201, 168, 76, 0.06)" : "transparent",
          color: isActive ? C.text : C.textDim,
          cursor: "pointer", transition: "all 0.25s ease",
          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        {activeLabel ? `History · ${activeLabel}` : "History"}
        <svg width="10" height="6" viewBox="0 0 10 6" style={{
          transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)",
        }}>
          <path d="M1 1L5 5L9 1" stroke={isActive ? C.gold : C.textDim} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6, overflow: "hidden", minWidth: 160, zIndex: 100,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.15s ease",
        }}>
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSelect(s.id); setOpen(false); }}
              style={{
                display: "block", width: "100%", padding: "12px 18px", textAlign: "left",
                fontSize: 13, fontWeight: activeId === s.id ? 600 : 400,
                fontFamily: "'Outfit', sans-serif", letterSpacing: "1px",
                color: activeId === s.id ? C.gold : C.textMid,
                background: activeId === s.id ? "rgba(201,168,76,0.06)" : "transparent",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                borderBottom: `1px solid ${C.border}`,
              }}
              onMouseEnter={(e) => { if (activeId !== s.id) e.target.style.background = "rgba(201,168,76,0.03)"; }}
              onMouseLeave={(e) => { if (activeId !== s.id) e.target.style.background = "transparent"; }}
            >
              {s.label} Season
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Player Card (Expandable) ───────────────────────────
function PlayerCard({ player, seasonData }) {
  const seasons = SEASONS.map((s) => {
    const rows = seasonData[s.id] || [];
    const match = rows.find((r) => r.player === player);
    return match ? { label: s.label, ...match } : null;
  }).filter(Boolean);

  if (!seasons.length) return null;

  const maxP = Math.max(...seasons.map((s) => s.p), 1);

  return (
    <div style={{
      padding: "16px 20px 16px 46px",
      animation: "fadeSlideUp 0.25s ease both",
    }}>
      <div style={{
        fontSize: 12, color: C.textDim, letterSpacing: "2px", marginBottom: 10,
        fontFamily: "'DM Mono', monospace", textTransform: "uppercase",
      }}>
        Season Breakdown
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {seasons.map((s) => (
          <div key={s.label} style={{
            display: "grid", gridTemplateColumns: "60px 30px 30px 30px 30px 1fr",
            alignItems: "center", gap: 8,
          }}>
            <span style={{
              fontSize: 11, color: C.textMid, fontFamily: "'DM Mono', monospace",
            }}>{s.label}</span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
              {s.gp}<span style={{ fontSize: 8, color: C.textFaint, marginLeft: 2 }}>GP</span>
            </span>
            <span style={{ fontSize: 11, color: C.goldBright, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
              {s.g}<span style={{ fontSize: 8, color: C.textFaint, marginLeft: 2 }}>G</span>
            </span>
            <span style={{ fontSize: 11, color: C.goldMuted, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
              {s.a}<span style={{ fontSize: 8, color: C.textFaint, marginLeft: 2 }}>A</span>
            </span>
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
              {s.p}<span style={{ fontSize: 8, color: C.textFaint, marginLeft: 2 }}>P</span>
            </span>
            <div style={{
              height: 8, borderRadius: 2, overflow: "hidden",
              background: C.border, display: "flex",
            }}>
              <div style={{
                width: `${(s.g / maxP) * 100}%`, height: "100%",
                background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright})`,
              }} />
              <div style={{
                width: `${(s.a / maxP) * 100}%`, height: "100%",
                background: `linear-gradient(90deg, ${C.goldDim}, ${C.goldMuted})`,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── StatsView ───────────────────────────────────────────
function StatsView({ data, columns, seasonData }) {
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
                    onClick={() => handleSort(col.key)}
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
                    {col.label}
                    {sortKey === col.key && (
                      <span style={{ marginLeft: 3, fontSize: 8 }}>{sortAsc ? "▲" : "▼"}</span>
                    )}
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
                          {col.format ? col.format(row[col.key]) : row[col.key]}
                          {col.key === "player" && seasonData && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: C.textFaint }}>
                              {isExpanded ? "▾" : "▸"}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && seasonData && (
                      <tr>
                        <td colSpan={columns.length + 1} style={{ padding: 0, background: `${C.bg}cc` }}>
                          <PlayerCard player={row.player} seasonData={seasonData} />
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

// ── Points Breakdown Bar Chart ─────────────────────────
function PointsBreakdown({ data }) {
  if (!data.length) return null;
  const maxP = Math.max(...data.map((d) => d.p));
  if (maxP === 0) return null;

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 450ms both" }}>
      <h3 style={{
        fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 20, textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Points Breakdown
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...data]
          .sort((a, b) => b.p - a.p)
          .map((row, i) => (
            <div key={row.player} style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr 38px",
              alignItems: "center", gap: 12,
              animation: `fadeSlideUp 0.35s ease ${500 + i * 35}ms both`,
            }}>
              <span style={{
                fontSize: 14, color: C.textMid, textAlign: "right",
                fontWeight: 600, fontFamily: "'Outfit', sans-serif",
              }}>
                {row.player}
              </span>
              <div style={{
                display: "flex", height: 22, borderRadius: 3,
                overflow: "hidden", background: C.bg,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: `${(row.g / maxP) * 100}%`,
                  background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright})`,
                  transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
                <div style={{
                  width: `${(row.a / maxP) * 100}%`,
                  background: `linear-gradient(90deg, ${C.goldDim}, ${C.goldMuted})`,
                  transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
              </div>
              <span style={{
                fontSize: 15, color: C.gold, fontWeight: 600, textAlign: "right",
                fontFamily: "'DM Mono', monospace",
              }}>
                {row.p}
              </span>
            </div>
          ))}
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 16, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: C.gold }} />
          <span style={{ fontSize: 14, color: C.textDim, letterSpacing: "1.5px", fontFamily: "'DM Mono', monospace" }}>GOALS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: C.goldDim }} />
          <span style={{ fontSize: 14, color: C.textDim, letterSpacing: "1.5px", fontFamily: "'DM Mono', monospace" }}>ASSISTS</span>
        </div>
      </div>
    </div>
  );
}

// ── Scoring Distribution (Donut Chart) ─────────────────
function ScoringDonut({ data }) {
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

    return (
      <path
        key={i}
        d={`M${x1o},${y1o} A${outerR},${outerR} 0 ${largeArc} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${largeArc} 0 ${x1i},${y1i} Z`}
        fill={goldShades[i % goldShades.length]}
        opacity={0.85}
        stroke={C.bg}
        strokeWidth="1"
      />
    );
  });

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
      <h3 style={{
        fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 20, textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Goal Distribution
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths}
          <text x={cx} y={cy - 6} textAnchor="middle" fill={C.gold}
            fontSize="24" fontWeight="700" fontFamily="Outfit, sans-serif">{totalGoals}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textDim}
            fontSize="9" letterSpacing="2" fontFamily="DM Mono, monospace">GOALS</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {segments.map((seg, i) => (
            <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2,
                background: goldShades[i % goldShades.length], opacity: 0.85, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 14, color: C.textMid, fontFamily: "'Outfit', sans-serif", fontWeight: 500,
              }}>{seg.label}</span>
              <span style={{
                fontSize: 14, color: C.textDim, fontFamily: "'DM Mono', monospace", marginLeft: "auto",
              }}>{seg.value} ({Math.round((seg.value / totalGoals) * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Milestone Tracker ──────────────────────────────────
function MilestoneTracker({ allTimeData }) {
  if (!allTimeData.length) return null;

  const thresholds = [25, 50, 75, 100, 150, 200, 250, 500];

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
        fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
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

// ── SV% Gauge ──────────────────────────────────────────
function SvPctGauge({ data }) {
  if (!data.length) return null;

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
      <h3 style={{
        fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
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

// ── GoalieStatsView ────────────────────────────────────
function GoalieStatsView({ data, columns, subtitle }) {
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
      <p style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 14, color: C.textDim, letterSpacing: "2.5px",
        textTransform: "uppercase", marginBottom: 28, marginTop: 0,
      }}>
        {subtitle}
      </p>

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
                    onClick={() => handleSort(col.key)}
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
                    {col.label}
                    {sortKey === col.key && (
                      <span style={{ marginLeft: 3, fontSize: 8 }}>{sortAsc ? "▲" : "▼"}</span>
                    )}
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

// ── TeamView ───────────────────────────────────────────
function TeamView({ skaterData, goalieData, games }) {
  const [oppSortKey, setOppSortKey] = useState("gp");
  const [oppSortAsc, setOppSortAsc] = useState(false);
  const handleOppSort = (key) => {
    if (oppSortKey === key) setOppSortAsc(!oppSortAsc);
    else { setOppSortKey(key); setOppSortAsc(false); }
  };
  const totalGoals = skaterData.reduce((s, r) => s + r.g, 0);
  const totalAssists = skaterData.reduce((s, r) => s + r.a, 0);
  const totalPIM = skaterData.reduce((s, r) => s + r.pm, 0);
  const rosterSize = skaterData.length;
  const topGoalie = goalieData.length
    ? goalieData.reduce((a, b) => (a.gp >= b.gp ? a : b))
    : null;

  const wins = games.filter((g) => g.result === "W").length;
  const losses = games.filter((g) => g.result === "L").length;
  const otl = games.filter((g) => g.result === "OTL").length;
  const gf = games.reduce((s, g) => s + g.gf, 0);
  const ga = games.reduce((s, g) => s + g.ga, 0);

  // Current form (last 5 games)
  const last5 = [...games].reverse().slice(0, 5);
  let streak = "";
  if (games.length > 0) {
    const reversed = [...games].reverse();
    const firstResult = reversed[0]?.result;
    let count = 0;
    for (const g of reversed) {
      if (g.result === firstResult) count++;
      else break;
    }
    streak = `${firstResult}${count}`;
  }

  // Opponent breakdown
  const opponents = {};
  games.forEach((g) => {
    if (!opponents[g.opponent]) opponents[g.opponent] = { gp: 0, w: 0, l: 0, otl: 0, gf: 0, ga: 0 };
    const o = opponents[g.opponent];
    o.gp++;
    if (g.result === "W") o.w++;
    else if (g.result === "L") o.l++;
    else o.otl++;
    o.gf += g.gf;
    o.ga += g.ga;
  });
  const opponentList = Object.entries(opponents)
    .map(([name, s]) => ({ name, ...s, diff: s.gf - s.ga }))
    .sort((a, b) => {
      const av = a[oppSortKey], bv = b[oppSortKey];
      if (typeof av === "string") return oppSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return oppSortAsc ? av - bv : bv - av;
    });

  const statWidgets = [
    { label: "RECORD", value: `${wins}-${losses}-${otl}` },
    { label: "GAMES", value: games.length },
    { label: "GOALS FOR", value: gf },
    { label: "GOALS AGAINST", value: ga },
    { label: "DIFF", value: gf - ga >= 0 ? `+${gf - ga}` : `${gf - ga}` },
  ];

  const teamWidgets = [
    { label: "TOTAL GOALS", value: totalGoals },
    { label: "TOTAL ASSISTS", value: totalAssists },
    { label: "ROSTER", value: rosterSize },
    { label: "PIM", value: totalPIM },
  ];
  if (topGoalie) {
    teamWidgets.push({ label: "TEAM SV%", value: topGoalie.svPct.toFixed(3) });
  }

  const renderWidgetRow = (widgets, delay = 0) => (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${widgets.length}, 1fr)`,
      gap: 10, marginBottom: 20,
      animation: `fadeSlideUp 0.4s ease ${delay}ms both`,
    }}>
      {widgets.map((w) => (
        <div key={w.label} style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: "16px 14px", textAlign: "center",
        }}>
          <div style={{
            fontSize: 26, fontWeight: 700, color: C.gold,
            fontFamily: "'Outfit', sans-serif",
          }}>{w.value}</div>
          <div style={{
            fontSize: 13, color: C.textDim, letterSpacing: "2px",
            fontFamily: "'DM Mono', monospace", marginTop: 5,
          }}>{w.label}</div>
        </div>
      ))}
    </div>
  );

  const recentGames = [...games].reverse().slice(0, 10);

  const resultColor = (r) => r === "W" ? "#4ade80" : r === "OTL" ? C.goldMuted : "#f87171";

  return (
    <>
      {games.length > 0 && renderWidgetRow(statWidgets, 60)}
      {renderWidgetRow(teamWidgets, 120)}

      {/* Current Form */}
      {last5.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 32,
          animation: "fadeSlideUp 0.4s ease 160ms both",
        }}>
          <span style={{
            fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
          }}>FORM</span>
          <div style={{ display: "flex", gap: 6 }}>
            {last5.map((g, i) => (
              <div key={`${g.date}-${i}`} style={{
                width: 36, height: 36, borderRadius: 6, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                background: g.result === "W" ? "rgba(74,222,128,0.12)" : g.result === "OTL" ? "rgba(201,168,76,0.12)" : "rgba(248,113,113,0.12)",
                color: resultColor(g.result),
                border: `1px solid ${g.result === "W" ? "rgba(74,222,128,0.25)" : g.result === "OTL" ? "rgba(201,168,76,0.25)" : "rgba(248,113,113,0.25)"}`,
              }}>{g.result[0]}</div>
            ))}
          </div>
          {streak && (
            <span style={{
              fontSize: 16, fontWeight: 700, color: resultColor(streak[0] === "W" ? "W" : streak[0] === "O" ? "OTL" : "L"),
              fontFamily: "'DM Mono', monospace",
            }}>{streak}</span>
          )}
        </div>
      )}


      {/* Opponent Breakdown */}
      {opponentList.length > 0 && (
        <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 250ms both" }}>
          <h3 style={{
            fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            marginBottom: 12, textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace",
          }}>vs Opponents</h3>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.gold}33` }}>
                  {[{k:"name",l:"OPPONENT"},{k:"gp",l:"GP"},{k:"w",l:"W"},{k:"l",l:"L"},{k:"otl",l:"OTL"},{k:"gf",l:"GF"},{k:"ga",l:"GA"},{k:"diff",l:"DIFF"}].map((h) => (
                    <th key={h.k} onClick={() => handleOppSort(h.k)} style={{
                      padding: "12px 10px", textAlign: h.k === "name" ? "left" : "center",
                      fontSize: 14, fontWeight: 500, letterSpacing: "1.5px",
                      color: oppSortKey === h.k ? C.gold : C.textDim,
                      fontFamily: "'DM Mono', monospace",
                      cursor: "pointer", userSelect: "none", transition: "color 0.2s",
                    }}>
                      {h.l}
                      {oppSortKey === h.k && (
                        <span style={{ marginLeft: 3, fontSize: 8 }}>{oppSortAsc ? "▲" : "▼"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opponentList.map((o) => (
                  <tr key={o.name}>
                    <td style={{ padding: "12px 10px", fontWeight: 600, color: C.text, fontFamily: "'Outfit', sans-serif", fontSize: 15 }}>{o.name}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: C.textMid, fontFamily: "'DM Mono', monospace" }}>{o.gp}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: "#4ade80", fontFamily: "'DM Mono', monospace" }}>{o.w}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: "#f87171", fontFamily: "'DM Mono', monospace" }}>{o.l}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: C.goldMuted, fontFamily: "'DM Mono', monospace" }}>{o.otl}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: C.goldBright, fontFamily: "'DM Mono', monospace" }}>{o.gf}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: C.textDim, fontFamily: "'DM Mono', monospace" }}>{o.ga}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 600, fontFamily: "'DM Mono', monospace",
                      color: o.diff > 0 ? "#4ade80" : o.diff < 0 ? "#f87171" : C.textDim,
                    }}>{o.diff >= 0 ? `+${o.diff}` : o.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recentGames.length > 0 && (
        <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 300ms both" }}>
          <h3 style={{
            fontSize: 14, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            marginBottom: 16, textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace",
          }}>
            Recent Results
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentGames.map((g, i) => (
              <div key={`${g.date}-${g.opponent}`} style={{
                display: "grid", gridTemplateColumns: "90px 40px 1fr 60px 40px",
                alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 6,
                background: C.surface, border: `1px solid ${C.border}`,
                animation: `fadeSlideUp 0.3s ease ${320 + i * 40}ms both`,
              }}>
                <span style={{
                  fontSize: 13, color: C.textDim, fontFamily: "'DM Mono', monospace",
                }}>{g.date.slice(5)}</span>
                <span style={{
                  fontSize: 11, color: C.textFaint, fontFamily: "'DM Mono', monospace",
                  textAlign: "center",
                }}>{g.home ? "HOME" : "AWAY"}</span>
                <span style={{
                  fontSize: 15, color: C.textMid, fontWeight: 500,
                  fontFamily: "'Outfit', sans-serif",
                }}>vs {g.opponent}</span>
                <span style={{
                  fontSize: 16, fontWeight: 700, textAlign: "center",
                  fontFamily: "'DM Mono', monospace", color: C.text,
                }}>{g.gf}–{g.ga}</span>
                <span style={{
                  fontSize: 14, fontWeight: 700, textAlign: "center",
                  fontFamily: "'DM Mono', monospace",
                  color: resultColor(g.result),
                }}>{g.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring Distribution */}
      <ScoringDonut data={skaterData} />
    </>
  );
}

// ── App ─────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  C = darkMode ? DARK : LIGHT;

  const [activeTab, setActiveTab] = useState("current");
  const [historySeason, setHistorySeason] = useState(null);
  const [statView, setStatView] = useState("skaters"); // "skaters" | "goalies" | "team"
  const [seasonData, setSeasonData] = useState({});
  const [goalieData, setGoalieData] = useState({});
  const [gamesData, setGamesData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const skaterFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/skaters.csv`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.text(); })
        .then((text) => ({ id: s.id, type: "skater", data: parseCSV(text) }))
        .catch(() => { setErrors((prev) => [...prev, s.id]); return { id: s.id, type: "skater", data: [] }; })
    );
    const goalieFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/goalies.csv`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.text(); })
        .then((text) => ({ id: s.id, type: "goalie", data: parseGoalieCSV(text) }))
        .catch(() => ({ id: s.id, type: "goalie", data: [] }))
    );
    const gamesFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/games.csv`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.text(); })
        .then((text) => ({ id: s.id, type: "games", data: parseGamesCSV(text) }))
        .catch(() => ({ id: s.id, type: "games", data: [] }))
    );
    Promise.all([...skaterFetches, ...goalieFetches, ...gamesFetches]).then((results) => {
      const skaterMap = {};
      const goalieMap = {};
      const gamesMap = {};
      results.forEach((r) => {
        if (r.type === "games") {
          if (r.data.length) gamesMap[r.id] = r.data;
        } else if (r.type === "goalie") {
          if (r.data.length) goalieMap[r.id] = r.data;
        } else {
          if (r.data.length) skaterMap[r.id] = r.data;
        }
      });
      setSeasonData(skaterMap);
      setGoalieData(goalieMap);
      setGamesData(gamesMap);
      setTimeout(() => setLoaded(true), 80);
    });
  }, []);

  const allTimeData = useMemo(() => aggregateAllTime(seasonData), [seasonData]);
  const allTimeGoalieData = useMemo(() => aggregateGoalieAllTime(goalieData), [goalieData]);
  const currentData = seasonData[SEASONS[0]?.id] || [];
  const currentGoalieData = goalieData[SEASONS[0]?.id] || [];
  const pastSeasons = SEASONS.slice(1);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== "history") setHistorySeason(null);
  };
  const handleHistorySelect = (seasonId) => {
    setActiveTab("history");
    setHistorySeason(seasonId);
  };

  const isGoalie = statView === "goalies";

  const activeData = isGoalie
    ? (activeTab === "current" ? currentGoalieData
      : activeTab === "alltime" ? allTimeGoalieData
      : activeTab === "history" && historySeason ? goalieData[historySeason] || []
      : [])
    : (activeTab === "current" ? currentData
      : activeTab === "alltime" ? allTimeData
      : activeTab === "history" && historySeason ? seasonData[historySeason] || []
      : []);

  const activeCols = isGoalie
    ? (activeTab === "alltime" ? GOALIE_ALLTIME_COLS : GOALIE_COLS)
    : (activeTab === "alltime" ? ALLTIME_COLS : BASE_COLS);

  const activeSkaterData = activeTab === "current" ? currentData
    : activeTab === "alltime" ? allTimeData
    : seasonData[historySeason] || [];
  const activeGoalieData = activeTab === "current" ? currentGoalieData
    : activeTab === "alltime" ? allTimeGoalieData
    : goalieData[historySeason] || [];
  const activeGames = activeTab === "alltime"
    ? Object.values(gamesData).flat()
    : activeTab === "current" ? (gamesData[SEASONS[0]?.id] || [])
    : (gamesData[historySeason] || []);

  const activeSubtitle = activeTab === "alltime"
    ? `${activeData.length} ${isGoalie ? "goalies" : "skaters"} · ${Object.values(isGoalie ? goalieData : seasonData).filter(d => d.length > 0).length} seasons`
    : `${activeData.length} ${isGoalie ? "goalies" : "skaters"} · ${activeData.length ? Math.max(...activeData.map((r) => r.gp)) : 0} games played`;

  if (!loaded) {
    return (
      <div style={{
        minHeight: "100vh", background: C.bg, color: C.textDim,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Outfit', sans-serif",
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lineGrow {
          from { width: 0; }
          to { width: 100%; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .vgk-tab:hover { color: ${C.textMid} !important; }
        @media (max-width: 600px) {
          .vgk-main { padding: 24px 16px 40px !important; }
          .vgk-logo { width: 48px !important; height: 54px !important; }
        }
      `}</style>

      {/* Grain texture */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.015,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
      }} />

      {/* Top gold line */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent 10%, ${C.gold} 40%, ${C.goldBright} 50%, ${C.gold} 60%, transparent 90%)`,
        opacity: loaded ? 0.7 : 0, transition: "opacity 1s ease",
      }} />

      <div className="vgk-main" style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 56px", position: "relative" }}>

        {/* Header with Logo */}
        <div style={{
          marginBottom: 32, animation: "fadeSlideUp 0.6s ease both",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <h1 style={{
              fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700,
              color: C.text, margin: 0,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "-0.5px", lineHeight: 1.1,
            }}>
              {CONFIG.teamName}
            </h1>
            <div style={{
              marginTop: 10, height: 1, width: 48,
              background: C.gold, opacity: 0.5,
              animation: "lineGrow 0.8s ease 0.3s both",
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: "8px 14px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.3s ease",
              }}
            >
              <span style={{ fontSize: 16 }}>{darkMode ? "☀️" : "🌙"}</span>
              <span style={{
                fontSize: 11, color: C.textDim, fontFamily: "'DM Mono', monospace",
                letterSpacing: "1px",
              }}>{darkMode ? "LIGHT" : "DARK"}</span>
            </button>
            <KnightLogo size={64} />
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: "flex", alignItems: "stretch", gap: 0,
          marginBottom: 32, borderBottom: `1px solid ${C.border}`,
          overflowX: "visible", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
          animation: "fadeSlideUp 0.5s ease 80ms both",
        }}>
          <button
            className="vgk-tab"
            onClick={() => handleTabClick("current")}
            style={{
              padding: "12px 20px", fontSize: 13, fontWeight: 500, letterSpacing: "1.5px",
              textTransform: "uppercase", fontFamily: "'Outfit', sans-serif",
              border: "none", cursor: "pointer", transition: "all 0.25s ease", whiteSpace: "nowrap",
              borderBottom: activeTab === "current" ? `2px solid ${C.gold}` : "2px solid transparent",
              background: activeTab === "current" ? `${C.gold}0F` : "transparent",
              color: activeTab === "current" ? C.text : C.textDim,
            }}
          >
            {SEASONS[0].label}
          </button>

          <button
            className="vgk-tab"
            onClick={() => handleTabClick("alltime")}
            style={{
              padding: "12px 20px", fontSize: 13, fontWeight: 500, letterSpacing: "1.5px",
              textTransform: "uppercase", fontFamily: "'Outfit', sans-serif",
              border: "none", cursor: "pointer", transition: "all 0.25s ease", whiteSpace: "nowrap",
              borderBottom: activeTab === "alltime" ? `2px solid ${C.gold}` : "2px solid transparent",
              background: activeTab === "alltime" ? `${C.gold}0F` : "transparent",
              color: activeTab === "alltime" ? C.text : C.textDim,
            }}
          >
            All Time
          </button>

          {pastSeasons.length > 0 && (
            <HistoryDropdown
              seasons={pastSeasons}
              activeId={historySeason}
              onSelect={handleHistorySelect}
            />
          )}
        </div>

        {/* Skaters / Goalies Toggle */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 28,
          animation: "fadeSlideUp 0.5s ease 120ms both",
        }}>
          {["skaters", "goalies", "team"].map((view) => (
            <button
              key={view}
              onClick={() => setStatView(view)}
              style={{
                padding: "8px 18px", fontSize: 12, fontWeight: 500,
                letterSpacing: "1.5px", textTransform: "uppercase",
                fontFamily: "'DM Mono', monospace",
                border: `1px solid ${statView === view ? C.gold : C.border}`,
                borderRadius: 4, cursor: "pointer",
                background: statView === view ? `${C.gold}15` : "transparent",
                color: statView === view ? C.gold : C.textDim,
                transition: "all 0.2s ease",
              }}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Content */}
        {statView === "team" ? (
          <TeamView skaterData={activeSkaterData} goalieData={activeGoalieData} games={activeGames} />
        ) : activeData.length > 0 ? (
          isGoalie
            ? <>
                <GoalieStatsView data={activeData} columns={activeCols} subtitle={activeSubtitle} />
                <SvPctGauge data={activeData} />
              </>
            : <>
                <StatsView data={activeData} columns={activeCols} seasonData={seasonData} />
                <MilestoneTracker allTimeData={allTimeData} />
                <PointsBreakdown data={activeData} />
              </>
        ) : (
          <div style={{
            textAlign: "center", padding: 60, color: C.textFaint,
            fontFamily: "'Outfit', sans-serif",
          }}>
            <p style={{ fontSize: 15 }}>No data available</p>
            <p style={{ fontSize: 13, marginTop: 8, color: C.textDim }}>
              Select a season from the History menu
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 52, paddingTop: 20,
          borderTop: `1px solid ${C.border}`,
          textAlign: "center",
        }}>
          <span style={{
            fontSize: 10, color: C.textFaint, letterSpacing: "3px",
            fontFamily: "'DM Mono', monospace", fontWeight: 400,
          }}>
            {CONFIG.teamName.toUpperCase()} · EST. {CONFIG.established}
          </span>
        </div>
      </div>
    </div>
  );
}
