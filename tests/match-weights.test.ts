import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEloLeaderboard } from '../src/lib/elo';
import { deriveWeightedMatchEvents } from '../src/lib/matchWeights';
import { deriveChemistrySummaries, pairKey } from '../src/lib/socialStats';
import type { AmericanoTournament, Match2vs2, Player } from '../src/types';

const players: Player[] = [
  { id: 'alice', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bob', name: 'Bob', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cara', name: 'Cara', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dan', name: 'Dan', createdAt: '2026-01-01T00:00:00.000Z' },
];

const fullMatch: Match2vs2 = {
  id: 'full',
  type: '2vs2',
  date: '2026-04-01T10:00:00.000Z',
  team1: ['alice', 'bob'],
  team2: ['cara', 'dan'],
  setsToWin: 2,
  sets: [{ team1Games: 7, team2Games: 6 }, { team1Games: 6, team2Games: 4 }],
  winner: 1,
  status: 'completed',
  startedAt: '2026-04-01T10:00:00.000Z',
  completedAt: '2026-04-01T11:15:00.000Z',
};

const americano: AmericanoTournament = {
  id: 'am',
  type: 'americano-gross',
  date: '2026-04-02T10:00:00.000Z',
  players: ['alice', 'bob', 'cara', 'dan'],
  pointsToWin: 21,
  courts: 1,
  currentRound: 1,
  status: 'completed',
  games: [{
    id: 'short',
    round: 1,
    court: 1,
    team1: ['alice', 'bob'],
    team2: ['cara', 'dan'],
    team1Score: 21,
    team2Score: 18,
    status: 'completed',
    startedAt: '2026-04-02T10:00:00.000Z',
    completedAt: '2026-04-02T10:08:00.000Z',
  }],
};

test('weighted match events make full 2vs2 count more than short Americano and award non-negative XP', () => {
  const events = deriveWeightedMatchEvents([fullMatch, americano]);
  const full = events.find((event) => event.id === 'full');
  const short = events.find((event) => event.id === 'am:short');

  assert.ok(full && short);
  assert.ok(full.finalWeight > short.finalWeight);
  assert.ok(full.xpForWinner > short.xpForWinner);
  assert.ok(short.xpForLoser >= 0);
});

test('weighted ELO includes Americano but with smaller impact than a full match', () => {
  const fullOnly = calculateEloLeaderboard(players, [fullMatch]);
  const fullPlusShort = calculateEloLeaderboard(players, [fullMatch, americano]);
  const aliceFullOnly = fullOnly.find((row) => row.playerId === 'alice');
  const aliceWithShort = fullPlusShort.find((row) => row.playerId === 'alice');

  assert.ok(aliceFullOnly && aliceWithShort);
  assert.equal(aliceWithShort.matchesPlayed, 2);
  assert.ok(aliceWithShort.weightedMatchesPlayed < 2);
  assert.ok(aliceWithShort.currentElo > aliceFullOnly.currentElo);
  assert.ok(aliceWithShort.experience > aliceFullOnly.experience);
});

test('weighted chemistry uses Americano history with lower weighted volume', () => {
  const chemistry = deriveChemistrySummaries([fullMatch, americano]);
  const duo = chemistry.get(pairKey(['alice', 'bob']));

  assert.equal(duo?.matchesPlayed, 2);
  assert.ok((duo?.weightedMatchesPlayed ?? 0) < 2);
  assert.ok((duo?.chemistryScore ?? 0) > 45);
});
