import React, { useEffect, useState } from "react";
import { formatGameTime, upcomingGames } from "./schedule.js";

const PREFIXES = { regular: "", playoffs: "playoffs-", tournament: "tournaments-" };

export function UpcomingSchedule({ season, mode, colors: C }) {
  const [schedule, setSchedule] = useState(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const controller = new AbortController();
    setSchedule(null);
    setFailed(false);
    fetch(`${season.dir}/${PREFIXES[mode]}upcoming.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Schedule unavailable");
        const data = await response.json();
        if (!Array.isArray(data.games)) throw new Error("Invalid schedule");
        return data;
      })
      .then(setSchedule)
      .catch((error) => { if (error.name !== "AbortError") setFailed(true); });
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [season.dir, mode]);

  // Older competitions need no placeholder for schedule files they never had.
  if (failed && mode !== "regular") return null;
  const games = upcomingGames(schedule?.games || [], now);
  return (
    <section aria-label="Upcoming games" style={{
      marginBottom: 28, padding: 22, background: C.surface, fontFamily: "'Outfit', sans-serif",
      border: `1px solid ${C.border}`, borderRadius: 8,
    }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, color: C.gold }}>Upcoming games</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textDim }}>
        Published games only. More dates may be added as the schedule is released.
      </p>
      {schedule?.statsSource === "scoring-summary" && (
        <p style={{ color: C.textMid, fontSize: 13 }}>Season stats include the first game’s scoring summary, confirmed final by the team.</p>
      )}
      {failed ? (
        <p role="alert" style={{ color: C.textMid }}>The schedule could not be loaded. Please reload to try again.</p>
      ) : !schedule ? (
        <p style={{ color: C.textMid }}>Loading schedule…</p>
      ) : games.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {games.map((game) => (
            <li key={game.id} style={{ padding: "12px 0", borderTop: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
              <div>
                <span style={{ color: C.text, fontWeight: 600 }}>{game.home ? "vs" : "at"} {game.opponent}</span>
                {game.venue && <div style={{ color: C.textDim, fontSize: 12, marginTop: 5 }}>{game.venue}{game.facility ? ` · ${game.facility}` : ""}</div>}
              </div>
              <time dateTime={game.startsAt} style={{ color: C.textMid, fontSize: 14 }}>{formatGameTime(game.startsAt)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: C.textMid }}>{schedule.updatedAt ? "No upcoming games in the latest update." : "The new season’s schedule is waiting for its first update."}</p>
      )}
      {schedule?.pendingGames?.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 12 }}>
          <h3 style={{ color: C.textMid, fontSize: 14 }}>Awaiting official results</h3>
          {schedule.pendingGames.map((game) => (
            <p key={game.id} style={{ color: C.textDim, fontSize: 13 }}>
              Knights {game.gf}–{game.ga} {game.opponent} · {formatGameTime(game.startsAt)}
            </p>
          ))}
          <p style={{ color: C.textDim, fontSize: 12 }}>These games are not included in season totals until finalized.</p>
        </div>
      )}
      {schedule?.updatedAt && Number.isFinite(Date.parse(schedule.updatedAt)) && (
        <p style={{ margin: "16px 0 0", fontSize: 12, color: C.textDim }}>Last updated {formatGameTime(schedule.updatedAt)}</p>
      )}
    </section>
  );
}
