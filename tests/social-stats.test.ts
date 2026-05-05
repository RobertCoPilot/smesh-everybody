import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveArchetypes,
  deriveChemistryScoreMap,
  deriveChemistrySummaries,
  deriveDuoTitles,
  derivePhase3SocialStats,
  deriveRivalries,
  deriveTeamBalanceOptions,
  pairKey,
} from '../src/lib/socialStats';
import type { GameRecord, Match1vs1, Match2vs2, Player } from '../src/types';

const players: Player[] = [
  { id: 'alice', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z', currentElo: 1120 },
  { id: 'bob', name: 'Bob', createdAt: '2026-01-01T00:00:00.000Z', currentElo: 1110 },
  { id: 'cara', name: 'Cara', createdAt: '2026-01-01T00:00:00.000Z', currentElo: 1010 },
  { id: 'dan', name: 'Dan', createdAt: '2026-01-01T00:00:00.000Z', currentElo: 1000 },
];

function doubles(id: string, date: string, winner: 1 | 2, sets: Array<[number, number]>, team1: [string, string] = ['alice', 'bob'], team2: [string, string] = ['cara', 'dan']): Match2vs2 {
  return {
    id,
    type: '2vs2',
    date,
    team1,
    team2,
    setsToWin: 2,
    sets: sets.map(([team1Games, team2Games]) => ({ team1Games, team2Games })),
    winner,
    status: 'completed',
  };
}

function singles(id: string, date: string, winner: 1 | 2, sets: Array<[number, number]>, player1 = 'alice', player2 = 'cara'): Match1vs1 {
  return {
    id,
    type: '1vs1',
    date,
    player1,
    player2,
    setsToWin: 2,
    sets: sets.map(([team1Games, team2Games]) => ({ team1Games, team2Games })),
    winner,
    status: 'completed',
  };
}

const rivalryGames: GameRecord[] = [
  doubles('d1', '2026-02-01T10:00:00.000Z', 1, [[7, 5], [6, 4]]),
  doubles('d2', '2026-02-02T10:00:00.000Z', 2, [[4, 6], [7, 6], [5, 7]]),
  doubles('d3', '2026-02-03T10:00:00.000Z', 1, [[6, 4], [6, 4]]),
  doubles('d4', '2026-02-04T10:00:00.000Z', 1, [[6, 1], [6, 2]]),
];

test('chemistry system tracks duo volume, win rate, differential and link strength', () => {
  const americanoHistory: GameRecord = {
    id: 'americano-history',
    type: 'americano-klein',
    date: '2026-02-06T10:00:00.000Z',
    players: ['alice', 'bob', 'cara', 'dan'],
    games: [{ id: 'a1', round: 1, court: 1, team1: ['alice', 'bob'], team2: ['cara', 'dan'], team1Score: 21, team2Score: 17, status: 'completed' }],
    pointsToWin: 21,
    courts: 1,
    currentRound: 1,
    status: 'completed',
  };
  const chemistry = deriveChemistrySummaries([...rivalryGames, americanoHistory]);
  const aliceBob = chemistry.get(pairKey(['bob', 'alice']));
  const caraDan = chemistry.get(pairKey(['cara', 'dan']));

  assert.equal(aliceBob?.matchesPlayed, 5);
  assert.equal(aliceBob?.wins, 4);
  assert.equal(aliceBob?.winRate, 0.8);
  assert.ok((aliceBob?.scoreDifferential ?? 0) > 0);
  assert.match(aliceBob?.linkStrength ?? '', /solid|strong|elite/);
  assert.equal(caraDan?.losses, 4);
});

test('chemistry score map gives current teammates a non-zero provisional score without direct duo history', () => {
  const scores = deriveChemistryScoreMap(rivalryGames, [['alice', 'dan']]);

  assert.ok(scores[pairKey(['alice', 'bob'])] > 0);
  assert.ok(scores[pairKey(['alice', 'dan'])] >= 20);
});

test('dynamic duo titles are deterministic and playful for active pairs', () => {
  const chemistry = deriveChemistrySummaries(rivalryGames);
  const titles = deriveDuoTitles(chemistry, players);
  const title = titles.get(pairKey(['alice', 'bob']));

  assert.equal(title?.title, 'Smash Syndicate');
  assert.match(title?.reason ?? '', /High win rate/);
  assert.equal(titles.has(pairKey(['cara', 'dan'])), true);
});

test('rivalry engine requires repeated close encounters and records recent winner history', () => {
  const noisyOneOff = singles('one-off', '2026-02-05T10:00:00.000Z', 1, [[6, 0], [6, 0]], 'alice', 'bob');
  const rivalries = deriveRivalries(players, [...rivalryGames, noisyOneOff], { minEncounters: 3, maxEloGap: 500 });
  const duoRivalry = rivalries.find((rivalry) => rivalry.entityType === 'duo');

  assert.equal(duoRivalry?.encounters, 4);
  assert.deepEqual(duoRivalry?.recentWinner, ['alice', 'bob']);
  assert.ok((duoRivalry?.intensity ?? 0) >= 60);
  assert.equal(rivalries.some((rivalry) => rivalry.rivalryKey.includes('alice|bob')), false);
});

test('archetype detection produces primary and secondary labels from close results and comebacks', () => {
  const games = [
    singles('c1', '2026-03-01T10:00:00.000Z', 1, [[4, 6], [7, 6], [7, 5]]),
    singles('c2', '2026-03-02T10:00:00.000Z', 1, [[6, 4], [7, 6]]),
    singles('c3', '2026-03-03T10:00:00.000Z', 2, [[6, 7], [4, 6]]),
    singles('c4', '2026-03-04T10:00:00.000Z', 1, [[5, 7], [6, 4], [7, 6]]),
  ];
  const alice = deriveArchetypes('alice', games);
  const bob = deriveArchetypes('bob', []);

  assert.equal(alice.primary, 'clutcher');
  assert.ok(alice.secondary);
  assert.ok(alice.reasons.some((reason) => reason.includes('tight')));
  assert.equal(bob.primary, 'rookie');
});

test('team balancer returns ranked unique options with explainable score and no duplicates', () => {
  const options = deriveTeamBalanceOptions(players, rivalryGames, ['alice', 'bob', 'cara', 'dan']);
  const canonical = options.map((option) => option.teams.map((team) => pairKey(team)).sort().join('|'));

  assert.equal(options.length, 3);
  assert.deepEqual([...new Set(canonical)], canonical);
  assert.ok(options[0].balanceScore >= options[1].balanceScore);
  assert.match(options[0].explanation, /ELO gap/);
  assert.equal(new Set(options[0].teams.flat()).size, 4);
});

test('phase 3 aggregate exposes chemistry, titles, rivalries and archetypes together', () => {
  const summary = derivePhase3SocialStats(players, rivalryGames);

  assert.equal(summary.chemistry.has(pairKey(['alice', 'bob'])), true);
  assert.equal(summary.duoTitles.has(pairKey(['alice', 'bob'])), true);
  assert.equal(summary.rivalries.length > 0, true);
  assert.equal(summary.archetypes.get('alice')?.playerId, 'alice');
});
