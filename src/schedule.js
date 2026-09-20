export function upcomingGames(games, now = Date.now()) {
  return games
    .filter((game) => Number.isFinite(Date.parse(game.startsAt)) && Date.parse(game.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function formatGameTime(startsAt) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver", weekday: "short", month: "short",
    day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(startsAt));
}
