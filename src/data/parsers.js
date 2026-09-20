import Papa from "papaparse";

// ── Filters ─────────────────────────────────────────────
const GOALIE_EXCLUDE = ["Stuart Coy"];

// ── CSV parsing ─────────────────────────────────────────
function parseTable(text, requiredHeaders) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  const fields = (result.meta.fields || []).map((field) => field.trim().toLowerCase());
  if (!requiredHeaders.some((field) => fields.includes(field)) || result.errors.length) {
    throw new Error("Invalid stats CSV");
  }
  return result;
}

export function parseCSV(text) {
  const result = parseTable(text, ["player", "name"]);
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

export function parseGoalieCSV(text) {
  const result = parseTable(text, ["player", "name"]);
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

export function parseGamesCSV(text) {
  const result = parseTable(text, ["date"]);
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

