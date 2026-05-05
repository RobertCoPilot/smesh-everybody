import { deriveWeightedMatchEvents, type WeightedMatchEvent } from './matchWeights';
import type { GameRecord, Player } from '@/types';

export type RewardCurrency = 'smeshCoins';
export type RewardTransactionType = 'earn' | 'spend' | 'refund';
export type RewardReason = 'match' | 'challenge' | 'pack-purchase' | 'cosmetic-purchase' | 'admin-adjustment';
export type CosmeticType = 'banner' | 'frame' | 'emote' | 'flair' | 'animated-profile';
export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RewardFormulaConfig {
  matchBaseCoins: number;
  matchWeightedCoins: number;
  matchWinnerBonusCoins: number;
  closeMatchBonusCoins: number;
  closeMatchFactorThreshold: number;
  fullMatchMinimumCoins: number;
}

export const REWARD_FORMULA_CONFIG: RewardFormulaConfig = {
  matchBaseCoins: 5,
  matchWeightedCoins: 18,
  matchWinnerBonusCoins: 7,
  closeMatchBonusCoins: 4,
  closeMatchFactorThreshold: 1.15,
  fullMatchMinimumCoins: 12,
};

export interface RewardTransaction {
  id: string;
  playerId: string;
  currency: RewardCurrency;
  type: RewardTransactionType;
  reason: RewardReason;
  amount: number;
  balanceAfter: number;
  sourceId: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RewardWallet {
  playerId: string;
  currency: RewardCurrency;
  balance: number;
  transactions: RewardTransaction[];
}

export interface CosmeticDefinition {
  id: string;
  name: string;
  type: CosmeticType;
  rarity: CosmeticRarity;
  price: number;
  cardClassName?: string;
  label?: string;
}

export interface PlayerCosmeticInventoryItem {
  playerId: string;
  cosmeticId: string;
  acquiredAt: string;
  source: 'purchase' | 'pack' | 'reward' | 'default';
}

export interface EquippedCosmetics {
  playerId: string;
  bannerId?: string;
  frameId?: string;
  emoteId?: string;
  flairId?: string;
  animatedProfileId?: string;
}

export interface PackSlotOdds {
  rarity: CosmeticRarity;
  weight: number;
}

export interface CosmeticPackDefinition {
  id: string;
  name: string;
  cost: number;
  slots: number;
  odds: PackSlotOdds[];
}

export interface PackOpeningResult {
  openingId: string;
  wallet: RewardWallet;
  inventory: PlayerCosmeticInventoryItem[];
  rewards: CosmeticDefinition[];
  transaction: RewardTransaction;
}

export interface CardEffectState {
  glowClassName: string;
  borderClassName: string;
  flairLabel: string | null;
  intensity: number;
  animated: boolean;
}

export const DEFAULT_COSMETICS: CosmeticDefinition[] = [
  { id: 'frame-clay-common', name: 'Sandplatz-Rahmen', type: 'frame', rarity: 'common', price: 60, cardClassName: 'ring-2 ring-orange-300/70' },
  { id: 'frame-neon-rare', name: 'Neon-Rahmen', type: 'frame', rarity: 'rare', price: 140, cardClassName: 'ring-2 ring-cyan-300/80' },
  { id: 'flair-hot-epic', name: 'Siegesserien-Funken', type: 'flair', rarity: 'epic', price: 260, cardClassName: 'after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_50%_0%,rgba(250,82,15,.28),transparent_45%)]' },
  { id: 'banner-golden-legendary', name: 'Golden-Hour-Banner', type: 'banner', rarity: 'legendary', price: 500, cardClassName: 'shadow-[0_0_38px_rgba(250,82,15,.38)]' },
  { id: 'emote-smash-common', name: 'Smash-Emote', type: 'emote', rarity: 'common', price: 40, label: '💥' },
  { id: 'profile-pulse-rare', name: 'Puls-Profil', type: 'animated-profile', rarity: 'rare', price: 180, cardClassName: 'motion-safe:animate-pulse' },
];

export const DEFAULT_COSMETIC_PACK: CosmeticPackDefinition = {
  id: 'starter-cosmetic-pack',
  name: 'Starter-Kosmetikpack',
  cost: 120,
  slots: 3,
  odds: [
    { rarity: 'common', weight: 70 },
    { rarity: 'rare', weight: 22 },
    { rarity: 'epic', weight: 7 },
    { rarity: 'legendary', weight: 1 },
  ],
};

export function createRewardWallet(playerId: string, balance = 0): RewardWallet {
  return { playerId, currency: 'smeshCoins', balance, transactions: [] };
}

function transactionId(playerId: string, sourceId: string, reason: RewardReason, amount: number): string {
  return `${playerId}:${reason}:${sourceId}:${amount}`;
}

export function applyRewardTransaction(
  wallet: RewardWallet,
  transaction: Omit<RewardTransaction, 'id' | 'balanceAfter' | 'currency'> & { id?: string },
): RewardWallet {
  if (transaction.playerId !== wallet.playerId) throw new Error('Transaktion passt nicht zum Wallet-Spieler.');
  if (wallet.transactions.some((entry) => entry.id === transaction.id)) return wallet;
  const nextBalance = wallet.balance + transaction.amount;
  if (nextBalance < 0) throw new Error('Reward-Wallet darf nicht ins Minus gehen.');
  const fullTransaction: RewardTransaction = {
    ...transaction,
    id: transaction.id ?? transactionId(transaction.playerId, transaction.sourceId, transaction.reason, transaction.amount),
    currency: wallet.currency,
    balanceAfter: nextBalance,
  };
  return { ...wallet, balance: nextBalance, transactions: [...wallet.transactions, fullTransaction] };
}

export function calculateMatchCoins(event: WeightedMatchEvent, winner: boolean, config = REWARD_FORMULA_CONFIG): number {
  const closeBonus = event.closenessFactor >= config.closeMatchFactorThreshold ? config.closeMatchBonusCoins : 0;
  const coins = config.matchBaseCoins + config.matchWeightedCoins * event.finalWeight + (winner ? config.matchWinnerBonusCoins * event.finalWeight : 0) + closeBonus;
  return Math.max(event.sourceType === '2vs2' ? config.fullMatchMinimumCoins : 1, Math.round(coins));
}

export function deriveRewardWalletsFromMatches(players: Player[], games: GameRecord[], now = new Date().toISOString()): Map<string, RewardWallet> {
  const wallets = new Map(players.map((player) => [player.id, createRewardWallet(player.id)]));
  for (const event of deriveWeightedMatchEvents(games)) {
    for (const playerId of [...event.team1, ...event.team2]) {
      const wallet = wallets.get(playerId);
      if (!wallet) continue;
      const won = event.winner === 1 ? event.team1.includes(playerId) : event.team2.includes(playerId);
      wallets.set(playerId, applyRewardTransaction(wallet, {
        id: transactionId(playerId, event.id, 'match', calculateMatchCoins(event, won)),
        playerId,
        type: 'earn',
        reason: 'match',
        amount: calculateMatchCoins(event, won),
        sourceId: event.id,
        createdAt: now,
        metadata: { matchWeight: event.finalWeight, sourceType: event.sourceType, won },
      }));
    }
  }
  return wallets;
}

function inventoryOwns(inventory: PlayerCosmeticInventoryItem[], playerId: string, cosmeticId: string): boolean {
  return inventory.some((item) => item.playerId === playerId && item.cosmeticId === cosmeticId);
}

function equipKeyForType(type: CosmeticType): keyof Omit<EquippedCosmetics, 'playerId'> {
  if (type === 'animated-profile') return 'animatedProfileId';
  return `${type}Id` as keyof Omit<EquippedCosmetics, 'playerId'>;
}

export function purchaseCosmetic({
  wallet,
  inventory,
  cosmetic,
  now = new Date().toISOString(),
}: {
  wallet: RewardWallet;
  inventory: PlayerCosmeticInventoryItem[];
  cosmetic: CosmeticDefinition;
  now?: string;
}): { wallet: RewardWallet; inventory: PlayerCosmeticInventoryItem[]; item: PlayerCosmeticInventoryItem } {
  if (inventoryOwns(inventory, wallet.playerId, cosmetic.id)) {
    const item = inventory.find((entry) => entry.playerId === wallet.playerId && entry.cosmeticId === cosmetic.id)!;
    return { wallet, inventory, item };
  }
  const nextWallet = applyRewardTransaction(wallet, {
    playerId: wallet.playerId,
    type: 'spend',
    reason: 'cosmetic-purchase',
    amount: -cosmetic.price,
    sourceId: cosmetic.id,
    createdAt: now,
  });
  const item = { playerId: wallet.playerId, cosmeticId: cosmetic.id, acquiredAt: now, source: 'purchase' as const };
  return { wallet: nextWallet, inventory: [...inventory, item], item };
}

export function equipOwnedCosmetic({
  playerId,
  equipped,
  inventory,
  cosmetic,
}: {
  playerId: string;
  equipped: EquippedCosmetics;
  inventory: PlayerCosmeticInventoryItem[];
  cosmetic: CosmeticDefinition;
}): EquippedCosmetics {
  if (equipped.playerId !== playerId) throw new Error('Ausgerüstete Kosmetik passt nicht zum Spieler.');
  if (!inventoryOwns(inventory, playerId, cosmetic.id)) throw new Error('Nur eigene Kosmetik kann ausgerüstet werden.');
  return { ...equipped, [equipKeyForType(cosmetic.type)]: cosmetic.id };
}

function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6D2B79F5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRarity(odds: PackSlotOdds[], random: () => number): CosmeticRarity {
  const total = odds.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of odds) {
    roll -= item.weight;
    if (roll <= 0) return item.rarity;
  }
  return odds.at(-1)?.rarity ?? 'common';
}

export function openCosmeticPack({
  wallet,
  inventory,
  pack = DEFAULT_COSMETIC_PACK,
  catalog = DEFAULT_COSMETICS,
  openingId,
  now = new Date().toISOString(),
}: {
  wallet: RewardWallet;
  inventory: PlayerCosmeticInventoryItem[];
  pack?: CosmeticPackDefinition;
  catalog?: CosmeticDefinition[];
  openingId: string;
  now?: string;
}): PackOpeningResult {
  if (wallet.transactions.some((entry) => entry.sourceId === openingId && entry.reason === 'pack-purchase')) {
    throw new Error('Pack-Öffnung wurde bereits verarbeitet.');
  }
  const random = seededRandom(`${wallet.playerId}:${openingId}`);
  const nextWallet = applyRewardTransaction(wallet, {
    playerId: wallet.playerId,
    type: 'spend',
    reason: 'pack-purchase',
    amount: -pack.cost,
    sourceId: openingId,
    createdAt: now,
    metadata: { packId: pack.id },
  });
  const rewards: CosmeticDefinition[] = [];
  const nextInventory = [...inventory];
  for (let slot = 0; slot < pack.slots; slot += 1) {
    const rarity = pickRarity(pack.odds, random);
    const candidates = catalog.filter((cosmetic) => cosmetic.rarity === rarity);
    const pool = candidates.length > 0 ? candidates : catalog;
    const reward = pool[Math.floor(random() * pool.length) % pool.length];
    rewards.push(reward);
    if (!inventoryOwns(nextInventory, wallet.playerId, reward.id)) {
      nextInventory.push({ playerId: wallet.playerId, cosmeticId: reward.id, acquiredAt: now, source: 'pack' });
    }
  }
  const transaction = nextWallet.transactions.at(-1)!;
  return { openingId, wallet: nextWallet, inventory: nextInventory, rewards, transaction };
}

export function deriveCardEffectState({
  streakKind,
  streakCount = 0,
  chemistryScore = 0,
  rarity = 'common',
  reducedMotion = false,
}: {
  streakKind?: 'win' | 'loss' | 'none';
  streakCount?: number;
  chemistryScore?: number;
  rarity?: CosmeticRarity;
  reducedMotion?: boolean;
}): CardEffectState {
  const rarityIntensity = rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
  const streakIntensity = streakKind === 'win' ? Math.min(streakCount, 5) : 0;
  const chemistryIntensity = chemistryScore >= 85 ? 4 : chemistryScore >= 70 ? 3 : chemistryScore >= 50 ? 2 : chemistryScore > 0 ? 1 : 0;
  const intensity = Math.max(rarityIntensity, streakIntensity, chemistryIntensity);
  return {
    intensity,
    animated: !reducedMotion && intensity >= 3,
    flairLabel: intensity >= 4 ? 'Walkout' : streakIntensity >= 3 ? 'Heißlauf' : chemistryIntensity >= 3 ? 'Duo-Glanz' : null,
    glowClassName: intensity >= 4 ? 'shadow-[0_0_42px_rgba(250,82,15,0.55)]' : intensity >= 3 ? 'shadow-[0_0_30px_rgba(59,130,246,0.42)]' : '',
    borderClassName: intensity >= 4 ? 'motion-safe:animate-pulse ring-2 ring-orange-300/80' : intensity >= 3 ? 'ring-2 ring-sky-300/70' : '',
  };
}
