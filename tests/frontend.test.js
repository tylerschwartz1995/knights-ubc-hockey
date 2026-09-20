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
