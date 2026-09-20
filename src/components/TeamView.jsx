import React, { useState } from "react";
import { useTheme, plainButton } from "../theme.js";
import { computeSpecialTeams } from "../specialTeams.js";
import { teamSavePercentage } from "../stats.js";
import { shortenPenalty, computeGoalsByPeriod, computeComebacks } from "../data/calculations.js";

export default function TeamView({ goalieData, games, recaps, isAllTime, playoffMode, tournamentMode }) {
  const C = useTheme();
  const [oppSortKey, setOppSortKey] = useState("gp");
  const [oppSortAsc, setOppSortAsc] = useState(false);
  const [expandedGame, setExpandedGame] = useState(null);
  const handleOppSort = (key) => {
    if (oppSortKey === key) setOppSortAsc(!oppSortAsc);
    else { setOppSortKey(key); setOppSortAsc(false); }
  };
  const teamSvPct = teamSavePercentage(goalieData);

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
    ...(teamSvPct !== null ? [{ label: "TEAM SV%", value: teamSvPct.toFixed(3) }] : []),
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
          }}>{tournamentMode ? "Tournament Run" : playoffMode ? "Road to the Cup" : "Season Timeline"}</h3>
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
                    <th key={h.k} aria-sort={oppSortKey === h.k ? (oppSortAsc ? "ascending" : "descending") : "none"} style={{
                      padding: "12px 10px", textAlign: h.k === "name" ? "left" : "center",
                      fontSize: 14, fontWeight: 500, letterSpacing: "1.5px",
                      color: oppSortKey === h.k ? C.gold : C.textDim,
                      fontFamily: "'DM Mono', monospace",
                      cursor: "pointer", userSelect: "none", transition: "color 0.2s",
                    }}>
                      <button type="button" style={plainButton} onClick={() => handleOppSort(h.k)}>
                        {h.l}
                        {oppSortKey === h.k && (
                          <span aria-hidden="true" style={{ marginLeft: 3, fontSize: 8 }}>{oppSortAsc ? "▲" : "▼"}</span>
                        )}
                      </button>
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
                  <button type="button" disabled={!recap} aria-expanded={recap ? isExpanded : undefined}
                    onClick={() => setExpandedGame(isExpanded ? null : gameKey)}
                    style={{
                      width: "100%", textAlign: "left", font: "inherit",
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
                  </button>
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

