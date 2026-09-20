import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAwards } from '../src/awards.js';
import { upcomingGames, formatGameTime } from '../src/schedule.js';

test('empty or zero-game rosters have no automatic winners and never crash', () => {
  assert.deepEqual(computeAwards([], []), []);
  assert.deepEqual(computeAwards([{ player: 'New skater', gp: 0, g: 0, a: 0, p: 0, pm: 0 }], [{ player: 'New goalie', gp: 0 }]), []);
});

test('unplayed roster entries cannot win fewest penalties', () => {
  const awards = computeAwards([
    { player: 'Unplayed', gp: 0, g: 0, a: 0, p: 0, pm: 0 },
    { player: 'Played', gp: 1, g: 2, a: 1, p: 3, pm: 2 },
  ], []);
  assert.equal(awards.find(a => a.name === 'Ghost Checker').winner, 'Played');
});

test('goalie award does not depend on skater stats', () => {
  assert.equal(computeAwards([], [{ player: 'Goalie', gp: 1 }])[0].winner, 'Goalie');
});

test('manual historical awards preserve multiple winners', () => {
  assert.deepEqual(computeAwards([], [], [{ name: 'Glue', winners: ['A', 'B'] }])[0].winner, 'A, B');
});

test('upcoming games are chronological, omit past/invalid dates, and do not mutate input', () => {
  const games = [
    { id: 2, startsAt: '2026-10-02T03:00:00Z' },
    { id: 0, startsAt: '2026-09-01T03:00:00Z' },
    { id: 1, startsAt: '2026-10-01T03:00:00Z' },
    { id: 3, startsAt: 'invalid' },
  ];
  assert.deepEqual(upcomingGames(games, Date.parse('2026-09-20T00:00:00Z')).map(g => g.id), [1, 2]);
  assert.equal(games[0].id, 2);
});

test('game time displays Vancouver date even when UTC date is the next day', () => {
  const formatted = formatGameTime('2026-09-20T03:00:00Z');
  assert.match(formatted, /19/);
  assert.match(formatted, /8:00/);
});

// Regression coverage for the audit findings.
import { loadStatsFile, teamSavePercentage } from '../src/stats.js';
import { computeSpecialTeams } from '../src/specialTeams.js';
import { readFileSync } from 'node:fs';

test('team save percentage weights saves by shots, including backups', () => {
  assert.equal(teamSavePercentage([{ sv: 90, sa: 100 }, { sv: 5, sa: 10 }]), 95 / 110);
  assert.equal(teamSavePercentage([]), null);
  assert.equal(teamSavePercentage([{ sv: 0, sa: 0 }]), null);
});

test('data downloads distinguish failures, optional missing files, and empty stats', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('missing', { status: 404 }));
  assert.ok((await loadStatsFile('/required', JSON.parse)).error);
  assert.equal((await loadStatsFile('/optional', JSON.parse, true)).missing, true);
  globalThis.fetch = async () => new Response('<!doctype html><html></html>');
  assert.equal((await loadStatsFile('/optional', JSON.parse, true)).missing, true);
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  assert.ok((await loadStatsFile('/optional', JSON.parse, true)).error);
  globalThis.fetch = async () => new Response('[]');
  assert.deepEqual(await loadStatsFile('/empty', JSON.parse), { data: [] });
  globalThis.fetch = async () => new Response('{}');
  assert.ok((await loadStatsFile('/malformed', JSON.parse)).error);
});

test('September 19 countdown timeline yields one goal against in three penalty kills', () => {
  const recaps = JSON.parse(readFileSync(new URL('./fixtures/confirmed-game.json', import.meta.url)));
  const stats = computeSpecialTeams(recaps);
  assert.equal(stats.available, true);
  assert.equal(stats.pkGA, 1);
  assert.equal(stats.pkSit, 3);
  assert.equal(stats.pkPct.toFixed(1), '66.7');
});

test('a penalty carries across actual period boundaries with either clock direction', () => {
  for (const clockDirection of ['remaining', 'elapsed']) {
    const game = {
      clockDirection,
      periods: [{ name: '1st', durationSeconds: 780 }, { name: '2nd', durationSeconds: 780 }],
      penalties: [{ period: '1st', time: clockDirection === 'remaining' ? '00:00:30' : '00:12:30', team: 'Other', minutes: 2 }],
      goals: [{ period: '2nd', time: clockDirection === 'remaining' ? '00:12:00' : '00:01:00', team: 'Knights', scorer: 'Scorer', assists: ['Assist'] }],
    };
    const stats = computeSpecialTeams([game]);
    assert.equal(stats.ppGoals, 1);
    assert.deepEqual(stats.playerPPP, { Scorer: 1, Assist: 1 });
    assert.equal(computeSpecialTeams([{ ...game, clockDirection: undefined }]).available, false);
  }
});
