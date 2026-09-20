import React, { useState, useMemo } from "react";
import { Analytics } from "@vercel/analytics/react";
import { CONFIG, SEASONS } from "./config.js";
import { DARK, LIGHT, ThemeContext } from "./theme.js";
import { useSeasonData } from "./hooks/useSeasonData.js";
import { computeSpecialTeams } from "./specialTeams.js";
import { BASE_COLS, ALLTIME_COLS, GOALIE_COLS, GOALIE_ALLTIME_COLS } from "./data/columns.js";
import { aggregateAllTime, aggregateGoalieAllTime, computeGWG, computeScoringCombos, shortenPenalty, computePenaltyLeaders } from "./data/calculations.js";
import KnightLogo from "./components/KnightLogo.jsx";
import HistoryDropdown from "./components/HistoryDropdown.jsx";
import CumulativePointsChart from "./components/CumulativePointsChart.jsx";
import StatsView from "./components/StatsView.jsx";
import ScoringDonut from "./components/ScoringDonut.jsx";
import RecordsView from "./components/RecordsView.jsx";
import MilestoneTracker from "./components/MilestoneTracker.jsx";
import SvPctGauge from "./components/SvPctGauge.jsx";
import GoalieStatsView from "./components/GoalieStatsView.jsx";
import PaceProjections from "./components/PaceProjections.jsx";
import TeamView from "./components/TeamView.jsx";
import AwardsView from "./components/AwardsView.jsx";

// ── App ─────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const C = darkMode ? DARK : LIGHT;

  const [activeTab, setActiveTab] = useState("current");
  const [historySeason, setHistorySeason] = useState(null);
  const [statView, setStatView] = useState("skaters"); // "skaters" | "goalies" | "team"
  const [gameMode, setGameMode] = useState("regular");
  const playoffMode = gameMode === "playoffs";
  const tournamentMode = gameMode === "tournament";
  const {
    seasonData, goalieData, gamesData, recapsData,
    playoffSeasonData, playoffGoalieData, playoffGamesData, playoffRecapsData,
    tournamentSeasonData, tournamentGoalieData, tournamentGamesData, tournamentRecapsData,
    awardsData, loaded, errors,
  } = useSeasonData();

  const allTimeData = useMemo(() => aggregateAllTime(seasonData), [seasonData]);
  const allTimeGoalieData = useMemo(() => aggregateGoalieAllTime(goalieData), [goalieData]);
  const allTimePlayoffData = useMemo(() => aggregateAllTime(playoffSeasonData), [playoffSeasonData]);
  const allTimePlayoffGoalieData = useMemo(() => aggregateGoalieAllTime(playoffGoalieData), [playoffGoalieData]);
  const allTimeTournamentData = useMemo(() => aggregateAllTime(tournamentSeasonData), [tournamentSeasonData]);
  const allTimeTournamentGoalieData = useMemo(() => aggregateGoalieAllTime(tournamentGoalieData), [tournamentGoalieData]);
  const pastSeasons = SEASONS.slice(1);

  // Determine if playoff data exists for the currently viewed season
  const viewedSeasonId = activeTab === "current" ? SEASONS[0]?.id
    : activeTab === "history" ? historySeason
    : null;
  const failedCompetition = (mode) => errors.some((error) => error.mode === mode && (activeTab === "alltime" || error.id === viewedSeasonId));
  const hasPlayoffData = failedCompetition("playoffs") || (activeTab === "alltime"
    ? Object.keys(playoffSeasonData).length > 0 || Object.keys(playoffGoalieData).length > 0
    : viewedSeasonId ? !!(playoffSeasonData[viewedSeasonId] || playoffGoalieData[viewedSeasonId] || playoffGamesData[viewedSeasonId])
    : false);
  const hasTournamentData = failedCompetition("tournament") || (activeTab === "alltime"
    ? Object.keys(tournamentSeasonData).length > 0 || Object.keys(tournamentGoalieData).length > 0
    : viewedSeasonId ? !!(tournamentSeasonData[viewedSeasonId] || tournamentGoalieData[viewedSeasonId] || tournamentGamesData[viewedSeasonId])
    : false);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== "history") setHistorySeason(null);
    if ((tabId !== "history" && statView === "awards") || (tabId !== "alltime" && statView === "records")) setStatView("skaters");
    setGameMode("regular");
  };
  const handleHistorySelect = (seasonId) => {
    if (statView === "records") setStatView("skaters");
    setActiveTab("history");
    setHistorySeason(seasonId);
    setGameMode("regular");
  };

  const isGoalie = statView === "goalies";
  const activeErrors = errors.filter((error) => error.mode === gameMode &&
    (activeTab === "alltime" || error.id === viewedSeasonId) &&
    (error.type !== "awards" || statView === "awards"));

  // Pick data source based on game mode
  const skData = tournamentMode ? tournamentSeasonData : playoffMode ? playoffSeasonData : seasonData;
  const glData = tournamentMode ? tournamentGoalieData : playoffMode ? playoffGoalieData : goalieData;
  const gmData = tournamentMode ? tournamentGamesData : playoffMode ? playoffGamesData : gamesData;
  const rcData = tournamentMode ? tournamentRecapsData : playoffMode ? playoffRecapsData : recapsData;
  const atSkData = tournamentMode ? allTimeTournamentData : playoffMode ? allTimePlayoffData : allTimeData;
  const atGlData = tournamentMode ? allTimeTournamentGoalieData : playoffMode ? allTimePlayoffGoalieData : allTimeGoalieData;
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
      return activeData.map((r) => ({ ...r, gwg: gwgCounts[r.player] || 0, ppp: stData.available ? (stData.playerPPP[r.player] || 0) : null }));
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
    <ThemeContext.Provider value={C}>
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        button:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 4px; }
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
            {["skaters", "goalies", "team", "records", "awards"].filter((view) => (view !== "awards" || (activeTab === "history" && !playoffMode && !tournamentMode)) && (view !== "records" || activeTab === "alltime")).map((view) => (
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
          {(hasPlayoffData || hasTournamentData) && (() => {
            const segments = [{ label: "Regular", mode: "regular" }];
            if (hasTournamentData) segments.push({ label: "Tournament", mode: "tournament" });
            if (hasPlayoffData) segments.push({ label: "Playoffs", mode: "playoffs" });
            return (
              <div style={{
                display: "flex", borderRadius: 4, overflow: "hidden",
                border: `1px solid ${C.border}`,
              }}>
                {segments.map((seg, i) => {
                  const isActive = gameMode === seg.mode;
                  return (
                    <button
                      key={seg.mode}
                      onClick={() => { setGameMode(seg.mode); if (seg.mode !== "regular" && statView === "awards") setStatView("skaters"); }}
                      style={{
                        padding: "6px 14px", fontSize: 12, fontWeight: 500,
                        letterSpacing: "1px", textTransform: "uppercase",
                        fontFamily: "'DM Mono', monospace",
                        border: "none", cursor: "pointer",
                        background: isActive ? `${C.gold}20` : "transparent",
                        color: isActive ? C.gold : C.textDim,
                        transition: "all 0.2s ease",
                        borderRight: i < segments.length - 1 ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      {seg.label}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {activeErrors.length > 0 && (
          <p role="alert" style={{ color: C.gold, padding: "12px 0" }}>
            Stats are unavailable because these files could not be loaded: {activeErrors.map((error) => `${error.id}/${error.file}`).join(", ")}. Reload the page to try again.
          </p>
        )}

        {/* Content */}
        {activeErrors.length > 0 ? null : statView === "records" ? (
          <RecordsView seasonData={tournamentMode ? tournamentSeasonData : playoffMode ? playoffSeasonData : seasonData} goalieData={tournamentMode ? tournamentGoalieData : playoffMode ? playoffGoalieData : goalieData} gamesData={tournamentMode ? tournamentGamesData : playoffMode ? playoffGamesData : gamesData} recapsData={tournamentMode ? tournamentRecapsData : playoffMode ? playoffRecapsData : recapsData} allTimeData={tournamentMode ? allTimeTournamentData : playoffMode ? allTimePlayoffData : allTimeData} />
        ) : statView === "awards" ? (
          <AwardsView skaterData={activeSkaterData} goalieData={activeGoalieData} manualAwards={activeAwards} />
        ) : statView === "team" ? (
          <TeamView skaterData={activeSkaterData} goalieData={activeGoalieData} games={activeGames} recaps={activeRecaps} isAllTime={activeTab === "alltime"} playoffMode={playoffMode} tournamentMode={tournamentMode} />
        ) : enrichedData.length > 0 ? (
          isGoalie
            ? <>
                <GoalieStatsView data={enrichedData} columns={activeCols} />
                <SvPctGauge data={enrichedData} />
              </>
            : <>
                <StatsView data={enrichedData} columns={activeCols} seasonData={errors.some((error) => error.mode === gameMode && error.type.endsWith("skater")) ? undefined : skData} />
                {activeTab !== "alltime" && !playoffMode && !tournamentMode && (activeTab !== "current" || activeGames.length >= 5) && <CumulativePointsChart recaps={activeRecaps} />}
                <ScoringDonut data={enrichedData} />
                {activeTab === "current" && gameMode === "regular" && <PaceProjections data={enrichedData} totalGames={SEASONS[0].totalGames} />}
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
                {activeTab === "current" && !playoffMode && !tournamentMode && !errors.some((error) => error.mode === "regular" && error.type === "skater") && <MilestoneTracker allTimeData={allTimeData} />}
              </>
        ) : (
          <div style={{
            textAlign: "center", padding: 60, color: C.textFaint,
            fontFamily: "'Outfit', sans-serif",
          }}>
            <p style={{ fontSize: 15 }}>No stats available yet</p>
            <p style={{ fontSize: 13, marginTop: 8, color: C.textDim }}>
              {activeTab === "current"
                ? "Stats will appear after the first completed game is imported. Past seasons are available in History."
                : "There are no player stats for this selection."}
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
    </ThemeContext.Provider>
  );
}
