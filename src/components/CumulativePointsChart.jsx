import React, { useState } from "react";
import { useTheme } from "../theme.js";

export default function CumulativePointsChart({ recaps }) {
  const C = useTheme();
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

