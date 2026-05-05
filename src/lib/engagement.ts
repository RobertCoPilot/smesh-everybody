import { calculateEloLeaderboard, DEFAULT_ELO } from './elo';
import type { GameRecord, Match1vs1, Match2vs2, Player } from '@/types';

export type FormState = 'hot' | 'neutral' | 'cold';
export type ActivityState = 'active' | 'rusty' | 'inactive' | 'unranked';

export interface PlayerMatchResult {
  gameId: string;
  playedAt: string;
  won: boolean;
  comebackWin: boolean;
  doubles: boolean;
}

export interface PlayerStreaks {
  current: { kind: 'win' | 'loss' | 'none'; count: number };
  bestWinStreak: number;
  bestLosingStreak: number;
  comebackWins: number;
  recentForm: FormState;
  recentResults: PlayerMatchResult[];
}

export interface EarnedAward {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
  sourceGameId?: string;
  category: 'milestone' | 'streak' | 'activity' | 'seasonal';
}

export interface AwardProgress {
  earned: EarnedAward[];
  next: Array<{ id: string; name: string; progress: number; target: number }>;
}

export interface SeasonWindow {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  closed: boolean;
}

export interface PrimeRatingOptions {
  seasons?: SeasonWindow[];
}

export interface SeasonSnapshot {
  id: string;
  label: string;
  elo: number;
  rank: number;
  matchesPlayed: number;
  immutable: boolean;
  closedAt: string;
}

export interface PrimeRating {
  currentElo: number;
  primeElo: number;
  legacyRank: number | null;
  bestSeason: SeasonSnapshot | null;
  seasonSnapshots: SeasonSnapshot[];
  primeCard: {
    rating: number;
    title: string;
  };
}

export interface ActivityDecayOptions {
  asOf?: string;
  rustyAfterDays?: number;
  inactiveAfterDays?: number;
}

export interface ActivityStatus {
  status: ActivityState;
  confidence: number;
  lastCompetitiveMatchAt: string | null;
  daysInactive: number | null;
  visualState: 'active' | 'rusty' | 'inactive' | 'unranked';
  cosmeticModifier: 'none' | 'minor-downgrade' | 'inactive-downgrade';
}

export interface Phase2EngagementSummary {
  player: Player;
  streaks: PlayerStreaks;
  awards: AwardProgress;
  prime: PrimeRating;
  activity: ActivityStatus;
}

const DEFAULT_RUSTY_AFTER_DAYS = 21;
const DEFAULT_INACTIVE_AFTER_DAYS = 60;

function completedEloMatches(games: GameRecord[]): Array<Match1vs1 | Match2vs2> {
  return games
    .filter((game): game is Match1vs1 | Match2vs2 => {
      return (game.type === '1vs1' || game.type === '2vs2') && game.status === 'completed' && Boolean(game.winner);
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function resultForPlayer(playerId: string, match: Match1vs1 | Match2vs2): PlayerMatchResult | null {
  const team1 = match.type === '1vs1' ? [match.player1] : match.team1;
  const team2 = match.type === '1vs1' ? [match.player2] : match.team2;
  const onTeam1 = team1.includes(playerId);
  const onTeam2 = team2.includes(playerId);
  if (!onTeam1 && !onTeam2) return null;

  const teamNumber = onTeam1 ? 1 : 2;
  const won = match.winner === teamNumber;
  const firstSet = match.sets[0];
  const lostFirstSet = firstSet ? (teamNumber === 1 ? firstSet.team1Games < firstSet.team2Games : firstSet.team2Games < firstSet.team1Games) : false;

  return {
    gameId: match.id,
    playedAt: match.date,
    won,
    comebackWin: won && lostFirstSet,
    doubles: match.type === '2vs2',
  };
}

export function getPlayerCompetitiveResults(playerId: string, games: GameRecord[]): PlayerMatchResult[] {
  return completedEloMatches(games)
    .map((match) => resultForPlayer(playerId, match))
    .filter((result): result is PlayerMatchResult => Boolean(result));
}

export function calculatePlayerStreaks(playerId: string, games: GameRecord[]): PlayerStreaks {
  const results = getPlayerCompetitiveResults(playerId, games);
  let bestWinStreak = 0;
  let bestLosingStreak = 0;
  let runningWins = 0;
  let runningLosses = 0;

  for (const result of results) {
    if (result.won) {
      runningWins += 1;
      runningLosses = 0;
      bestWinStreak = Math.max(bestWinStreak, runningWins);
    } else {
      runningLosses += 1;
      runningWins = 0;
      bestLosingStreak = Math.max(bestLosingStreak, runningLosses);
    }
  }

  const latest = results.at(-1);
  let current: PlayerStreaks['current'] = { kind: 'none', count: 0 };
  if (latest) {
    const kind = latest.won ? 'win' : 'loss';
    let count = 0;
    for (let i = results.length - 1; i >= 0; i -= 1) {
      if ((results[i].won ? 'win' : 'loss') !== kind) break;
      count += 1;
    }
    current = { kind, count };
  }

  const recent = results.slice(-5);
  const recentWins = recent.filter((result) => result.won).length;
  const recentForm: FormState = recent.length >= 3 && recentWins / recent.length >= 0.6
    ? 'hot'
    : recent.length >= 3 && recentWins / recent.length <= 0.4
      ? 'cold'
      : 'neutral';

  return {
    current,
    bestWinStreak,
    bestLosingStreak,
    comebackWins: results.filter((result) => result.comebackWin).length,
    recentForm,
    recentResults: recent,
  };
}

function award(id: string, name: string, description: string, source: PlayerMatchResult, category: EarnedAward['category']): EarnedAward {
  return { id, name, description, earnedAt: source.playedAt, sourceGameId: source.gameId, category };
}

export function calculateAwardProgress(
  player: Player,
  games: GameRecord[],
  options: { asOf?: string } = {},
): AwardProgress {
  void options;
  const results = getPlayerCompetitiveResults(player.id, games);
  const streaks = calculatePlayerStreaks(player.id, games);
  const wins = results.filter((result) => result.won);
  const doubles = results.find((result) => result.doubles);
  const comeback = results.find((result) => result.comebackWin);
  const earned = new Map<string, EarnedAward>();

  if (results[0]) earned.set('first-match', award('first-match', 'Debüt', 'Erstes gewertetes Match gespielt.', results[0], 'milestone'));
  if (wins[0]) earned.set('first-win', award('first-win', 'Erster Sieg', 'Das erste Match gewonnen.', wins[0], 'milestone'));
  if (wins[2]) earned.set('hat-trick', award('hat-trick', 'Hat-trick', 'Drei Siege gesammelt.', wins[2], 'streak'));
  if (streaks.bestWinStreak >= 5 && wins[4]) earned.set('on-fire', award('on-fire', 'Heißlauf', 'Fünf Siege in Folge.', wins[4], 'streak'));
  if (comeback) earned.set('comeback-kid', award('comeback-kid', 'Comeback Kid', 'Nach verlorenem ersten Satz gewonnen.', comeback, 'streak'));
  if (doubles) earned.set('doubles-debut', award('doubles-debut', 'Team Player', 'Erstes 2vs2-Match absolviert.', doubles, 'milestone'));
  if (results.length >= 10) earned.set('regular', award('regular', 'Stammgast', 'Zehn gewertete Matches gespielt.', results[9], 'activity'));

  return {
    earned: [...earned.values()].sort((a, b) => new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime()),
    next: [
      { id: 'hat-trick', name: 'Hat-trick', progress: Math.min(wins.length, 3), target: 3 },
      { id: 'on-fire', name: 'Heißlauf', progress: Math.min(streaks.bestWinStreak, 5), target: 5 },
      { id: 'regular', name: 'Stammgast', progress: Math.min(results.length, 10), target: 10 },
    ].filter((item) => !earned.has(item.id)),
  };
}

export function calculatePrimeRating(
  player: Player,
  players: Player[],
  games: GameRecord[],
  options: PrimeRatingOptions = {},
): PrimeRating {
  const leaderboard = calculateEloLeaderboard(players, games);
  const currentRankIndex = leaderboard.findIndex((row) => row.playerId === player.id);
  const current = leaderboard[currentRankIndex];
  const currentElo = current?.currentElo ?? player.currentElo ?? DEFAULT_ELO;
  let primeElo = Math.max(current?.peakElo ?? DEFAULT_ELO, player.peakElo ?? DEFAULT_ELO, player.allTimeBestElo ?? DEFAULT_ELO);

  const seasonSnapshots: SeasonSnapshot[] = [];
  for (const season of options.seasons ?? []) {
    if (!season.closed) continue;
    const seasonGames = games.filter((game) => {
      const date = new Date(game.date).getTime();
      return date >= new Date(season.startsAt).getTime() && date <= new Date(season.endsAt).getTime();
    });
    const seasonBoard = calculateEloLeaderboard(players, seasonGames);
    const index = seasonBoard.findIndex((row) => row.playerId === player.id);
    const row = seasonBoard[index];
    if (!row || row.matchesPlayed === 0) continue;
    primeElo = Math.max(primeElo, row.peakElo, row.currentElo);
    seasonSnapshots.push({
      id: season.id,
      label: season.label,
      elo: row.currentElo,
      rank: index + 1,
      matchesPlayed: row.matchesPlayed,
      immutable: true,
      closedAt: season.endsAt,
    });
  }

  const bestSeason = seasonSnapshots.length > 0
    ? [...seasonSnapshots].sort((a, b) => b.elo - a.elo || a.rank - b.rank)[0]
    : null;

  return {
    currentElo,
    primeElo,
    legacyRank: currentRankIndex >= 0 ? currentRankIndex + 1 : null,
    bestSeason,
    seasonSnapshots,
    primeCard: {
      rating: Math.max(1, Math.round(primeElo / 10)),
      title: bestSeason ? `Prime ${bestSeason.label}` : 'All-Time-Prime',
    },
  };
}

export function calculateActivityStatus(
  playerId: string,
  games: GameRecord[],
  options: ActivityDecayOptions = {},
): ActivityStatus {
  const results = getPlayerCompetitiveResults(playerId, games);
  const last = results.at(-1);
  if (!last) {
    return { status: 'unranked', confidence: 0, lastCompetitiveMatchAt: null, daysInactive: null, visualState: 'unranked', cosmeticModifier: 'none' };
  }

  const asOf = new Date(options.asOf ?? new Date().toISOString()).getTime();
  const daysInactive = Math.max(0, Math.floor((asOf - new Date(last.playedAt).getTime()) / 86_400_000));
  const rustyAfterDays = options.rustyAfterDays ?? DEFAULT_RUSTY_AFTER_DAYS;
  const inactiveAfterDays = options.inactiveAfterDays ?? DEFAULT_INACTIVE_AFTER_DAYS;

  if (daysInactive >= inactiveAfterDays) {
    return { status: 'inactive', confidence: 40, lastCompetitiveMatchAt: last.playedAt, daysInactive, visualState: 'inactive', cosmeticModifier: 'inactive-downgrade' };
  }
  if (daysInactive >= rustyAfterDays) {
    return { status: 'rusty', confidence: 70, lastCompetitiveMatchAt: last.playedAt, daysInactive, visualState: 'rusty', cosmeticModifier: 'minor-downgrade' };
  }
  return { status: 'active', confidence: 100, lastCompetitiveMatchAt: last.playedAt, daysInactive, visualState: 'active', cosmeticModifier: 'none' };
}

export function derivePhase2Engagement(
  players: Player[],
  games: GameRecord[],
  options: ActivityDecayOptions & PrimeRatingOptions = {},
): Map<string, Phase2EngagementSummary> {
  return new Map(players.map((player) => [
    player.id,
    {
      player,
      streaks: calculatePlayerStreaks(player.id, games),
      awards: calculateAwardProgress(player, games, options),
      prime: calculatePrimeRating(player, players, games, options),
      activity: calculateActivityStatus(player.id, games, options),
    },
  ]));
}
