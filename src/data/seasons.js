import { loadStatsFile } from '../stats.js';
import { parseCSV, parseGoalieCSV, parseGamesCSV } from './parsers.js';

const SOURCES = [
  ['skater', 'skaters.csv', parseCSV, 'SeasonData'],
  ['goalie', 'goalies.csv', parseGoalieCSV, 'GoalieData'],
  ['games', 'games.csv', parseGamesCSV, 'GamesData'],
  ['recaps', 'recaps.json', JSON.parse, 'RecapsData'],
];
const MODES = [
  ['regular', '', '', ''],
  ['playoffs', 'playoffs-', 'playoff-', 'playoff'],
  ['tournament', 'tournaments-', 'tournament-', 'tournament'],
];
const mapName = (prefix, suffix) => prefix ? prefix + suffix : suffix[0].toLowerCase() + suffix.slice(1);

export function emptySeasonData() {
  return Object.fromEntries([
    ...MODES.flatMap(([, , , prefix]) => SOURCES.map(([, , , suffix]) => [mapName(prefix, suffix), {}])),
    ['awardsData', {}], ['errors', []],
  ]);
}

// Fetch independent files in parallel, retaining competition and failure identity.
export async function loadSeasonData(seasons) {
  const requests = seasons.flatMap((season) => [
    ...MODES.flatMap(([mode, prefix, typePrefix, mapPrefix]) => SOURCES.map(([type, file, parse, suffix]) =>
      loadStatsFile(`${season.dir}/${prefix}${file}`, parse, mode !== 'regular')
        .then(result => ({ ...result, id: season.id, mode, file: prefix + file, type: typePrefix + type, map: mapName(mapPrefix, suffix) }))
    )),
    loadStatsFile(`${season.dir}/awards.json`, JSON.parse, true)
      .then(result => ({ ...result, id: season.id, mode: 'regular', file: 'awards.json', type: 'awards', map: 'awardsData' })),
  ]);
  const results = await Promise.all(requests);
  const data = emptySeasonData();
  data.errors = results.filter(result => result.error || (
    result.missing && result.type !== 'awards' && results.some(other =>
      other.id === result.id && other.mode === result.mode && other.type !== 'awards' && !other.missing
    )
  ));
  for (const result of results) {
    if (result.data.length) data[result.map][result.id] = result.data;
  }
  return data;
}
