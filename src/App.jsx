import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import { Analytics } from "@vercel/analytics/react";

// ── Config ──────────────────────────────────────────────
// Add each season file here. First entry = current season.
const SEASONS = [
  { id: "2025-26", label: "2025–26", dir: "/seasons/2025-26" },
  { id: "2024-25", label: "2024–25", dir: "/seasons/2024-25" },
  { id: "2023-24", label: "2023–24", dir: "/seasons/2023-24" },
];

const CONFIG = {
  teamName: "UBC Knights",
  established: "2023",
  totalGames: 24, // regular season games per team
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

// ── Filters ─────────────────────────────────────────────
const GOALIE_EXCLUDE = ["Stuart Coy"];

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
      w: parseInt(norm.w || 0) || 0,
      l: parseInt(norm.l || 0) || 0,
      so: parseInt(norm.so || 0) || 0,
    };
  }).filter((r) => !GOALIE_EXCLUDE.includes(r.player));
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
      if (!totals[key]) totals[key] = { player: key, gp: 0, sv: 0, ga: 0, sa: 0, min: 0, otl: 0, w: 0, l: 0, so: 0, seasons: 0 };
      totals[key].gp += r.gp;
      totals[key].sv += r.sv;
      totals[key].ga += r.ga;
      totals[key].sa += r.sa;
      totals[key].min += r.min;
      totals[key].otl += r.otl;
      totals[key].w += r.w;
      totals[key].l += r.l;
      totals[key].so += r.so;
      totals[key].seasons += 1;
    });
  });
  return Object.values(totals).map((t) => ({
    ...t,
    gaa: t.min > 0 ? Math.round((t.ga / t.min) * 60 * 100) / 100 : 0,
    svPct: t.sa > 0 ? Math.round((t.sv / t.sa) * 1000) / 1000 : 0,
  }));
}

// ── Recap-derived stats ────────────────────────────────
function computeGWG(recaps) {
  const gwgCounts = {};
  recaps.forEach((game) => {
    if (game.result !== "W") return;
    // GWG = the Knights goal that put them at (opponent final score + 1)
    const target = game.ga + 1;
    let knightsGoals = 0;
    for (const goal of game.goals) {
      if (goal.team === "Knights") {
        knightsGoals++;
        if (knightsGoals === target) {
          gwgCounts[goal.scorer] = (gwgCounts[goal.scorer] || 0) + 1;
          break;
        }
      }
    }
  });
  return gwgCounts;
}

function computeScoringCombos(recaps) {
  const combos = {};
  recaps.forEach((game) => {
    game.goals.forEach((goal) => {
      if (goal.team !== "Knights") return;
      goal.assists.forEach((assister) => {
        const key = `${goal.scorer} + ${assister}`;
        if (!combos[key]) combos[key] = { scorer: goal.scorer, assister, count: 0 };
        combos[key].count++;
      });
    });
  });
  return Object.values(combos).sort((a, b) => b.count - a.count);
}

const PENALTY_ABBREV = {
  "Interference": "INT", "Cross-Checking": "X-CHK", "Cross Checking": "X-CHK",
  "Hooking": "HOOK", "Tripping": "TRIP", "Slashing": "SLASH", "Roughing": "ROUGH",
  "Holding": "HOLD", "High-Sticking": "H-STK", "High Sticking": "H-STK",
  "Boarding": "BOARD", "Delay of Game": "DOG", "Too Many Men": "TMM",
  "Unsportsmanlike Conduct": "USC", "Elbowing": "ELBOW", "Charging": "CHRG",
  "Kneeing": "KNEE", "Misconduct": "MISC", "Fighting": "FIGHT",
  "Head Contact": "Head Cont.", "Too Many Players": "Too Many", "Too Many Men on the Ice": "Too Many",
};
function shortenPenalty(type) {
  return PENALTY_ABBREV[type] || type;
}

function computePenaltyLeaders(recaps) {
  const players = {};
  recaps.forEach((game) => {
    game.penalties.forEach((pen) => {
      if (pen.team !== "Knights") return;
      if (!players[pen.player]) players[pen.player] = { player: pen.player, count: 0, minutes: 0, types: {} };
      players[pen.player].count++;
      players[pen.player].minutes += pen.minutes;
      players[pen.player].types[pen.type] = (players[pen.player].types[pen.type] || 0) + 1;
    });
  });
  return Object.values(players).sort((a, b) => b.minutes - a.minutes);
}

function computeGoalsByPeriod(recaps) {
  const periods = {};
  recaps.forEach((game) => {
    game.goals.forEach((goal) => {
      if (goal.team !== "Knights") return;
      periods[goal.period] = (periods[goal.period] || 0) + 1;
    });
  });
  return periods;
}

function computeComebacks(recaps) {
  const comebacks = [];
  recaps.forEach((game) => {
    if (game.result !== "W") return;
    let knightsScore = 0, oppScore = 0;
    let maxDeficit = 0;
    game.goals.forEach((goal) => {
      if (goal.team === "Knights") knightsScore++;
      else oppScore++;
      if (oppScore > knightsScore) maxDeficit = Math.max(maxDeficit, oppScore - knightsScore);
    });
    if (maxDeficit > 0) {
      comebacks.push({ ...game, deficit: maxDeficit });
    }
  });
  return comebacks.sort((a, b) => b.deficit - a.deficit);
}

function computeSpecialTeams(recaps) {
  const periodLen = 1200; // 20-min periods for timeline spacing
  function toSec(period, time) {
    const p = period === "1st" ? 0 : period === "2nd" ? 1 : period === "3rd" ? 2 : 3;
    const parts = time.split(":").map(Number);
    return p * periodLen + (parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]);
  }

  let ppOpp = 0, ppGoals = 0, pkSit = 0, pkGA = 0;
  const playerPPP = {}; // per-player power play points

  recaps.forEach((game) => {
    const kPens = []; // expiry times of active Knights penalties (sorted ascending)
    const oPens = []; // expiry times of active opponent penalties (sorted ascending)
    const adv = () => oPens.length - kPens.length; // positive = Knights PP, negative = Knights PK

    const events = [];
    (game.penalties || []).forEach((pen) => {
      const t = toSec(pen.period, pen.time);
      const team = pen.team === "Knights" ? "k" : "o";
      const dur = (pen.minutes || 2) * 60;
      events.push({ time: t, kind: "pen", team, expiry: t + dur });
      events.push({ time: t + dur, kind: "pen_end", team, expiry: t + dur });
    });
    (game.goals || []).forEach((goal) => {
      events.push({ time: toSec(goal.period, goal.time), kind: "goal", team: goal.team === "Knights" ? "k" : "o", scorer: goal.scorer, assists: goal.assists || [] });
    });

    // pen_end processes before other events at same time
    events.sort((a, b) => a.time - b.time || (a.kind === "pen_end" ? -1 : 1));

    events.forEach((ev) => {
      const advBefore = adv();

      if (ev.kind === "pen") {
        if (ev.team === "k") { kPens.push(ev.expiry); kPens.sort((a, b) => a - b); }
        else { oPens.push(ev.expiry); oPens.sort((a, b) => a - b); }
      } else if (ev.kind === "pen_end") {
        const arr = ev.team === "k" ? kPens : oPens;
        const idx = arr.indexOf(ev.expiry);
        if (idx !== -1) arr.splice(idx, 1);
      } else if (ev.kind === "goal") {
        const a = adv();
        if (ev.team === "k" && a > 0) {
          ppGoals++;
          playerPPP[ev.scorer] = (playerPPP[ev.scorer] || 0) + 1;
          ev.assists.forEach((ast) => { playerPPP[ast] = (playerPPP[ast] || 0) + 1; });
          oPens.shift(); // PP goal ends earliest opponent penalty
        } else if (ev.team === "o" && a < 0) {
          pkGA++;
          kPens.shift(); // PK goal against ends earliest Knights penalty
        }
      }

      const advAfter = adv();
      // Detect new PP/PK situations (including 5-on-3 extensions)
      if (advAfter > 0 && advBefore <= 0) ppOpp++;
      if (advAfter > advBefore && advBefore > 0) ppOpp++;
      if (advAfter < 0 && advBefore >= 0) pkSit++;
      if (advAfter < advBefore && advBefore < 0) pkSit++;
    });
  });

  return {
    ppGoals, ppOpp,
    ppPct: ppOpp > 0 ? (ppGoals / ppOpp * 100) : 0,
    pkGA, pkSit,
    pkPct: pkSit > 0 ? ((1 - pkGA / pkSit) * 100) : 0,
    playerPPP,
  };
}

// ── Columns ─────────────────────────────────────────────
const BASE_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "gp", label: "GP" },
  { key: "g", label: "G" },
  { key: "a", label: "A" },
  { key: "p", label: "PTS" },
  { key: "ppp", label: "PPP" },
  { key: "ppg", label: "P/GP", format: (v) => v.toFixed(2) },
  { key: "gwg", label: "GWG" },
  { key: "pm", label: "PIM" },
];

const ALLTIME_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "seasons", label: "SZN" },
  { key: "gp", label: "GP" },
  { key: "g", label: "G" },
  { key: "a", label: "A" },
  { key: "p", label: "PTS" },
  { key: "ppp", label: "PPP" },
  { key: "ppg", label: "P/GP", format: (v) => v.toFixed(2) },
  { key: "gwg", label: "GWG" },
  { key: "pm", label: "PIM" },
];

const GOALIE_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "gp", label: "GP" },
  { key: "w", label: "W" },
  { key: "l", label: "L" },
  { key: "otl", label: "OTL" },
  { key: "so", label: "SO" },
  { key: "gaa", label: "GAA", format: (v) => v.toFixed(2) },
  { key: "svPct", label: "SV%", format: (v) => v.toFixed(3) },
  { key: "sv", label: "SV" },
  { key: "ga", label: "GA" },
  { key: "sa", label: "SA" },
  { key: "min", label: "MIN" },
];

const GOALIE_ALLTIME_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "seasons", label: "SZN" },
  { key: "gp", label: "GP" },
  { key: "w", label: "W" },
  { key: "l", label: "L" },
  { key: "otl", label: "OTL" },
  { key: "so", label: "SO" },
  { key: "gaa", label: "GAA", format: (v) => v.toFixed(2) },
  { key: "svPct", label: "SV%", format: (v) => v.toFixed(3) },
  { key: "sv", label: "SV" },
  { key: "ga", label: "GA" },
  { key: "sa", label: "SA" },
  { key: "min", label: "MIN" },
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
          padding: "12px 20px", fontSize: 15, fontWeight: 500, letterSpacing: "1.5px",
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
          borderRadius: 6, overflow: "hidden", minWidth: 160, zIndex: 200,
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

// ── Cumulative Points Chart ────────────────────────────
function CumulativePointsChart({ recaps }) {
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null); // { player, gameIdx, x, y, val }

  if (!recaps.length) return null;

  const sorted = [...recaps].sort((a, b) => a.date.localeCompare(b.date));

  // Build per-player cumulative points by game
  const playerPoints = {};
  sorted.forEach((game) => {
    game.goals.forEach((goal) => {
      if (goal.team !== "Knights") return;
      playerPoints[goal.scorer] = (playerPoints[goal.scorer] || 0) + 1;
      goal.assists.forEach((a) => {
        playerPoints[a] = (playerPoints[a] || 0);
      });
    });
    game.goals.forEach((goal) => {
      if (goal.team !== "Knights") return;
      goal.assists.forEach((a) => {
        playerPoints[a] = (playerPoints[a] || 0) + 1;
      });
    });
  });

  // Rebuild as time series: for each game, track cumulative for each player
  const topPlayers = Object.entries(playerPoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  if (!topPlayers.length) return null;

  const series = {};
  topPlayers.forEach((p) => { series[p] = []; });
  const cumulative = {};
  topPlayers.forEach((p) => { cumulative[p] = 0; });

  sorted.forEach((game, gi) => {
    // Count points per player in this game
    const gamePoints = {};
    game.goals.forEach((goal) => {
      if (goal.team !== "Knights") return;
      if (topPlayers.includes(goal.scorer)) {
        gamePoints[goal.scorer] = (gamePoints[goal.scorer] || 0) + 1;
      }
      goal.assists.forEach((a) => {
        if (topPlayers.includes(a)) {
          gamePoints[a] = (gamePoints[a] || 0) + 1;
        }
      });
    });
    topPlayers.forEach((p) => {
      cumulative[p] += (gamePoints[p] || 0);
      series[p].push(cumulative[p]);
    });
  });

  const totalGames = sorted.length;
  const maxPoints = Math.max(...topPlayers.map((p) => cumulative[p]), 1);

  const w = 820, h = 300, padL = 40, padR = 140, padT = 20, padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Spread colors more distinctly
  const lineColors = ["#c9a84c", "#e8c96e", "#8a7a52", "#a08838", "#d4b45e", "#5c5238"];

  // Avoid label overlap: sort end positions and nudge if too close
  const endPositions = topPlayers.map((player, pi) => ({
    player, pi, val: cumulative[player],
    y: padT + chartH * (1 - cumulative[player] / maxPoints),
  })).sort((a, b) => a.y - b.y);
  const minGap = 18;
  for (let i = 1; i < endPositions.length; i++) {
    if (endPositions[i].y - endPositions[i - 1].y < minGap) {
      endPositions[i].y = endPositions[i - 1].y + minGap;
    }
  }
  const labelYMap = {};
  endPositions.forEach((e) => { labelYMap[e.player] = e.y; });

  return (
    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
      <h3 style={{
        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
        marginBottom: 16, textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
      }}>Points Race <span style={{ fontSize: 13, color: C.textFaint, fontWeight: 400 }}>(Top 5 Scorers)</span></h3>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "20px 12px",
      }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ display: "block", margin: "0 auto", width: "100%", height: "auto" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padT + chartH * (1 - pct);
            const val = Math.round(maxPoints * pct);
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={C.border} strokeWidth="1" />
                <text x={padL - 8} y={y + 5} textAnchor="end" fill={C.textFaint}
                  fontSize="13" fontFamily="DM Mono, monospace">{val}</text>
              </g>
            );
          })}
          {/* Lines + dots + labels */}
          {topPlayers.map((player, pi) => {
            const points = series[player];
            const color = lineColors[pi % lineColors.length];
            const isHovered = hoveredPlayer === player;
            const isDimmed = hoveredPlayer !== null && !isHovered;
            const d = points.map((val, i) => {
              const x = padL + (i / (totalGames - 1 || 1)) * chartW;
              const y = padT + chartH * (1 - val / maxPoints);
              return `${i === 0 ? "M" : "L"}${x},${y}`;
            }).join(" ");
            const finalVal = cumulative[player];
            const endX = padL + chartW;
            const endY = padT + chartH * (1 - finalVal / maxPoints);
            const labelY = labelYMap[player];
            return (
              <g key={player} style={{ transition: "opacity 0.2s" }}
                opacity={isDimmed ? 0.15 : 1}>
                {/* Invisible wide hit area for hover */}
                <path d={d} fill="none" stroke="transparent"
                  strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredPlayer(player)}
                  onMouseLeave={() => setHoveredPlayer(null)} />
                <path d={d} fill="none" stroke={color}
                  strokeWidth={isHovered ? "4" : "3"} strokeLinecap="round" strokeLinejoin="round"
                  style={{ pointerEvents: "none" }} />
                {/* Endpoint dot */}
                <circle cx={endX} cy={endY} r={isHovered ? 7 : 5} fill={color} stroke={C.surface} strokeWidth="2"
                  style={{ pointerEvents: "none" }} />
                {/* Connector line to label if nudged */}
                <line x1={endX + 6} y1={endY} x2={endX + 12} y2={labelY} stroke={color} strokeWidth="1" opacity="0.4"
                  style={{ pointerEvents: "none" }} />
                {/* Label */}
                <text x={endX + 14} y={labelY + 5} fill={color}
                  fontSize={isHovered ? "15" : "14"} fontFamily="Outfit, sans-serif" fontWeight="600"
                  style={{ pointerEvents: "none" }}>
                  {player.split(" ")[1] || player} {finalVal}
                </text>
                {/* Show dots on data points when hovered */}
                {isHovered && points.map((val, i) => {
                  const x = padL + (i / (totalGames - 1 || 1)) * chartW;
                  const y = padT + chartH * (1 - val / maxPoints);
                  const prevVal = i > 0 ? points[i - 1] : 0;
                  const gameGain = val - prevVal;
                  return (
                    <circle key={i} cx={x} cy={y} r={hoveredPoint && hoveredPoint.gameIdx === i && hoveredPoint.player === player ? 6 : 3.5}
                      fill={color} stroke={C.surface} strokeWidth="1.5"
                      style={{ cursor: "pointer", transition: "r 0.15s" }}
                      onMouseEnter={() => { setHoveredPlayer(player); setHoveredPoint({ player, gameIdx: i, x, y, val, gameGain, opponent: sorted[i]?.opponent || "" }); }}
                      onMouseLeave={() => setHoveredPoint(null)} />
                  );
                })}
              </g>
            );
          })}
          {/* X axis */}
          {Array.from({ length: totalGames }, (_, i) => i + 1)
            .filter((g) => g === 1 || g === totalGames || g % 5 === 0)
            .map((g) => {
              const x = padL + ((g - 1) / (totalGames - 1 || 1)) * chartW;
              return (
                <text key={g} x={x} y={h - 6} fill={C.textFaint} fontSize="13"
                  fontFamily="DM Mono, monospace" textAnchor="middle">G{g}</text>
              );
            })}
          {/* Tooltip */}
          {hoveredPoint && (() => {
            const tt = hoveredPoint;
            const tooltipW = 150, tooltipH = 58;
            let tx = tt.x + 12;
            let ty = tt.y - tooltipH - 8;
            if (tx + tooltipW > w - padR) tx = tt.x - tooltipW - 12;
            if (ty < 0) ty = tt.y + 12;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx="6"
                  fill={C.bg} stroke={C.border} strokeWidth="1" opacity="0.95" />
                <text x={tx + 10} y={ty + 18} fill={C.text} fontSize="13" fontFamily="Outfit, sans-serif" fontWeight="600">
                  {tt.player}
                </text>
                <text x={tx + 10} y={ty + 35} fill={C.textDim} fontSize="12" fontFamily="DM Mono, monospace">
                  Game {tt.gameIdx + 1}{tt.opponent ? ` vs ${tt.opponent}` : ""}
                </text>
                <text x={tx + 10} y={ty + 50} fill={C.gold} fontSize="12" fontFamily="DM Mono, monospace">
                  {tt.val} pts total{tt.gameGain > 0 ? ` (+${tt.gameGain})` : ""}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
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

  // Radar chart config
  const radarAxes = [
    { key: "g", label: "G" },
    { key: "a", label: "A" },
    { key: "ppg", label: "P/GP" },
    { key: "ppp", label: "PPP" },
    { key: "gwg", label: "GWG" },
    { key: "pm", label: "PIM" },
  ];
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

// ── Scoring Distribution (Donut Chart) ─────────────────
function ScoringDonut({ data }) {
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

// ── Milestone Tracker ──────────────────────────────────
// ── Records View ──────────────────────────────────────
function RecordsView({ seasonData, goalieData, gamesData, recapsData, allTimeData }) {
  const records = useMemo(() => {
    const result = { season: [], game: [], team: [], alltime: [] };

    // ── Single-Season Records ──
    const playerSeasons = [];
    Object.entries(seasonData).forEach(([sid, rows]) => {
      rows.forEach((r) => playerSeasons.push({ ...r, season: sid }));
    });

    const best = (label, key, fmt) => {
      const sorted = [...playerSeasons].filter((r) => r.gp > 0).sort((a, b) => b[key] - a[key]);
      if (sorted.length) {
        const r = sorted[0];
        result.season.push({ label, player: r.player, value: fmt ? fmt(r[key]) : r[key], season: r.season });
      }
    };
    best("Most Goals", "g");
    best("Most Assists", "a");
    best("Most Points", "p");
    best("Most PIM", "pm");

    // Goalie single-season records (min 8 GP)
    const goalieSeasons = [];
    Object.entries(goalieData).forEach(([sid, rows]) => {
      rows.forEach((r) => goalieSeasons.push({ ...r, season: sid }));
    });
    const eligibleGoalies = goalieSeasons.filter((r) => r.gp >= 8);
    if (eligibleGoalies.length) {
      const bestGAA = [...eligibleGoalies].sort((a, b) => a.gaa - b.gaa)[0];
      result.season.push({ label: "Best GAA", player: bestGAA.player, value: bestGAA.gaa.toFixed(2), season: bestGAA.season });
      const bestSV = [...eligibleGoalies].sort((a, b) => b.svPct - a.svPct)[0];
      result.season.push({ label: "Best SV%", player: bestSV.player, value: bestSV.svPct.toFixed(3), season: bestSV.season });
    }

    // ── Single-Game Records ──
    const allRecaps = Object.values(recapsData).flat();
    let bestGameGoals = { player: "", count: 0, game: null };
    let bestGameAssists = { player: "", count: 0, game: null };
    let bestGamePoints = { player: "", count: 0, game: null };
    let bestGamePIM = { player: "", count: 0, game: null };
    allRecaps.forEach((game) => {
      const gameGoals = {};
      const gameAssists = {};
      const gamePoints = {};
      (game.goals || []).forEach((goal) => {
        if (goal.team !== "Knights") return;
        gameGoals[goal.scorer] = (gameGoals[goal.scorer] || 0) + 1;
        gamePoints[goal.scorer] = (gamePoints[goal.scorer] || 0) + 1;
        (goal.assists || []).forEach((a) => {
          gameAssists[a] = (gameAssists[a] || 0) + 1;
          gamePoints[a] = (gamePoints[a] || 0) + 1;
        });
      });
      const gamePIM = {};
      (game.penalties || []).forEach((pen) => {
        if (pen.team !== "Knights") return;
        gamePIM[pen.player] = (gamePIM[pen.player] || 0) + (pen.minutes || 2);
      });
      Object.entries(gameGoals).forEach(([player, count]) => {
        if (count > bestGameGoals.count) bestGameGoals = { player, count, game };
      });
      Object.entries(gameAssists).forEach(([player, count]) => {
        if (count > bestGameAssists.count) bestGameAssists = { player, count, game };
      });
      Object.entries(gamePoints).forEach(([player, count]) => {
        if (count > bestGamePoints.count) bestGamePoints = { player, count, game };
      });
      Object.entries(gamePIM).forEach(([player, count]) => {
        if (count > bestGamePIM.count) bestGamePIM = { player, count, game };
      });
    });
    if (bestGameGoals.count > 0) {
      result.game.push({ label: "Most Goals", player: bestGameGoals.player, value: bestGameGoals.count, detail: `vs ${bestGameGoals.game.opponent} (${bestGameGoals.game.date})` });
    }
    if (bestGameAssists.count > 0) {
      result.game.push({ label: "Most Assists", player: bestGameAssists.player, value: bestGameAssists.count, detail: `vs ${bestGameAssists.game.opponent} (${bestGameAssists.game.date})` });
    }
    if (bestGamePoints.count > 0) {
      result.game.push({ label: "Most Points", player: bestGamePoints.player, value: bestGamePoints.count, detail: `vs ${bestGamePoints.game.opponent} (${bestGamePoints.game.date})` });
    }
    if (bestGamePIM.count > 0) {
      result.game.push({ label: "Most PIM", player: bestGamePIM.player, value: bestGamePIM.count, detail: `vs ${bestGamePIM.game.opponent} (${bestGamePIM.game.date})` });
    }

    // ── Team Season Records ──
    Object.entries(gamesData).forEach(([sid, games]) => {
      if (!games.length) return;
      const wins = games.filter((g) => g.result === "W").length;
      const gf = games.reduce((s, g) => s + g.gf, 0);
      const ga = games.reduce((s, g) => s + g.ga, 0);

      let longestStreak = 0, cur = 0;
      [...games].sort((a, b) => a.date.localeCompare(b.date)).forEach((g) => {
        if (g.result === "W") { cur++; longestStreak = Math.max(longestStreak, cur); }
        else cur = 0;
      });

      result.team.push({ label: "Most Wins", value: wins, season: sid, sortKey: wins });
      result.team.push({ label: "Most Goals For", value: gf, season: sid, sortKey: gf });
      result.team.push({ label: "Fewest Goals Against", value: ga, season: sid, sortKey: -ga });
      result.team.push({ label: "Best Win Streak", value: `${longestStreak}W`, season: sid, sortKey: longestStreak });
    });

    // Biggest win & biggest comeback across all recaps
    let biggestWin = null;
    allRecaps.forEach((game) => {
      if (game.result !== "W") return;
      const margin = game.gf - game.ga;
      if (!biggestWin || margin > biggestWin.margin) biggestWin = { ...game, margin };
    });
    if (biggestWin) {
      result.team.push({ label: "Biggest Win", value: `${biggestWin.gf}-${biggestWin.ga}`, detail: `vs ${biggestWin.opponent} (${biggestWin.date})`, sortKey: biggestWin.margin });
    }

    const comebacks = computeComebacks(allRecaps);
    if (comebacks.length) {
      const c = comebacks[0];
      result.team.push({ label: "Biggest Comeback", value: `Down ${c.deficit}`, detail: `${c.gf}-${c.ga} vs ${c.opponent}`, sortKey: c.deficit });
    }

    // Deduplicate team records: keep best per label
    const teamBest = {};
    result.team.forEach((r) => {
      if (!teamBest[r.label] || r.sortKey > teamBest[r.label].sortKey) teamBest[r.label] = r;
    });
    result.team = ["Most Wins", "Most Goals For", "Fewest Goals Against", "Best Win Streak", "Biggest Win", "Biggest Comeback"]
      .map((l) => teamBest[l]).filter(Boolean);

    // ── All-Time Career Leaders ──
    const sorted = [...allTimeData].filter((r) => r.gp > 0);
    const goalLeader = [...sorted].sort((a, b) => b.g - a.g)[0];
    const assistLeader = [...sorted].sort((a, b) => b.a - a.a)[0];
    const pointLeader = [...sorted].sort((a, b) => b.p - a.p)[0];
    if (goalLeader) result.alltime.push({ label: "Goals Leader", player: goalLeader.player, value: goalLeader.g, detail: `${goalLeader.seasons} season${goalLeader.seasons > 1 ? "s" : ""}` });
    if (assistLeader) result.alltime.push({ label: "Assists Leader", player: assistLeader.player, value: assistLeader.a, detail: `${assistLeader.seasons} season${assistLeader.seasons > 1 ? "s" : ""}` });
    if (pointLeader) result.alltime.push({ label: "Points Leader", player: pointLeader.player, value: pointLeader.p, detail: `${pointLeader.seasons} season${pointLeader.seasons > 1 ? "s" : ""}` });

    return result;
  }, [seasonData, goalieData, gamesData, recapsData, allTimeData]);

  const sectionStyle = {
    marginBottom: 36,
    animation: "fadeSlideUp 0.5s ease 100ms both",
  };

  const sectionTitle = (text, delay) => (
    <h3 style={{
      fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
      marginBottom: 16, textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
      animation: `fadeSlideUp 0.4s ease ${delay}ms both`,
    }}>{text}</h3>
  );

  const RecordCard = ({ record, index, showPlayer = true }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 16px", borderRadius: 8,
      background: C.surface, border: `1px solid ${C.border}`,
      animation: `fadeSlideUp 0.3s ease ${80 + index * 40}ms both`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.textFaint, fontFamily: "'DM Mono', monospace", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>
          {record.label}
        </div>
        {showPlayer && record.player && (
          <div style={{ fontSize: 16, color: C.text, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>
            {record.player}
          </div>
        )}
        {(record.season || record.detail) && (
          <div style={{ fontSize: showPlayer ? 12 : 15, color: showPlayer ? C.textFaint : C.text, fontFamily: showPlayer ? "'DM Mono', monospace" : "'Outfit', sans-serif", fontWeight: showPlayer ? 400 : 600, marginTop: 2 }}>
            {record.season && SEASONS.find((s) => s.id === record.season)?.label}{record.season && record.detail ? " · " : ""}{record.detail || ""}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: C.gold,
        fontFamily: "'Outfit', sans-serif", marginLeft: 16, whiteSpace: "nowrap", flexShrink: 0,
      }}>
        {record.value}
      </div>
    </div>
  );

  return (
    <div>
      {sectionTitle("All-Time Leaders", 60)}
      <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: 8 }}>
        {records.alltime.map((r, i) => <RecordCard key={r.label} record={r} index={i} />)}
      </div>

      {sectionTitle("Season Records", 200)}
      <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: 8 }}>
        {records.season.map((r, i) => <RecordCard key={r.label} record={r} index={i} />)}
      </div>

      {sectionTitle("Game Records", 340)}
      <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: 8 }}>
        {records.game.map((r, i) => <RecordCard key={r.label} record={r} index={i} />)}
      </div>

      {sectionTitle("Team Records", 480)}
      <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: 8 }}>
        {records.team.map((r, i) => <RecordCard key={r.label} record={r} index={i} showPlayer={false} />)}
      </div>
    </div>
  );
}

function MilestoneTracker({ allTimeData }) {
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

// ── SV% Gauge ──────────────────────────────────────────
function SvPctGauge({ data }) {
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

// ── GoalieStatsView ────────────────────────────────────
function GoalieStatsView({ data, columns }) {
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

// ── Pace Projections ───────────────────────────────────
function PaceProjections({ data }) {
  if (!data.length) return null;

  const totalGames = CONFIG.totalGames;
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

// ── TeamView ───────────────────────────────────────────
function TeamView({ goalieData, games, recaps, isAllTime, playoffMode }) {
  const [oppSortKey, setOppSortKey] = useState("gp");
  const [oppSortAsc, setOppSortAsc] = useState(false);
  const [expandedGame, setExpandedGame] = useState(null);
  const handleOppSort = (key) => {
    if (oppSortKey === key) setOppSortAsc(!oppSortAsc);
    else { setOppSortKey(key); setOppSortAsc(false); }
  };
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

  // Longest winning streak
  let longestWinStreak = 0, currentStreak = 0;
  [...games].sort((a, b) => a.date.localeCompare(b.date)).forEach((g) => {
    if (g.result === "W") { currentStreak++; longestWinStreak = Math.max(longestWinStreak, currentStreak); }
    else currentStreak = 0;
  });

  const st = recaps.length > 0 ? computeSpecialTeams(recaps) : null;

  const allWidgets = [
    { label: "RECORD", value: `${wins}-${losses}-${otl}` },
    { label: "DIFF", value: gf - ga >= 0 ? `+${gf - ga}` : `${gf - ga}` },
    { label: "GOALS FOR", value: gf },
    { label: "GOALS AGAINST", value: ga },
    ...(games.length > 0 ? [{ label: "BEST STREAK", value: `${longestWinStreak}W` }] : []),
    ...(topGoalie ? [{ label: "TEAM SV%", value: topGoalie.svPct.toFixed(3) }] : []),
    ...(st && st.ppOpp > 0 ? [{ label: "PP%", value: `${st.ppPct.toFixed(1)}%` }] : []),
    ...(st && st.pkSit > 0 ? [{ label: "PK%", value: `${st.pkPct.toFixed(1)}%` }] : []),
  ];

  const renderWidgetRow = (widgets, delay = 0) => (
    <div className="vgk-widget-row" style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 10, marginBottom: 20,
      animation: `fadeSlideUp 0.4s ease ${delay}ms both`,
    }}>
      {widgets.map((w) => (
        <div key={w.label} className="vgk-widget-card" style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: "16px 14px", textAlign: "center",
        }}>
          <div className="vgk-widget-value" style={{
            fontSize: 26, fontWeight: 700, color: C.gold,
            fontFamily: "'Outfit', sans-serif", whiteSpace: "nowrap",
          }}>{w.value}</div>
          <div className="vgk-widget-label" style={{
            fontSize: 13, color: C.textDim, letterSpacing: "2px",
            fontFamily: "'DM Mono', monospace", marginTop: 5,
          }}>{w.label}</div>
        </div>
      ))}
    </div>
  );

  const recentGames = [...games].reverse();

  const resultColor = (r) => r === "W" ? "#4ade80" : r === "OTL" ? C.goldMuted : "#f87171";

  return (
    <>
      {allWidgets.length > 0 && renderWidgetRow(allWidgets, 60)}

      {/* Current Form — hidden in playoff mode */}
      {!isAllTime && !playoffMode && last5.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 32,
          animation: "fadeSlideUp 0.4s ease 160ms both",
        }}>
          <span style={{
            fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
          }}>FORM</span>
          <div style={{ display: "flex", gap: 6 }}>
            {last5.map((g, i) => (
              <div key={`${g.date}-${i}`} style={{
                minWidth: 36, height: 36, borderRadius: 6, display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "0 6px",
                fontSize: g.result === "OTL" ? 11 : 14, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                background: g.result === "W" ? "rgba(74,222,128,0.12)" : g.result === "OTL" ? "rgba(201,168,76,0.12)" : "rgba(248,113,113,0.12)",
                color: resultColor(g.result),
                border: `1px solid ${g.result === "W" ? "rgba(74,222,128,0.25)" : g.result === "OTL" ? "rgba(201,168,76,0.25)" : "rgba(248,113,113,0.25)"}`,
              }}>{g.result}</div>
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


      {/* Goals by Period */}
      {!isAllTime && recaps.length > 0 && (() => {
        const byPeriod = computeGoalsByPeriod(recaps);
        const entries = Object.entries(byPeriod)
          .filter(([name]) => !name.toLowerCase().includes("ot"))
          .sort((a, b) => {
            const order = { "1st": 1, "2nd": 2, "3rd": 3 };
            return (order[a[0]] || 9) - (order[b[0]] || 9);
          });
        const totalGoals = entries.reduce((s, [, v]) => s + v, 0);
        const maxGoals = Math.max(...entries.map(([, v]) => v), 1);
        return (
          <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 200ms both" }}>
            <h3 style={{
              fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
              marginBottom: 16, textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
            }}>Goals by Period</h3>
            <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
              {entries.map(([period, count]) => (
                <div key={period} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: C.gold, fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
                    {count} <span style={{ fontSize: 14, color: C.textDim }}>({Math.round((count / totalGoals) * 100)}%)</span>
                  </span>
                  <div style={{ height: 100, display: "flex", alignItems: "flex-end", width: "100%", justifyContent: "center" }}>
                    <div style={{
                      width: "100%", maxWidth: 70, borderRadius: 4,
                      height: `${(count / maxGoals) * 100}px`, minHeight: 4,
                      background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})`,
                    }} />
                  </div>
                  <span style={{ fontSize: 16, color: C.textMid, fontWeight: 500, fontFamily: "'DM Mono', monospace", marginTop: 8 }}>{period}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Season Timeline */}
      {!isAllTime && games.length > 0 && (
        <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 250ms both" }}>
          <h3 style={{
            fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            marginBottom: 16, textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace",
          }}>{playoffMode ? "Road to the Cup" : "Season Timeline"}</h3>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "20px 16px",
          }}>
            {/* Month labels + dots */}
            {(() => {
              const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
              // Group by month
              const months = {};
              sorted.forEach((g) => {
                const month = g.date.slice(0, 7); // "2025-10"
                if (!months[month]) months[month] = [];
                months[month].push(g);
              });
              const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                    {Object.entries(months).map(([month, monthGames]) => (
                      <div key={month} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 8 }}>
                        <span style={{
                          fontSize: 14, color: C.textDim, fontFamily: "'DM Mono', monospace",
                          marginRight: 6, minWidth: 32, fontWeight: 500,
                        }}>{monthNames[parseInt(month.slice(5))]}</span>
                        {monthGames.map((g, i) => (
                          <div
                            key={`${g.date}-${i}`}
                            title={`${g.date.slice(5)} vs ${g.opponent}: ${g.gf}-${g.ga} (${g.result})`}
                            style={{
                              width: 14, height: 14, borderRadius: 3,
                              background: g.result === "W" ? "#4ade80" : g.result === "OTL" ? C.gold : "#f87171",
                              opacity: 0.85,
                              cursor: "default",
                              transition: "transform 0.15s, opacity 0.15s",
                            }}
                            onMouseEnter={(e) => { e.target.style.transform = "scale(1.4)"; e.target.style.opacity = "1"; }}
                            onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; e.target.style.opacity = "0.85"; }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                    {[{ label: "WIN", color: "#4ade80" }, { label: "LOSS", color: "#f87171" }, { label: "OTL", color: C.gold }].map((l) => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, opacity: 0.85 }} />
                        <span style={{ fontSize: 13, color: C.textDim, fontFamily: "'DM Mono', monospace", letterSpacing: "1px" }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Opponent Breakdown — hidden in playoff mode */}
      {!playoffMode && opponentList.length > 0 && (
        <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 250ms both" }}>
          <h3 style={{
            fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            marginBottom: 12, textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace",
          }}>vs Opponents</h3>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflowX: "auto",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, minWidth: 520 }}>
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

      {/* Comeback Wins */}
      {!isAllTime && recaps.length > 0 && (() => {
        const comebacks = computeComebacks(recaps);
        if (!comebacks.length) return null;
        return (
          <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 320ms both" }}>
            <h3 style={{
              fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
              marginBottom: 16, textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
            }}>Comeback Wins</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {comebacks.map((g) => (
                <div key={`${g.date}-${g.opponent}`} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 6,
                  background: C.surface, border: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 13, color: C.textDim, fontFamily: "'DM Mono', monospace" }}>{g.date.slice(5)}</span>
                  <span style={{ fontSize: 15, color: C.textMid, fontWeight: 500, fontFamily: "'Outfit', sans-serif", flex: 1 }}>
                    vs {g.opponent}
                  </span>
                  <span style={{ fontSize: 14, color: "#4ade80", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
                    {g.gf}–{g.ga}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace",
                    padding: "3px 8px", borderRadius: 4,
                    background: "rgba(74,222,128,0.12)", color: "#4ade80",
                  }}>
                    Down {g.deficit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Game Results */}
      {!isAllTime && recentGames.length > 0 && (
        <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.5s ease 350ms both" }}>
          <h3 style={{
            fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
            marginBottom: 16, textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace",
          }}>
            Game Results
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentGames.map((g, i) => {
              const gameKey = `${g.date}-${g.opponent}`;
              const isExpanded = expandedGame === gameKey;
              const recap = recaps.find((r) => r.date === g.date && r.opponent === g.opponent);
              return (
                <div key={gameKey}>
                  <div
                    onClick={() => setExpandedGame(isExpanded ? null : gameKey)}
                    style={{
                      display: "grid", gridTemplateColumns: "70px 40px 1fr 50px 36px",
                      alignItems: "center", gap: 8,
                      padding: "10px 14px", borderRadius: isExpanded ? "6px 6px 0 0" : 6,
                      background: C.surface, border: `1px solid ${C.border}`,
                      cursor: recap ? "pointer" : "default",
                      animation: `fadeSlideUp 0.3s ease ${320 + i * 40}ms both`,
                    }}
                  >
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
                    }}>
                      vs {g.opponent}
                      {recap && <span style={{ fontSize: 10, color: C.textFaint, marginLeft: 6 }}>{isExpanded ? "▾" : "▸"}</span>}
                    </span>
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
                  {isExpanded && recap && (
                    <div style={{
                      background: `${C.bg}ee`, border: `1px solid ${C.border}`, borderTop: "none",
                      borderRadius: "0 0 6px 6px", padding: "16px 20px",
                      animation: "fadeSlideUp 0.2s ease both",
                    }}>
                      {/* Period Summary */}
                      {recap.periods && recap.periods.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {recap.periods.map((p) => (
                              <div key={p.name} style={{
                                background: C.surface, border: `1px solid ${C.border}`,
                                borderRadius: 4, padding: "8px 12px", textAlign: "center",
                              }}>
                                <div style={{ fontSize: 11, color: C.textFaint, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{p.name}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.text }}>{p.goalsHome}–{p.goalsAway}</div>
                                <div style={{ fontSize: 10, color: C.textFaint, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>SOG {p.shotsHome}–{p.shotsAway}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Goals */}
                      {recap.goals && recap.goals.length > 0 && (
                        <div style={{ marginBottom: recap.penalties?.length ? 16 : 0 }}>
                          <div style={{
                            fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace",
                            letterSpacing: "2px", marginBottom: 8, textTransform: "uppercase",
                          }}>Goals</div>
                          {recap.goals.map((goal, gi) => {
                            const isKnights = goal.team === "Knights";
                            return (
                              <div key={gi} className="vgk-recap-row" style={{
                                display: "flex", alignItems: "baseline", gap: 8,
                                padding: "4px 0",
                                borderLeft: `3px solid ${isKnights ? C.gold : C.textFaint}`,
                                paddingLeft: 16, marginBottom: 4,
                              }}>
                                <span style={{ fontSize: 12, color: C.textFaint, fontFamily: "'DM Mono', monospace", minWidth: 32 }}>{goal.period}</span>
                                <span style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace", minWidth: 50 }}>{goal.time.replace(/^00:/, "")}</span>
                                <span style={{ display: "inline-flex", flexDirection: "column" }}>
                                  <span className="vgk-recap-name" style={{ fontSize: 14, color: isKnights ? C.gold : C.textMid, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>{goal.scorer}</span>
                                  {goal.assists.length > 0 && (
                                    <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                                      {goal.assists.join(", ")}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Penalties */}
                      {recap.penalties && recap.penalties.length > 0 && (
                        <div>
                          <div style={{
                            fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace",
                            letterSpacing: "2px", marginBottom: 8, textTransform: "uppercase",
                          }}>Penalties</div>
                          {recap.penalties.map((pen, pi) => {
                            const isKnights = pen.team === "Knights";
                            return (
                              <div key={pi} className="vgk-recap-row" style={{
                                display: "flex", alignItems: "baseline", gap: 8,
                                padding: "4px 0",
                                borderLeft: `3px solid ${isKnights ? "#f87171" : C.textFaint}`,
                                paddingLeft: 16, marginBottom: 4,
                              }}>
                                <span style={{ fontSize: 12, color: C.textFaint, fontFamily: "'DM Mono', monospace", minWidth: 32 }}>{pen.period}</span>
                                <span style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace", minWidth: 50 }}>{pen.time.replace(/^00:/, "")}</span>
                                <span className="vgk-recap-name" style={{ fontSize: 14, color: C.textMid, fontWeight: 500, fontFamily: "'Outfit', sans-serif" }}>{pen.player}</span>
                                <span style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Mono', monospace" }}>
                                  {shortenPenalty(pen.type)} ({pen.minutes}min)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </>
  );
}

// ── AwardsView ─────────────────────────────────────────
const AUTO_AWARDS = [
  { name: "Ironman", description: "Most games played", compute: (sk) => { const w = sk.reduce((a, b) => b.gp > a.gp ? b : a, sk[0]); return { winner: w.player, stat: `${w.gp} GP` }; } },
  { name: "Cheechoo Train", description: "Most goals", compute: (sk) => { const w = sk.reduce((a, b) => b.g > a.g ? b : a, sk[0]); return { winner: w.player, stat: `${w.g} G` }; } },
  { name: "Adam Banks", description: "Most points", compute: (sk) => { const w = sk.reduce((a, b) => b.p > a.p ? b : a, sk[0]); return { winner: w.player, stat: `${w.p} PTS` }; } },
  { name: "Jumbo Joe", description: "Most assists", compute: (sk) => { const w = sk.reduce((a, b) => b.a > a.a ? b : a, sk[0]); return { winner: w.player, stat: `${w.a} A` }; } },
  { name: "Frequent Flyer", description: "Most penalty minutes", compute: (sk) => { const w = sk.reduce((a, b) => b.pm > a.pm ? b : a, sk[0]); return { winner: w.player, stat: `${w.pm} PIM` }; } },
  { name: "Ghost Checker", description: "Fewest penalty minutes", compute: (sk) => { const eligible = sk.filter((s) => s.gp > 0); const w = eligible.reduce((a, b) => b.pm < a.pm ? b : a, eligible[0]); return { winner: w.player, stat: `${w.pm} PIM` }; } },
  { name: "Heartbeat Hero", description: "Goalie never taking a night off", computeGoalie: (gl) => { if (!gl.length) return null; const w = gl.reduce((a, b) => b.gp > a.gp ? b : a, gl[0]); return { winner: w.player, stat: `${w.gp} GP` }; } },
];

function AwardsView({ skaterData, goalieData, manualAwards }) {
  const allAwards = useMemo(() => {
    const awards = [];
    if (skaterData.length > 0) {
      AUTO_AWARDS.forEach((def) => {
        let result = null;
        if (def.compute) result = def.compute(skaterData);
        else if (def.computeGoalie) result = def.computeGoalie(goalieData);
        if (result) awards.push({ name: def.name, description: def.description, ...result });
      });
    }
    manualAwards.forEach((a) => {
      awards.push({
        name: a.name,
        description: a.description,
        winner: a.winners ? a.winners.join(", ") : a.winner,
        stat: a.stat || "",
      });
    });
    return awards;
  }, [skaterData, goalieData, manualAwards]);

  if (allAwards.length === 0) return null;

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
  const [recapsData, setRecapsData] = useState({});
  const [playoffMode, setPlayoffMode] = useState(false);
  const [playoffSeasonData, setPlayoffSeasonData] = useState({});
  const [playoffGoalieData, setPlayoffGoalieData] = useState({});
  const [playoffGamesData, setPlayoffGamesData] = useState({});
  const [playoffRecapsData, setPlayoffRecapsData] = useState({});
  const [awardsData, setAwardsData] = useState({});
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
    const recapsFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/recaps.json`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.json(); })
        .then((data) => ({ id: s.id, type: "recaps", data }))
        .catch(() => ({ id: s.id, type: "recaps", data: [] }))
    );
    const playoffSkaterFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/playoffs-skaters.csv`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.text(); })
        .then((text) => ({ id: s.id, type: "playoff-skater", data: parseCSV(text) }))
        .catch(() => ({ id: s.id, type: "playoff-skater", data: [] }))
    );
    const playoffGoalieFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/playoffs-goalies.csv`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.text(); })
        .then((text) => ({ id: s.id, type: "playoff-goalie", data: parseGoalieCSV(text) }))
        .catch(() => ({ id: s.id, type: "playoff-goalie", data: [] }))
    );
    const playoffGamesFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/playoffs-games.csv`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.text(); })
        .then((text) => ({ id: s.id, type: "playoff-games", data: parseGamesCSV(text) }))
        .catch(() => ({ id: s.id, type: "playoff-games", data: [] }))
    );
    const playoffRecapsFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/playoffs-recaps.json`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.json(); })
        .then((data) => ({ id: s.id, type: "playoff-recaps", data }))
        .catch(() => ({ id: s.id, type: "playoff-recaps", data: [] }))
    );
    const awardsFetches = SEASONS.map((s) =>
      fetch(`${s.dir}/awards.json`)
        .then((r) => { if (!r.ok) throw new Error(s.dir); return r.json(); })
        .then((data) => ({ id: s.id, type: "awards", data }))
        .catch(() => ({ id: s.id, type: "awards", data: [] }))
    );
    Promise.all([...skaterFetches, ...goalieFetches, ...gamesFetches, ...recapsFetches, ...playoffSkaterFetches, ...playoffGoalieFetches, ...playoffGamesFetches, ...playoffRecapsFetches, ...awardsFetches]).then((results) => {
      const skaterMap = {};
      const goalieMap = {};
      const gamesMap = {};
      const recapsMap = {};
      const pSkaterMap = {};
      const pGoalieMap = {};
      const pGamesMap = {};
      const pRecapsMap = {};
      const awardsMap = {};
      results.forEach((r) => {
        if (r.type === "recaps") {
          if (r.data.length) recapsMap[r.id] = r.data;
        } else if (r.type === "games") {
          if (r.data.length) gamesMap[r.id] = r.data;
        } else if (r.type === "goalie") {
          if (r.data.length) goalieMap[r.id] = r.data;
        } else if (r.type === "playoff-skater") {
          if (r.data.length) pSkaterMap[r.id] = r.data;
        } else if (r.type === "playoff-goalie") {
          if (r.data.length) pGoalieMap[r.id] = r.data;
        } else if (r.type === "playoff-games") {
          if (r.data.length) pGamesMap[r.id] = r.data;
        } else if (r.type === "playoff-recaps") {
          if (r.data.length) pRecapsMap[r.id] = r.data;
        } else if (r.type === "awards") {
          if (r.data.length) awardsMap[r.id] = r.data;
        } else {
          if (r.data.length) skaterMap[r.id] = r.data;
        }
      });
      setSeasonData(skaterMap);
      setGoalieData(goalieMap);
      setGamesData(gamesMap);
      setRecapsData(recapsMap);
      setPlayoffSeasonData(pSkaterMap);
      setPlayoffGoalieData(pGoalieMap);
      setPlayoffGamesData(pGamesMap);
      setPlayoffRecapsData(pRecapsMap);
      setAwardsData(awardsMap);
      setTimeout(() => setLoaded(true), 80);
    });
  }, []);

  const allTimeData = useMemo(() => aggregateAllTime(seasonData), [seasonData]);
  const allTimeGoalieData = useMemo(() => aggregateGoalieAllTime(goalieData), [goalieData]);
  const allTimePlayoffData = useMemo(() => aggregateAllTime(playoffSeasonData), [playoffSeasonData]);
  const allTimePlayoffGoalieData = useMemo(() => aggregateGoalieAllTime(playoffGoalieData), [playoffGoalieData]);
  const pastSeasons = SEASONS.slice(1);

  // Determine if playoff data exists for the currently viewed season
  const viewedSeasonId = activeTab === "current" ? SEASONS[0]?.id
    : activeTab === "history" ? historySeason
    : null;
  const hasPlayoffData = activeTab === "alltime"
    ? Object.keys(playoffSeasonData).length > 0 || Object.keys(playoffGoalieData).length > 0
    : viewedSeasonId ? !!(playoffSeasonData[viewedSeasonId] || playoffGoalieData[viewedSeasonId] || playoffGamesData[viewedSeasonId])
    : false;

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== "history") setHistorySeason(null);
    if (tabId === "alltime" && statView === "awards") setStatView("skaters");
    setPlayoffMode(false);
  };
  const handleHistorySelect = (seasonId) => {
    setActiveTab("history");
    setHistorySeason(seasonId);
    setPlayoffMode(false);
  };

  const isGoalie = statView === "goalies";

  // Pick data source based on playoff toggle
  const skData = playoffMode ? playoffSeasonData : seasonData;
  const glData = playoffMode ? playoffGoalieData : goalieData;
  const gmData = playoffMode ? playoffGamesData : gamesData;
  const rcData = playoffMode ? playoffRecapsData : recapsData;
  const atSkData = playoffMode ? allTimePlayoffData : allTimeData;
  const atGlData = playoffMode ? allTimePlayoffGoalieData : allTimeGoalieData;
  const curSkData = skData[SEASONS[0]?.id] || [];
  const curGlData = glData[SEASONS[0]?.id] || [];

  const activeData = isGoalie
    ? (activeTab === "current" ? curGlData
      : activeTab === "alltime" ? atGlData
      : activeTab === "history" && historySeason ? glData[historySeason] || []
      : [])
    : (activeTab === "current" ? curSkData
      : activeTab === "alltime" ? atSkData
      : activeTab === "history" && historySeason ? skData[historySeason] || []
      : []);

  const activeCols = isGoalie
    ? (activeTab === "alltime" ? GOALIE_ALLTIME_COLS : GOALIE_COLS)
    : (activeTab === "alltime" ? ALLTIME_COLS : BASE_COLS);

  const activeSkaterData = activeTab === "current" ? curSkData
    : activeTab === "alltime" ? atSkData
    : skData[historySeason] || [];
  const activeGoalieData = activeTab === "current" ? curGlData
    : activeTab === "alltime" ? atGlData
    : glData[historySeason] || [];
  const activeGames = activeTab === "alltime"
    ? Object.values(gmData).flat()
    : activeTab === "current" ? (gmData[SEASONS[0]?.id] || [])
    : (gmData[historySeason] || []);
  const activeRecaps = activeTab === "alltime"
    ? Object.values(rcData).flat()
    : activeTab === "current" ? (rcData[SEASONS[0]?.id] || [])
    : (rcData[historySeason] || []);
  const activeAwards = activeTab === "current" ? (awardsData[SEASONS[0]?.id] || [])
    : activeTab === "history" && historySeason ? (awardsData[historySeason] || [])
    : [];

  // Enrich skater data with GWG and PPP from recaps
  const gwgCounts = useMemo(() => computeGWG(activeRecaps), [activeRecaps]);
  const stData = useMemo(() => computeSpecialTeams(activeRecaps), [activeRecaps]);
  const enrichedData = useMemo(() => {
    if (!isGoalie) {
      return activeData.map((r) => ({ ...r, gwg: gwgCounts[r.player] || 0, ppp: stData.playerPPP[r.player] || 0 }));
    }
    return activeData;
  }, [activeData, gwgCounts, stData, isGoalie]);

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
          .vgk-main { padding: 24px 12px 40px !important; }
          .vgk-logo { width: 48px !important; height: 54px !important; }
          .vgk-header-actions a span { display: none !important; }
          .vgk-mode-label { font-size: 0 !important; }
          .vgk-mode-label::after { content: attr(data-short); font-size: 11px; }
          .vgk-header-actions a,
          .vgk-header-actions button { padding: 8px 10px !important; }
          .vgk-header-actions { gap: 8px !important; }
          .vgk-stat-view-btn { padding: 8px 12px !important; font-size: 12px !important; letter-spacing: 1px !important; }
          .vgk-tab { padding: 12px 14px !important; font-size: 13px !important; letter-spacing: 1px !important; }
          .vgk-widget-value { font-size: 20px !important; }
          .vgk-widget-label { font-size: 11px !important; letter-spacing: 1px !important; }
          .vgk-widget-card { padding: 12px 8px !important; }
          .vgk-widget-row { grid-template-columns: repeat(2, 1fr) !important; }
          .vgk-player-expand { flex-direction: column !important; align-items: flex-start !important; }
          .vgk-recap-row span { font-size: 11px !important; }
          .vgk-recap-row .vgk-recap-name { font-size: 13px !important; }
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
          <div className="vgk-header-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a
              href="https://open.spotify.com/playlist/2pqv2kXaxSSaZhbUqxdw1r"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: "8px 14px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.3s ease", textDecoration: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={C.textDim}>
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span style={{
                fontSize: 11, color: C.textDim, fontFamily: "'DM Mono', monospace",
                letterSpacing: "1px",
              }}>PLAYLIST</span>
            </a>
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
              <span className="vgk-mode-label" data-short={darkMode ? "LT" : "DK"} style={{
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
          overflowX: "visible", overflow: "visible",
          animation: "fadeSlideUp 0.5s ease 80ms both",
          position: "relative", zIndex: 10,
        }}>
          <button
            className="vgk-tab"
            onClick={() => handleTabClick("current")}
            style={{
              padding: "12px 20px", fontSize: 15, fontWeight: 500, letterSpacing: "1.5px",
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
              padding: "12px 20px", fontSize: 15, fontWeight: 500, letterSpacing: "1.5px",
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

        {/* Playoff Toggle + Stat View Toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
          gap: 12, marginBottom: 28,
          animation: "fadeSlideUp 0.5s ease 120ms both",
        }}>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {["skaters", "goalies", "team", "records", "awards"].filter((view) => (view !== "awards" || (activeTab !== "alltime" && !playoffMode)) && (view !== "records" || activeTab === "alltime")).map((view) => (
              <button
                key={view}
                className="vgk-stat-view-btn"
                onClick={() => setStatView(view)}
                style={{
                  padding: "8px 18px", fontSize: 14, fontWeight: 500,
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
          {hasPlayoffData && (
            <div style={{
              display: "flex", borderRadius: 4, overflow: "hidden",
              border: `1px solid ${C.border}`,
            }}>
              {["Regular", "Playoffs"].map((label) => {
                const isActive = label === "Playoffs" ? playoffMode : !playoffMode;
                return (
                  <button
                    key={label}
                    onClick={() => { setPlayoffMode(label === "Playoffs"); if (label === "Playoffs" && statView === "awards") setStatView("skaters"); }}
                    style={{
                      padding: "6px 14px", fontSize: 12, fontWeight: 500,
                      letterSpacing: "1px", textTransform: "uppercase",
                      fontFamily: "'DM Mono', monospace",
                      border: "none", cursor: "pointer",
                      background: isActive ? `${C.gold}20` : "transparent",
                      color: isActive ? C.gold : C.textDim,
                      transition: "all 0.2s ease",
                      borderRight: label === "Regular" ? `1px solid ${C.border}` : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        {statView === "records" ? (
          <RecordsView seasonData={playoffMode ? playoffSeasonData : seasonData} goalieData={playoffMode ? playoffGoalieData : goalieData} gamesData={playoffMode ? playoffGamesData : gamesData} recapsData={playoffMode ? playoffRecapsData : recapsData} allTimeData={playoffMode ? allTimePlayoffData : allTimeData} />
        ) : statView === "awards" ? (
          <AwardsView skaterData={activeSkaterData} goalieData={activeGoalieData} manualAwards={activeAwards} />
        ) : statView === "team" ? (
          <TeamView skaterData={activeSkaterData} goalieData={activeGoalieData} games={activeGames} recaps={activeRecaps} isAllTime={activeTab === "alltime"} playoffMode={playoffMode} />
        ) : enrichedData.length > 0 ? (
          isGoalie
            ? <>
                <GoalieStatsView data={enrichedData} columns={activeCols} />
                <SvPctGauge data={enrichedData} />
              </>
            : <>
                <StatsView data={enrichedData} columns={activeCols} seasonData={seasonData} />
                {activeTab !== "alltime" && <CumulativePointsChart recaps={activeRecaps} />}
                <ScoringDonut data={enrichedData} />
                {activeTab === "current" && <PaceProjections data={enrichedData} />}
                {activeTab !== "alltime" && activeRecaps.length > 0 && (() => {
                  const combos = computeScoringCombos(activeRecaps).slice(0, 10);
                  if (!combos.length) return null;
                  const maxCount = combos[0].count;
                  return (
                    <div style={{ marginTop: 40, animation: "fadeSlideUp 0.5s ease 500ms both" }}>
                      <h3 style={{
                        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
                        marginBottom: 16, textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
                      }}>Scoring Combos</h3>
                      <p style={{
                        fontSize: 14, color: C.textFaint, fontFamily: "'DM Mono', monospace",
                        marginBottom: 16, marginTop: -8,
                      }}>Most frequent scorer + assist combinations</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {combos.map((c) => (
                          <div key={`${c.scorer}-${c.assister}`} style={{
                            display: "grid", gridTemplateColumns: "1fr 40px 60px",
                            alignItems: "center", gap: 12,
                            padding: "10px 14px", borderRadius: 6,
                            background: C.surface, border: `1px solid ${C.border}`,
                          }}>
                            <div>
                              <span style={{ fontSize: 15, color: C.gold, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>{c.scorer}</span>
                              <span style={{ fontSize: 13, color: C.textFaint, fontFamily: "'DM Mono', monospace", margin: "0 8px" }}>+</span>
                              <span style={{ fontSize: 15, color: C.goldMuted, fontWeight: 500, fontFamily: "'Outfit', sans-serif" }}>{c.assister}</span>
                            </div>
                            <span style={{ fontSize: 16, fontWeight: 700, color: C.gold, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>{c.count}</span>
                            <div style={{
                              height: 8, borderRadius: 4, background: C.bg, border: `1px solid ${C.border}`, overflow: "hidden",
                            }}>
                              <div style={{
                                height: "100%", width: `${(c.count / maxCount) * 100}%`, borderRadius: 4,
                                background: `linear-gradient(90deg, ${C.goldDim}, ${C.gold})`,
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {activeTab !== "alltime" && activeRecaps.length > 0 && (() => {
                  const leaders = computePenaltyLeaders(activeRecaps);
                  if (!leaders.length) return null;
                  return (
                    <div style={{ marginTop: 40, marginBottom: 32, animation: "fadeSlideUp 0.5s ease 550ms both" }}>
                      <h3 style={{
                        fontSize: 17, color: C.textDim, letterSpacing: "3px", fontWeight: 500,
                        marginBottom: 16, textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
                      }}>Penalty Leaders</h3>
                      <div style={{
                        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
                      }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.gold}33` }}>
                              {["PLAYER", "PIM", "TOP TYPE"].map((h) => (
                                <th key={h} style={{
                                  padding: "12px 10px", textAlign: h === "PLAYER" ? "left" : "center",
                                  fontSize: 15, fontWeight: 500, letterSpacing: "1.5px", color: C.textDim,
                                  fontFamily: "'DM Mono', monospace",
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {leaders.map((p) => {
                              const topType = Object.entries(p.types).sort((a, b) => b[1] - a[1])[0];
                              return (
                                <tr key={p.player}>
                                  <td style={{ padding: "12px 10px", fontWeight: 600, color: C.text, fontFamily: "'Outfit', sans-serif", fontSize: 15 }}>{p.player}</td>
                                  <td style={{ padding: "12px 10px", textAlign: "center", color: "#f87171", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{p.minutes}</td>
                                  <td style={{ padding: "12px 10px", textAlign: "center", color: C.textDim, fontFamily: "'DM Mono', monospace" }}>
                                    {topType ? `${shortenPenalty(topType[0])} (${topType[1]})` : "–"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
                {activeTab === "current" && <MilestoneTracker allTimeData={allTimeData} />}
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
      <Analytics />
    </div>
  );
}
