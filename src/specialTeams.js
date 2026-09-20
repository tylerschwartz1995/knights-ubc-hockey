// Clock direction and actual durations must come from the source, never a guessed league length.
function gameClock(game) {
  if (!["remaining", "elapsed"].includes(game.clockDirection) || !game.periods?.length) return null;
  const periods = new Map();
  let offset = 0;
  for (const period of game.periods) {
    if (!Number.isFinite(period.durationSeconds) || period.durationSeconds <= 0) return null;
    periods.set(period.name, { offset, duration: period.durationSeconds });
    offset += period.durationSeconds;
  }
  const toSec = (name, time) => {
    const period = periods.get(name);
    if (!period || typeof time !== "string" || !/^(?:\d+:)?\d{1,2}:\d{2}$/.test(time)) return NaN;
    const seconds = time.split(":").reduce((total, value) => total * 60 + Number(value), 0);
    if (seconds > period.duration) return NaN;
    return period.offset + (game.clockDirection === "remaining" ? period.duration - seconds : seconds);
  };
  if ([...(game.goals || []), ...(game.penalties || [])].some(event => !Number.isFinite(toSec(event.period, event.time)))) return null;
  return toSec;
}

export function computeSpecialTeams(recaps) {
  let ppOpp = 0, ppGoals = 0, pkSit = 0, pkGA = 0;
  const playerPPP = {}; // per-player power play points

  const unavailable = { available: false, ppGoals: 0, ppOpp: 0, ppPct: 0, pkGA: 0, pkSit: 0, pkPct: 0, playerPPP: {} };
  const clocks = recaps.map(gameClock);
  if (clocks.some((clock) => !clock)) return unavailable;
  recaps.forEach((game, index) => {
    const toSec = clocks[index];
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
    available: true, ppGoals, ppOpp,
    ppPct: ppOpp > 0 ? (ppGoals / ppOpp * 100) : 0,
    pkGA, pkSit,
    pkPct: pkSit > 0 ? ((1 - pkGA / pkSit) * 100) : 0,
    playerPPP,
  };
}

