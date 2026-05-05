import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_COSMETIC_PACK,
  DEFAULT_COSMETICS,
  applyRewardTransaction,
  createRewardWallet,
  deriveCardEffectState,
  deriveRewardWalletsFromMatches,
  equipOwnedCosmetic,
  openCosmeticPack,
  purchaseCosmetic,
} from '../src/lib/phase4Rewards';
import type { AmericanoTournament, Match2vs2, Player } from '../src/types';

const players: Player[] = [
  { id: 'alice', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'bob', name: 'Bob', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cara', name: 'Cara', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'dan', name: 'Dan', createdAt: '2026-01-01T00:00:00.000Z' },
];

const fullMatch: Match2vs2 = {
  id: 'full-final',
  type: '2vs2',
  date: '2026-05-01T10:00:00.000Z',
  team1: ['alice', 'bob'],
  team2: ['cara', 'dan'],
  setsToWin: 2,
  sets: [{ team1Games: 7, team2Games: 6 }, { team1Games: 6, team2Games: 4 }],
  winner: 1,
  status: 'completed',
  startedAt: '2026-05-01T10:00:00.000Z',
  completedAt: '2026-05-01T11:20:00.000Z',
};

const americano: AmericanoTournament = {
  id: 'big-americano',
  type: 'americano-gross',
  date: '2026-05-02T10:00:00.000Z',
  players: ['alice', 'bob', 'cara', 'dan'],
  games: [{
    id: 'round-1',
    round: 1,
    court: 1,
    team1: ['alice', 'cara'],
    team2: ['bob', 'dan'],
    team1Score: 21,
    team2Score: 19,
    status: 'completed',
    startedAt: '2026-05-02T10:00:00.000Z',
    completedAt: '2026-05-02T10:10:00.000Z',
  }],
  pointsToWin: 21,
  courts: 1,
  currentRound: 1,
  status: 'completed',
};

test('senior user flow: match rewards create auditable wallet transactions and never go negative', () => {
  const wallets = deriveRewardWalletsFromMatches(players, [fullMatch, americano], '2026-05-03T00:00:00.000Z');
  const aliceWallet = wallets.get('alice');
  const danWallet = wallets.get('dan');

  assert.ok(aliceWallet);
  assert.ok(danWallet);
  assert.equal(aliceWallet.transactions.length, 2);
  assert.equal(aliceWallet.transactions.every((tx) => tx.type === 'earn' && tx.reason === 'match'), true);
  assert.equal(aliceWallet.transactions.at(-1)?.balanceAfter, aliceWallet.balance);
  assert.ok(aliceWallet.balance > danWallet.balance);
  assert.throws(() => applyRewardTransaction(createRewardWallet('alice'), {
    playerId: 'alice',
    type: 'spend',
    reason: 'cosmetic-purchase',
    amount: -1,
    sourceId: 'anything',
    createdAt: '2026-05-03T00:00:00.000Z',
  }), /cannot go negative/);
});

test('senior user flow: only owned cosmetics can be equipped and purchases are auditable', () => {
  const wallet = createRewardWallet('alice', 200);
  const frame = DEFAULT_COSMETICS.find((cosmetic) => cosmetic.id === 'frame-clay-common');
  assert.ok(frame);

  assert.throws(() => equipOwnedCosmetic({
    playerId: 'alice',
    equipped: { playerId: 'alice' },
    inventory: [],
    cosmetic: frame,
  }), /not owned/);

  const purchased = purchaseCosmetic({ wallet, inventory: [], cosmetic: frame, now: '2026-05-03T00:00:00.000Z' });
  const equipped = equipOwnedCosmetic({
    playerId: 'alice',
    equipped: { playerId: 'alice' },
    inventory: purchased.inventory,
    cosmetic: frame,
  });

  assert.equal(purchased.wallet.balance, 140);
  assert.equal(purchased.wallet.transactions[0].reason, 'cosmetic-purchase');
  assert.equal(equipped.frameId, frame.id);
});

test('senior user flow: pack openings are cosmetic-only, seeded, persisted atomically and replay-safe', () => {
  const wallet = createRewardWallet('alice', 500);
  const first = openCosmeticPack({
    wallet,
    inventory: [],
    pack: DEFAULT_COSMETIC_PACK,
    catalog: DEFAULT_COSMETICS,
    openingId: 'opening-1',
    now: '2026-05-03T00:00:00.000Z',
  });
  const secondSameSeed = openCosmeticPack({
    wallet,
    inventory: [],
    pack: DEFAULT_COSMETIC_PACK,
    catalog: DEFAULT_COSMETICS,
    openingId: 'opening-1',
    now: '2026-05-03T00:00:00.000Z',
  });

  assert.deepEqual(first.rewards.map((reward) => reward.id), secondSameSeed.rewards.map((reward) => reward.id));
  assert.equal(first.rewards.every((reward) => ['banner', 'frame', 'emote', 'flair', 'animated-profile'].includes(reward.type)), true);
  assert.equal(first.wallet.balance, 380);
  assert.equal(first.transaction.reason, 'pack-purchase');
  assert.throws(() => openCosmeticPack({
    wallet: first.wallet,
    inventory: first.inventory,
    openingId: 'opening-1',
  }), /already been processed/);
});

test('card effects are state-driven and respect reduced motion', () => {
  const walkout = deriveCardEffectState({ streakKind: 'win', streakCount: 5, chemistryScore: 88, rarity: 'legendary' });
  const reduced = deriveCardEffectState({ streakKind: 'win', streakCount: 5, chemistryScore: 88, rarity: 'legendary', reducedMotion: true });

  assert.equal(walkout.flairLabel, 'Walkout');
  assert.equal(walkout.animated, true);
  assert.equal(reduced.animated, false);
  assert.ok(walkout.borderClassName.includes('ring'));
});
