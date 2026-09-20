import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAllTime, aggregateGoalieAllTime, computeGWG, computeScoringCombos } from '../src/data/calculations.js';
import { parseCSV, parseGoalieCSV } from '../src/data/parsers.js';
import { loadSeasonData } from '../src/data/seasons.js';
import { computeSpecialTeams } from '../src/specialTeams.js';

const skaters = points => `Player,GP,G,A,P,PM\nSame Player,2,${points},0,${points},2\n`;
const goalies = 'Player,GP,SV,GA,SA,MIN,GAA,SV%\nGoalie,2,36,4,40,80,3,0.9\n';
const games = 'Date,Opponent,GF,GA,Result,OT,Home\n2026-09-19,Other,2,1,W,0,1\n';

function mockSeason(t, overrides = {}) {
  const files = {
    'skaters.csv': skaters(2), 'goalies.csv': goalies, 'games.csv': games, 'recaps.json': '[]',
    ...overrides,
  };
  t.mock.method(globalThis, 'fetch', async url => {
    const file = url.split('/').pop();
    const body = files[file];
    if (body instanceof Error) throw body;
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body);
  });
  return [{ id: 'season', dir: '/seasons/season' }];
}

test('career skaters sum counting stats and recompute P/GP instead of averaging rates', () => {
  const seasons = {
    a: parseCSV('Player,GP,G,A,P,PM\nPlayer,2,4,2,6,2\n'),
    b: parseCSV('Player,GP,G,A,P,PM\nPlayer,8,1,1,2,4\n'),
    empty: [],
  };
  const before = structuredClone(seasons);
  assert.deepEqual(aggregateAllTime(seasons), [{ player: 'Player', gp: 10, g: 5, a: 3, p: 8, pm: 6, seasons: 2, ppg: 0.8 }]);
  assert.deepEqual(seasons, before);
  assert.deepEqual(aggregateAllTime({}), []);
});

test('career goalie rates use total minutes and shots, not season rate averages', () => {
  const seasons = {
    a: parseGoalieCSV('Player,GP,SV,GA,SA,MIN,GAA,SV%\nGoalie,1,9,1,10,30,2,0.9\n'),
    b: parseGoalieCSV('Player,GP,SV,GA,SA,MIN,GAA,SV%\nGoalie,3,60,30,90,120,15,0.667\n'),
  };
  const before = structuredClone(seasons);
  const [career] = aggregateGoalieAllTime(seasons);
  assert.equal(career.gaa, 12.4);
  assert.equal(career.svPct, 0.69);
  assert.equal(career.gp, 4);
  assert.equal(career.seasons, 2);
  assert.deepEqual(seasons, before);
  const [unplayed] = aggregateGoalieAllTime({ a: parseGoalieCSV('Player,GP\nGoalie,0\n') });
  assert.equal(unplayed.gaa, 0);
  assert.equal(unplayed.svPct, 0);
});

test('real loader keeps regular, playoff, and tournament totals and breakdowns separate', async t => {
  const seasons = mockSeason(t, {
    'playoffs-skaters.csv': skaters(7), 'playoffs-goalies.csv': goalies, 'playoffs-games.csv': games, 'playoffs-recaps.json': '[]',
    'tournaments-skaters.csv': skaters(11), 'tournaments-goalies.csv': goalies, 'tournaments-games.csv': games, 'tournaments-recaps.json': '[]',
  });
  const data = await loadSeasonData(seasons);
  assert.deepEqual(data.errors, []);
  assert.equal(aggregateAllTime(data.seasonData)[0].p, 2);
  assert.equal(aggregateAllTime(data.playoffSeasonData)[0].p, 7);
  assert.equal(aggregateAllTime(data.tournamentSeasonData)[0].p, 11);
  assert.equal(data.playoffSeasonData.season[0].p, 7);
  assert.notStrictEqual(data.gamesData.season, data.playoffGamesData.season);
});

test('absent optional competitions are normal, but partial competitions are errors', async t => {
  const seasons = mockSeason(t, { 'playoffs-skaters.csv': skaters(7) });
  const data = await loadSeasonData(seasons);
  assert.deepEqual(data.errors.map(error => error.file).sort(), ['playoffs-games.csv', 'playoffs-goalies.csv', 'playoffs-recaps.json']);
  assert.deepEqual(data.tournamentSeasonData, {});
});

test('required network failures and malformed CSV stay visible without contaminating another competition', async t => {
  const seasons = mockSeason(t, { 'games.csv': new Error('offline'), 'goalies.csv': '<html>Error</html>' });
  const data = await loadSeasonData(seasons);
  assert.deepEqual(data.errors.map(error => error.file).sort(), ['games.csv', 'goalies.csv']);
  assert.ok(data.errors.every(error => error.id === 'season' && error.mode === 'regular'));
  assert.deepEqual(data.gamesData, {});
  assert.equal(data.seasonData.season[0].p, 2);
});

test('empty preseason files are valid and do not fabricate player totals', async t => {
  const seasons = mockSeason(t, { 'skaters.csv': 'Player,GP,G,A,P,PM\n', 'goalies.csv': 'Player,GP\n', 'games.csv': 'Date,Opponent,GF,GA,Result\n' });
  const data = await loadSeasonData(seasons);
  assert.deepEqual(data.errors, []);
  assert.deepEqual(aggregateAllTime(data.seasonData), []);
});

test('the winning goal is opponent final score plus one; losses and opposing scorers do not count', () => {
  const goals = [
    { team: 'Knights', scorer: 'First', assists: ['Helper'] },
    { team: 'Other', scorer: 'Opponent', assists: [] },
    { team: 'Knights', scorer: 'Winner', assists: ['Helper'] },
    { team: 'Knights', scorer: 'Insurance', assists: [] },
  ];
  assert.deepEqual(computeGWG([{ result: 'W', ga: 1, goals }, { result: 'L', ga: 1, goals }]), { Winner: 1 });
  assert.deepEqual(computeScoringCombos([{ goals }]).map(combo => combo.scorer), ['First', 'Winner']);
});

test('penalty expiry precedes a simultaneous goal; missing clock metadata cannot become zero career PPP', () => {
  const game = {
    clockDirection: 'remaining', periods: [{ name: '1st', durationSeconds: 780 }],
    penalties: [{ period: '1st', time: '00:10:00', team: 'Other', minutes: 2 }],
    goals: [{ period: '1st', time: '00:08:00', team: 'Knights', scorer: 'Scorer', assists: [] }],
  };
  assert.equal(computeSpecialTeams([game]).ppGoals, 0);
  assert.equal(computeSpecialTeams([game, { ...game, clockDirection: undefined }]).available, false);
  assert.equal(computeSpecialTeams([{ ...game, periods: [{ name: '1st', durationSeconds: 0 }] }]).available, false);
});
