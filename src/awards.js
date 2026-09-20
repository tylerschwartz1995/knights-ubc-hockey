export const AUTO_AWARDS = [
  { name: "Ironman", description: "Most games played", compute: (sk) => { const w = sk.reduce((a, b) => b.gp > a.gp ? b : a, sk[0]); return { winner: w.player, stat: `${w.gp} GP` }; } },
  { name: "Cheechoo Train", description: "Most goals", compute: (sk) => { const w = sk.reduce((a, b) => b.g > a.g ? b : a, sk[0]); return { winner: w.player, stat: `${w.g} G` }; } },
  { name: "Adam Banks", description: "Most points", compute: (sk) => { const w = sk.reduce((a, b) => b.p > a.p ? b : a, sk[0]); return { winner: w.player, stat: `${w.p} PTS` }; } },
  { name: "Jumbo Joe", description: "Most assists", compute: (sk) => { const w = sk.reduce((a, b) => b.a > a.a ? b : a, sk[0]); return { winner: w.player, stat: `${w.a} A` }; } },
  { name: "Frequent Flyer", description: "Most penalty minutes", compute: (sk) => { const w = sk.reduce((a, b) => b.pm > a.pm ? b : a, sk[0]); return { winner: w.player, stat: `${w.pm} PIM` }; } },
  { name: "Ghost Checker", description: "Fewest penalty minutes", compute: (sk) => { const eligible = sk.filter((s) => s.gp > 0); if (!eligible.length) return null; const w = eligible.reduce((a, b) => b.pm < a.pm ? b : a, eligible[0]); return { winner: w.player, stat: `${w.pm} PIM` }; } },
  { name: "Heartbeat Hero", description: "Goalie never taking a night off", computeGoalie: (gl) => { if (!gl.length) return null; const w = gl.reduce((a, b) => b.gp > a.gp ? b : a, gl[0]); return { winner: w.player, stat: `${w.gp} GP` }; } },
];


export function computeAwards(skaters, goalies, manualAwards = []) {
  const eligibleSkaters = skaters.filter((player) => player.gp > 0);
  const eligibleGoalies = goalies.filter((player) => player.gp > 0);
  const automatic = AUTO_AWARDS.flatMap((definition) => {
    const result = definition.compute
      ? (eligibleSkaters.length ? definition.compute(eligibleSkaters) : null)
      : definition.computeGoalie(eligibleGoalies);
    return result ? [{ name: definition.name, description: definition.description, ...result }] : [];
  });
  return [...automatic, ...manualAwards.map((award) => ({
    ...award,
    winner: award.winners ? award.winners.join(", ") : award.winner,
    stat: award.stat || "",
  }))];
}
