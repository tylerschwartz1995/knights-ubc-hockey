import React, { useMemo } from "react";
import { useTheme } from "../theme.js";
import { SEASONS } from "../config.js";
import { computeComebacks } from "../data/calculations.js";

export default function RecordsView({ seasonData, goalieData, gamesData, recapsData, allTimeData }) {
  const C = useTheme();
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
