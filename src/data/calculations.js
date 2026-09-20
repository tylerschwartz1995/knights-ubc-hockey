export function aggregateAllTime(seasonDataMap) {
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

export function aggregateGoalieAllTime(seasonDataMap) {
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
export function computeGWG(recaps) {
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

export function computeScoringCombos(recaps) {
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
export function shortenPenalty(type) {
  return PENALTY_ABBREV[type] || type;
}

export function computePenaltyLeaders(recaps) {
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

export function computeGoalsByPeriod(recaps) {
  const periods = {};
  recaps.forEach((game) => {
    game.goals.forEach((goal) => {
      if (goal.team !== "Knights") return;
      periods[goal.period] = (periods[goal.period] || 0) + 1;
    });
  });
  return periods;
}

export function computeComebacks(recaps) {
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

