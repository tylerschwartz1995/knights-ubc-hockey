// ── Columns ─────────────────────────────────────────────
export const BASE_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "gp", label: "GP" },
  { key: "g", label: "G" },
  { key: "a", label: "A" },
  { key: "p", label: "PTS" },
  { key: "ppp", label: "PPP", format: (value) => value == null ? "—" : value },
  { key: "ppg", label: "P/GP", format: (v) => v.toFixed(2) },
  { key: "gwg", label: "GWG" },
  { key: "pm", label: "PIM" },
];

export const ALLTIME_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "seasons", label: "SZN" },
  { key: "gp", label: "GP" },
  { key: "g", label: "G" },
  { key: "a", label: "A" },
  { key: "p", label: "PTS" },
  { key: "ppp", label: "PPP", format: (value) => value == null ? "—" : value },
  { key: "ppg", label: "P/GP", format: (v) => v.toFixed(2) },
  { key: "gwg", label: "GWG" },
  { key: "pm", label: "PIM" },
];

export const GOALIE_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "gp", label: "GP" },
  { key: "w", label: "W" },
  { key: "l", label: "L" },
  { key: "otl", label: "OTL" },
  { key: "so", label: "SO" },
  { key: "gaa", label: "GAA", format: (v) => v.toFixed(2) },
  { key: "svPct", label: "SV%", format: (v) => v.toFixed(3) },
  { key: "sv", label: "SV" },
  { key: "ga", label: "GA" },
  { key: "sa", label: "SA" },
  { key: "min", label: "MIN" },
];

export const GOALIE_ALLTIME_COLS = [
  { key: "player", label: "PLAYER", align: "left" },
  { key: "seasons", label: "SZN" },
  { key: "gp", label: "GP" },
  { key: "w", label: "W" },
  { key: "l", label: "L" },
  { key: "otl", label: "OTL" },
  { key: "so", label: "SO" },
  { key: "gaa", label: "GAA", format: (v) => v.toFixed(2) },
  { key: "svPct", label: "SV%", format: (v) => v.toFixed(3) },
  { key: "sv", label: "SV" },
  { key: "ga", label: "GA" },
  { key: "sa", label: "SA" },
  { key: "min", label: "MIN" },
];

