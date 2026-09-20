// Distinguish an empty competition from a failed download before displaying totals.
export async function loadStatsFile(url, parse, optional = false) {
  try {
    const response = await fetch(url);
    if (optional && response.status === 404) return { data: [], missing: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    // Static SPA hosts may return index.html for an absent optional data file.
    if (optional && /^\s*(?:<!doctype html|<html)/i.test(text)) return { data: [], missing: true };
    const data = parse(text);
    if (!Array.isArray(data)) throw new Error("Expected a list of stats");
    return { data };
  } catch (error) {
    return { data: [], error: error.message };
  }
}

export function teamSavePercentage(goalies) {
  const saves = goalies.reduce((total, goalie) => total + goalie.sv, 0);
  const shots = goalies.reduce((total, goalie) => total + goalie.sa, 0);
  return shots > 0 ? saves / shots : null;
}
