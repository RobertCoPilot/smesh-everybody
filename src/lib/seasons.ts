import { calculateEloLeaderboard } from './elo';
import { calculatePlayerStreaks } from './engagement';
import { deriveWeightedMatchEvents } from './matchWeights';
import { DEFAULT_COSMETICS, applyRewardTransaction, type CosmeticDefinition, type RewardWallet } from './rewards';
import { deriveChemistrySummaries, pairKey } from './socialStats';
import type { GameRecord, Player } from '@/types';

export type ChallengeMetric = 'matches-played' | 'wins' | 'close-matches' | 'americano-games' | 'duo-wins';
export type SeasonAwardId = 'mvp' | 'best-duo' | 'clutch-player' | 'most-improved' | 'steady-presence';
export type ShameAwardId = 'almost-comeback' | 'tough-week' | 'comeback-practice';
export type HallOfFameCategory = 'highest-elo' | 'best-duo' | 'longest-streak' | 'legendary-season';

export interface SeasonWindow {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  closed: boolean;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  xpReward: number;
  coinReward: number;
  cosmeticRewardId?: string;
}

export interface ActiveChallenge extends ChallengeTemplate {
  seasonId: string;
  startsAt: string;
  endsAt: string;
}

export interface ChallengeProgress {
  challengeId: string;
  playerId: string;
  progress: number;
  target: number;
  completed: boolean;
  expired: boolean;
  rewardGranted: boolean;
}

export interface SeasonLevelReward {
  level: number;
  xpRequired: number;
  coinReward?: number;
  cosmeticRewardId?: string;
}

export interface SeasonPassConfig {
  season: SeasonWindow;
  levels: SeasonLevelReward[];
}

export interface SeasonPassProgress {
  playerId: string;
  seasonId: string;
  xp: number;
  level: number;
  claimableRewards: SeasonLevelReward[];
  claimedLevels: number[];
}

export interface ClaimedSeasonReward {
  wallet: RewardWallet;
  claimedLevels: number[];
  cosmetics: CosmeticDefinition[];
}

export interface SeasonAwardRecord {
  id: string;
  seasonId: string;
  awardId: SeasonAwardId;
  title: string;
  subjectIds: string[];
  score: number;
  copy: string;
  immutable: true;
}

export interface HallOfFameRecord {
  id: string;
  category: HallOfFameCategory;
  seasonId?: string;
  subjectIds: string[];
  value: number;
  label: string;
  recordedAt: string;
  immutable: true;
}

export interface WallOfShameRecord {
  id: string;
  seasonId: string;
  awardId: ShameAwardId;
  subjectIds: string[];
  value: number;
  copy: string;
  hidden: boolean;
  safeCopy: true;
  immutable: true;
}

export const DEFAULT_WEEKLY_CHALLENGES: ChallengeTemplate[] = [
  { id: 'weekly-match-volume', title: 'Stammgast am Court', description: 'Spiele diese Woche 3 gewichtete Matches.', metric: 'matches-played', target: 3, xpReward: 120, coinReward: 40 },
  { id: 'weekly-close-call', title: 'Nervenprobe', description: 'Spiele 2 enge Matches.', metric: 'close-matches', target: 2, xpReward: 100, coinReward: 35 },
  { id: 'weekly-americano-grind', title: 'Americano-Motor', description: 'Schließe 5 Americano-Spiele ab.', metric: 'americano-games', target: 5, xpReward: 90, coinReward: 30 },
  { id: 'weekly-duo-wins', title: 'Duo-Schicht', description: 'Gewinne zweimal als Zweierteam.', metric: 'duo-wins', target: 2, xpReward: 130, coinReward: 45, cosmeticRewardId: 'emote-smash-common' },
];

export const DEFAULT_SEASON_PASS_LEVELS: SeasonLevelReward[] = [
  { level: 1, xpRequired: 0, coinReward: 25 },
  { level: 2, xpRequired: 150, coinReward: 50 },
  { level: 3, xpRequired: 350, cosmeticRewardId: 'frame-clay-common' },
  { level: 4, xpRequired: 650, coinReward: 100 },
  { level: 5, xpRequired: 1000, cosmeticRewardId: 'frame-neon-rare' },
];

function inWindow(date: string, window: { startsAt: string; endsAt: string }): boolean {
  const time = new Date(date).getTime();
  return time >= new Date(window.startsAt).getTime() && time <= new Date(window.endsAt).getTime();
}

export function buildActiveChallenges(season: SeasonWindow, templates = DEFAULT_WEEKLY_CHALLENGES): ActiveChallenge[] {
  return templates.map((template) => ({ ...template, seasonId: season.id, startsAt: season.startsAt, endsAt: season.endsAt }));
}

export function deriveChallengeProgress(
  players: Player[],
  games: GameRecord[],
  challenges: ActiveChallenge[],
  options: { asOf?: string; grantedRewardKeys?: Set<string> } = {},
): Map<string, ChallengeProgress[]> {
  const events = deriveWeightedMatchEvents(games);
  const asOfTime = new Date(options.asOf ?? new Date().toISOString()).getTime();
  const result = new Map<string, ChallengeProgress[]>();

  for (const player of players) {
    const rows: ChallengeProgress[] = [];
    for (const challenge of challenges) {
      const scoped = events.filter((event) => inWindow(event.playedAt, challenge) && (event.team1.includes(player.id) || event.team2.includes(player.id)));
      const progress = calculateChallengeMetric(player.id, scoped, challenge.metric);
      const completed = progress >= challenge.target;
      rows.push({
        challengeId: challenge.id,
        playerId: player.id,
        progress,
        target: challenge.target,
        completed,
        expired: asOfTime > new Date(challenge.endsAt).getTime(),
        rewardGranted: options.grantedRewardKeys?.has(`${player.id}:${challenge.id}`) ?? false,
      });
    }
    result.set(player.id, rows);
  }
  return result;
}

function calculateChallengeMetric(playerId: string, events: ReturnType<typeof deriveWeightedMatchEvents>, metric: ChallengeMetric): number {
  if (metric === 'matches-played') return Math.round(events.reduce((sum, event) => sum + event.finalWeight, 0));
  if (metric === 'wins') return events.filter((event) => (event.winner === 1 ? event.team1 : event.team2).includes(playerId)).length;
  if (metric === 'close-matches') return events.filter((event) => event.closenessFactor >= 1.15).length;
  if (metric === 'americano-games') return events.filter((event) => event.sourceType === 'americano-gross' || event.sourceType === 'americano-klein').length;
  if (metric === 'duo-wins') return events.filter((event) => (event.winner === 1 ? event.team1 : event.team2).includes(playerId) && (event.winner === 1 ? event.team1 : event.team2).length === 2).length;
  return 0;
}

export function deriveSeasonPassProgress(
  playerId: string,
  games: GameRecord[],
  config: SeasonPassConfig,
  claimedLevels: number[] = [],
): SeasonPassProgress {
  const xp = deriveWeightedMatchEvents(games)
    .filter((event) => inWindow(event.playedAt, config.season) && (event.team1.includes(playerId) || event.team2.includes(playerId)))
    .reduce((sum, event) => sum + (event.winner === 1 ? (event.team1.includes(playerId) ? event.xpForWinner : event.xpForLoser) : (event.team2.includes(playerId) ? event.xpForWinner : event.xpForLoser)), 0);
  const unlocked = config.levels.filter((level) => xp >= level.xpRequired);
  return {
    playerId,
    seasonId: config.season.id,
    xp,
    level: unlocked.at(-1)?.level ?? 0,
    claimableRewards: unlocked.filter((level) => !claimedLevels.includes(level.level)),
    claimedLevels,
  };
}

export function claimSeasonRewards(
  progress: SeasonPassProgress,
  wallet: RewardWallet,
  config: SeasonPassConfig,
  catalog = DEFAULT_COSMETICS,
  now = new Date().toISOString(),
): ClaimedSeasonReward {
  let nextWallet = wallet;
  const cosmetics: CosmeticDefinition[] = [];
  const claimedLevels = [...progress.claimedLevels];
  for (const reward of progress.claimableRewards) {
    if (reward.coinReward) {
      nextWallet = applyRewardTransaction(nextWallet, {
        playerId: progress.playerId,
        type: 'earn',
        reason: 'challenge',
        amount: reward.coinReward,
        sourceId: `${progress.seasonId}:level-${reward.level}`,
        createdAt: now,
      });
    }
    if (reward.cosmeticRewardId) {
      const cosmetic = catalog.find((item) => item.id === reward.cosmeticRewardId);
      if (cosmetic) cosmetics.push(cosmetic);
    }
    claimedLevels.push(reward.level);
  }
  return { wallet: nextWallet, claimedLevels, cosmetics };
}

export function generateSeasonAwards(players: Player[], games: GameRecord[], season: SeasonWindow): SeasonAwardRecord[] {
  const seasonGames = games.filter((game) => inWindow(game.date, season));
  const leaderboard = calculateEloLeaderboard(players, seasonGames);
  const chemistry = [...deriveChemistrySummaries(seasonGames).values()].sort((a, b) => b.chemistryScore - a.chemistryScore);
  const events = deriveWeightedMatchEvents(seasonGames);
  const closeWins = new Map<string, number>();
  for (const event of events.filter((item) => item.closenessFactor >= 1.15)) {
    for (const id of event.winner === 1 ? event.team1 : event.team2) closeWins.set(id, (closeWins.get(id) ?? 0) + 1);
  }
  const topClose = [...closeWins].sort((a, b) => b[1] - a[1])[0];
  const rows: SeasonAwardRecord[] = [];
  const mvp = leaderboard[0];
  if (mvp) rows.push({ id: `${season.id}:mvp`, seasonId: season.id, awardId: 'mvp', title: 'Saison-MVP', subjectIds: [mvp.playerId], score: mvp.currentElo, copy: 'Führte die Saisonwertung mit echter Scoreboard-Autorität an.', immutable: true });
  if (chemistry[0]) rows.push({ id: `${season.id}:best-duo`, seasonId: season.id, awardId: 'best-duo', title: 'Bestes Duo', subjectIds: chemistry[0].players, score: chemistry[0].chemistryScore, copy: 'Die Partnerschaft, durch die der Court kleiner wirkte.', immutable: true });
  if (topClose) rows.push({ id: `${season.id}:clutch-player`, seasonId: season.id, awardId: 'clutch-player', title: 'Clutch-Spieler', subjectIds: [topClose[0]], score: topClose[1], copy: 'Blieb ruhig, wenn der Satz richtig heiß wurde.', immutable: true });
  const improved = leaderboard.sort((a, b) => (b.peakElo - 1000) - (a.peakElo - 1000))[0];
  if (improved) rows.push({ id: `${season.id}:most-improved`, seasonId: season.id, awardId: 'most-improved', title: 'Größter Sprung', subjectIds: [improved.playerId], score: improved.peakElo - 1000, copy: 'Der stärkste Aufstieg ganz ohne Hype-Video.', immutable: true });
  const regular = leaderboard.sort((a, b) => b.weightedMatchesPlayed - a.weightedMatchesPlayed)[0];
  if (regular) rows.push({ id: `${season.id}:steady-presence`, seasonId: season.id, awardId: 'steady-presence', title: 'Dauerbrenner', subjectIds: [regular.playerId], score: regular.weightedMatchesPlayed, copy: 'Immer dabei, immer bereit für noch ein Match.', immutable: true });
  return rows;
}

export function generateHallOfFame(players: Player[], games: GameRecord[], seasons: SeasonWindow[], recordedAt = new Date().toISOString()): HallOfFameRecord[] {
  const records: HallOfFameRecord[] = [];
  const allTime = calculateEloLeaderboard(players, games)[0];
  if (allTime) records.push({ id: `all-time:highest-elo:${allTime.playerId}`, category: 'highest-elo', subjectIds: [allTime.playerId], value: allTime.peakElo, label: 'Höchstes ELO', recordedAt, immutable: true });
  const duo = [...deriveChemistrySummaries(games).values()].sort((a, b) => b.chemistryScore - a.chemistryScore)[0];
  if (duo) records.push({ id: `all-time:best-duo:${duo.pairKey}`, category: 'best-duo', subjectIds: duo.players, value: duo.chemistryScore, label: 'Beste Duo-Chemie', recordedAt, immutable: true });
  for (const player of players) {
    const streak = calculatePlayerStreaks(player.id, games).bestWinStreak;
    if (streak > 0) records.push({ id: `all-time:longest-streak:${player.id}`, category: 'longest-streak', subjectIds: [player.id], value: streak, label: 'Längste Siegesserie', recordedAt, immutable: true });
  }
  for (const season of seasons) {
    const leader = calculateEloLeaderboard(players, games.filter((game) => inWindow(game.date, season)))[0];
    if (leader) records.push({ id: `${season.id}:legendary-season:${leader.playerId}`, category: 'legendary-season', seasonId: season.id, subjectIds: [leader.playerId], value: leader.currentElo, label: `${season.label} Spitzenreiter`, recordedAt, immutable: true });
  }
  return records.sort((a, b) => b.value - a.value);
}

export function generateWallOfShame(players: Player[], games: GameRecord[], season: SeasonWindow, hiddenAwardIds: Set<string> = new Set()): WallOfShameRecord[] {
  const seasonGames = games.filter((game) => inWindow(game.date, season));
  const events = deriveWeightedMatchEvents(seasonGames);
  const closeLosses = new Map<string, number>();
  const losingStreaks = players.map((player) => ({ playerId: player.id, losses: calculatePlayerStreaks(player.id, seasonGames).bestLosingStreak }));
  for (const event of events.filter((item) => item.closenessFactor >= 1.15)) {
    for (const id of event.winner === 1 ? event.team2 : event.team1) closeLosses.set(id, (closeLosses.get(id) ?? 0) + 1);
  }
  const rows: WallOfShameRecord[] = [];
  const closeLoss = [...closeLosses].sort((a, b) => b[1] - a[1])[0];
  if (closeLoss) rows.push(shameRecord(season.id, 'almost-comeback', [closeLoss[0]], closeLoss[1], 'Fast-Comeback-Künstler', 'So knapp, dass das Highlight-Video schon Musik hatte.', hiddenAwardIds));
  const tough = losingStreaks.sort((a, b) => b.losses - a.losses)[0];
  if (tough && tough.losses > 0) rows.push(shameRecord(season.id, 'tough-week', [tough.playerId], tough.losses, 'Charakterbildungs-Woche', 'Eine heldenhafte Menge an Lernmomenten.', hiddenAwardIds));
  return rows;
}

function shameRecord(seasonId: string, awardId: ShameAwardId, subjectIds: string[], value: number, title: string, copy: string, hidden: Set<string>): WallOfShameRecord {
  const id = `${seasonId}:${awardId}:${pairKey(subjectIds)}`;
  return { id, seasonId, awardId, subjectIds, value, copy: `${title}: ${copy}`, hidden: hidden.has(id), safeCopy: true, immutable: true };
}
