import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateActivityStatus,
  calculateAwardProgress,
  calculatePrimeRating,
  calculatePlayerStreaks,
  derivePhase2Engagement,
} from '../src/lib/engagement';
import type { GameRecord, Player } from '../src/types';

const players: Player[] = [
  { id: 'alice', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bob', name: 'Bob', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cara', name: 'Cara', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dan', name: 'Dan', createdAt: '2026-01-01T00:00:00.000Z' },
];

function match(id: string, date: string, winner: 1 | 2, sets: Array<[number, number]>, team1 = ['alice'], team2 = ['bob']): GameRecord {
  if (team1.length === 1 && team2.length === 1) {
    return {
      id,
      type: '1vs1',
      date,
      player1: team1[0],
      player2: team2[0],
      setsToWin: 2,
      sets: sets.map(([team1Games, team2Games]) => ({ team1Games, team2Games })),
      winner,
      status: 'completed',
    };
  }

  return {
    id,
    type: '2vs2',
    date,
    team1: [team1[0], team1[1]],
    team2: [team2[0], team2[1]],
    setsToWin: 2,
    sets: sets.map(([team1Games, team2Games]) => ({ team1Games, team2Games })),
    winner,
    status: 'completed',
  };
}

test('streak engine tracks current, best, losing, comeback, hot and cold form chronologically', () => {
  const games = [
    match('later-loss', '2026-02-04T10:00:00.000Z', 2, [[3, 6], [4, 6]]),
    match('first-win', '2026-02-01T10:00:00.000Z', 1, [[6, 4], [6, 4]]),
    match('comeback-win', '2026-02-02T10:00:00.000Z', 1, [[4, 6], [6, 4], [7, 5]]),
    match('third-win', '2026-02-03T10:00:00.000Z', 1, [[7, 6], [6, 4]]),
  ];

  const alice = calculatePlayerStreaks('alice', games);
  assert.equal(alice.current.kind, 'loss');
  assert.equal(alice.current.count, 1);
  assert.equal(alice.bestWinStreak, 3);
  assert.equal(alice.bestLosingStreak, 1);
  assert.equal(alice.comebackWins, 1);
  assert.equal(alice.recentForm, 'hot');

  const bob = calculatePlayerStreaks('bob', games);
  assert.equal(bob.current.kind, 'win');
  assert.equal(bob.current.count, 1);
  assert.equal(bob.bestLosingStreak, 3);
  assert.equal(bob.recentForm, 'cold');
});

test('awards are deterministic, de-duplicated by stable ids and include source context', () => {
  const games = [
    match('w1', '2026-03-01T10:00:00.000Z', 1, [[6, 1], [6, 1]]),
    match('w2', '2026-03-02T10:00:00.000Z', 1, [[6, 4], [6, 4]]),
    match('w3', '2026-03-03T10:00:00.000Z', 1, [[4, 6], [6, 4], [6, 4]]),
    match('doubles', '2026-03-04T10:00:00.000Z', 1, [[6, 4], [6, 4]], ['alice', 'cara'], ['bob', 'dan']),
  ];

  const awards = calculateAwardProgress(players[0], games, { asOf: '2026-03-05T00:00:00.000Z' });
  const ids = awards.earned.map((award) => award.id);
  assert.deepEqual([...new Set(ids)], ids);
  assert.ok(ids.includes('first-win'));
  assert.ok(ids.includes('hat-trick'));
  assert.ok(ids.includes('comeback-kid'));
  assert.ok(ids.includes('doubles-debut'));
  assert.equal(awards.earned.find((award) => award.id === 'hat-trick')?.sourceGameId, 'w3');
});

test('prime rating preserves historical peaks and immutable season snapshots independently of current ELO', () => {
  const games = [
    match('s1-a', '2026-01-10T10:00:00.000Z', 1, [[6, 3], [6, 3]]),
    match('s1-b', '2026-01-11T10:00:00.000Z', 1, [[6, 4], [6, 4]]),
    match('s2-loss', '2026-04-10T10:00:00.000Z', 2, [[2, 6], [4, 6]]),
  ];

  const prime = calculatePrimeRating(players[0], players, games, {
    seasons: [
      { id: 'winter-2026', label: 'Winter 2026', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-03-31T23:59:59.999Z', closed: true },
      { id: 'spring-2026', label: 'Spring 2026', startsAt: '2026-04-01T00:00:00.000Z', endsAt: '2026-06-30T23:59:59.999Z', closed: false },
    ],
  });

  assert.ok(prime.primeElo > prime.currentElo);
  assert.equal(prime.bestSeason?.id, 'winter-2026');
  assert.equal(prime.seasonSnapshots.every((snapshot) => snapshot.immutable), true);
});

test('activity decay reports active/rusty/inactive confidence without mutating elo or historical events', () => {
  const rusty = calculateActivityStatus('alice', [match('old', '2026-02-01T10:00:00.000Z', 1, [[6, 4], [6, 4]])], {
    asOf: '2026-03-20T00:00:00.000Z',
    rustyAfterDays: 21,
    inactiveAfterDays: 60,
  });
  assert.equal(rusty.status, 'rusty');
  assert.equal(rusty.confidence, 70);
  assert.equal(rusty.visualState, 'rusty');

  const active = calculateActivityStatus('alice', [match('return', '2026-03-19T10:00:00.000Z', 2, [[4, 6], [4, 6]])], {
    asOf: '2026-03-20T00:00:00.000Z',
  });
  assert.equal(active.status, 'active');
  assert.equal(active.confidence, 100);
});

test('phase 2 aggregate exposes all issue data for cards, profiles and rankings', () => {
  const games = [match('m1', '2026-05-01T10:00:00.000Z', 1, [[6, 0], [6, 0]])];
  const engagement = derivePhase2Engagement(players, games, { asOf: '2026-05-02T00:00:00.000Z' });
  assert.equal(engagement.get('alice')?.streaks.current.kind, 'win');
  assert.equal(engagement.get('alice')?.awards.earned.some((award) => award.id === 'first-win'), true);
  assert.equal(engagement.get('alice')?.activity.status, 'active');
  assert.equal(engagement.get('alice')?.prime.primeElo, engagement.get('alice')?.prime.currentElo);
});
