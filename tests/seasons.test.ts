import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SEASON_PASS_LEVELS,
  buildActiveChallenges,
  claimSeasonRewards,
  deriveChallengeProgress,
  deriveSeasonPassProgress,
  generateHallOfFame,
  generateSeasonAwards,
  generateWallOfShame,
  type SeasonWindow,
} from '../src/lib/seasons';
import { createRewardWallet } from '../src/lib/rewards';
import type { GameRecord, Match1vs1, Match2vs2, Player } from '../src/types';

const players: Player[] = [
  { id: 'alice', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bob', name: 'Bob', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cara', name: 'Cara', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dan', name: 'Dan', createdAt: '2026-01-01T00:00:00.000Z' },
];

const season: SeasonWindow = {
  id: 'summer-2026',
  label: 'Summer 2026',
  startsAt: '2026-06-01T00:00:00.000Z',
  endsAt: '2026-06-30T23:59:59.999Z',
  closed: true,
};

function doubles(id: string, day: number, winner: 1 | 2, sets: Array<[number, number]>): Match2vs2 {
  return {
    id,
    type: '2vs2',
    date: `2026-06-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    team1: ['alice', 'bob'],
    team2: ['cara', 'dan'],
    setsToWin: 2,
    sets: sets.map(([team1Games, team2Games]) => ({ team1Games, team2Games })),
    winner,
    status: 'completed',
    startedAt: `2026-06-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    completedAt: `2026-06-${String(day).padStart(2, '0')}T11:00:00.000Z`,
  };
}

const games: GameRecord[] = [
  doubles('m1', 2, 1, [[7, 6], [6, 4]]),
  doubles('m2', 3, 1, [[6, 4], [6, 4]]),
  doubles('m3', 4, 2, [[4, 6], [6, 7]]),
  {
    id: 's1',
    type: '1vs1',
    date: '2026-06-05T10:00:00.000Z',
    player1: 'alice',
    player2: 'cara',
    setsToWin: 2,
    sets: [{ team1Games: 7, team2Games: 6 }, { team1Games: 6, team2Games: 4 }],
    winner: 1,
    status: 'completed',
  } satisfies Match1vs1,
];

test('weekly challenges keep progress, completion, one-time reward flags and expired history', () => {
  const challenges = buildActiveChallenges(season).filter((challenge) => challenge.id === 'weekly-duo-wins' || challenge.id === 'weekly-close-call');
  const progress = deriveChallengeProgress(players, games, challenges, {
    asOf: '2026-07-01T00:00:00.000Z',
    grantedRewardKeys: new Set(['alice:weekly-duo-wins']),
  });

  const aliceDuo = progress.get('alice')?.find((row) => row.challengeId === 'weekly-duo-wins');
  const caraClose = progress.get('cara')?.find((row) => row.challengeId === 'weekly-close-call');
  assert.equal(aliceDuo?.completed, true);
  assert.equal(aliceDuo?.rewardGranted, true);
  assert.equal(aliceDuo?.expired, true);
  assert.ok((caraClose?.progress ?? 0) >= 2);
});

test('season pass derives levels from XP and claims rewards without deleting historical stats', () => {
  const config = { season, levels: DEFAULT_SEASON_PASS_LEVELS };
  const progress = deriveSeasonPassProgress('alice', games, config, [1]);
  const claimed = claimSeasonRewards(progress, createRewardWallet('alice'), config, undefined, '2026-07-01T00:00:00.000Z');

  assert.equal(progress.playerId, 'alice');
  assert.ok(progress.xp > 0);
  assert.equal(progress.claimedLevels.includes(1), true);
  assert.ok(claimed.claimedLevels.length >= progress.claimedLevels.length);
  assert.ok(claimed.wallet.balance >= 0);
});

test('season awards are automatic, immutable and use safe playful copy', () => {
  const awards = generateSeasonAwards(players, games, season);

  assert.equal(awards.some((award) => award.awardId === 'mvp'), true);
  assert.equal(awards.some((award) => award.awardId === 'best-duo'), true);
  assert.equal(awards.every((award) => award.immutable), true);
  assert.equal(awards.every((award) => !/idiot|trash|stupid/i.test(award.copy)), true);
});

test('hall of fame records are immutable category archives that link to players or duos', () => {
  const records = generateHallOfFame(players, games, [season], '2026-07-01T00:00:00.000Z');

  assert.equal(records.some((record) => record.category === 'highest-elo'), true);
  assert.equal(records.some((record) => record.category === 'best-duo'), true);
  assert.equal(records.every((record) => record.immutable && record.subjectIds.length > 0), true);
});

test('wall of shame is opt-out, measurable, hidden-capable and non-toxic', () => {
  const visible = generateWallOfShame(players, games, season);
  const hidden = generateWallOfShame(players, games, season, new Set(visible.map((record) => record.id)));

  assert.ok(visible.length > 0);
  assert.equal(visible.every((record) => record.safeCopy && !record.hidden), true);
  assert.equal(hidden.every((record) => record.hidden), true);
  assert.equal(visible.every((record) => !/idiot|trash|stupid/i.test(record.copy)), true);
});
