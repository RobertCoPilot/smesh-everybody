import type { AmericanoTournament, GameRecord, SetScore, Tournament } from '@/types';

export type WeightedMatchSourceType = '1vs1' | '2vs2' | 'tournament' | 'americano-klein' | 'americano-gross';

export interface MatchWeightFormulaConfig {
  baseWeights: Record<WeightedMatchSourceType, number>;
  expectedDurationMinutes: Record<WeightedMatchSourceType, number>;
  expectedWinningScore: Record<WeightedMatchSourceType, number>;
  expectedTotalScore: Record<WeightedMatchSourceType, number>;
  durationFactorMin: number;
  durationFactorMax: number;
  closenessBonusMax: number;
  scoreConfidenceMin: number;
  scoreConfidenceMax: number;
  opponentQualityDivisor: number;
  opponentQualityMin: number;
  opponentQualityMax: number;
  finalWeightMin: number;
  finalWeightMax: number;
  defaultElo: number;
  baseXp: number;
  weightedXp: number;
  winXp: number;
  closeMatchXp: number;
  closeMatchFactorThreshold: number;
  newPlayerWeightedMatches: number;
  newPlayerEloCap: number;
  provisionalKMultiplier: number;
}

export const MATCH_WEIGHT_CONFIG: MatchWeightFormulaConfig = {
  baseWeights: {
    '1vs1': 0.75,
    '2vs2': 1.0,
    tournament: 1.1,
    'americano-klein': 0.35,
    'americano-gross': 0.45,
  },
  expectedDurationMinutes: {
    '1vs1': 45,
    '2vs2': 60,
    tournament: 50,
    'americano-klein': 8,
    'americano-gross': 12,
  },
  expectedWinningScore: {
    '1vs1': 12,
    '2vs2': 12,
    tournament: 12,
    'americano-klein': 16,
    'americano-gross': 21,
  },
  expectedTotalScore: {
    '1vs1': 20,
    '2vs2': 20,
    tournament: 20,
    'americano-klein': 24,
    'americano-gross': 34,
  },
  durationFactorMin: 0.5,
  durationFactorMax: 1.25,
  closenessBonusMax: 0.2,
  scoreConfidenceMin: 0.7,
  scoreConfidenceMax: 1.15,
  opponentQualityDivisor: 1000,
  opponentQualityMin: 0.85,
  opponentQualityMax: 1.15,
  finalWeightMin: 0.1,
  finalWeightMax: 1.5,
  defaultElo: 1000,
  baseXp: 20,
  weightedXp: 30,
  winXp: 15,
  closeMatchXp: 10,
  closeMatchFactorThreshold: 1.15,
  newPlayerWeightedMatches: 5,
  newPlayerEloCap: 18,
  provisionalKMultiplier: 1.25,
};

export interface WeightedMatchEvent {
  id: string;
  sourceType: WeightedMatchSourceType;
  playedAt: string;
  team1: string[];
  team2: string[];
  winner: 1 | 2;
  scoreForWinner: number;
  scoreForLoser: number;
  scoreDifference: number;
  totalScore: number;
  durationSeconds: number | null;
  baseWeight: number;
  durationFactor: number;
  closenessFactor: number;
  scoreConfidenceFactor: number;
  opponentQualityFactor: number;
  recencyFactor: number;
  finalWeight: number;
  xpForWinner: number;
  xpForLoser: number;
}

interface RawWeightedMatchEvent {
  id: string;
  sourceType: WeightedMatchSourceType;
  playedAt: string;
  team1: string[];
  team2: string[];
  winner: 1 | 2;
  scoreForWinner: number;
  scoreForLoser: number;
  totalScore: number;
  durationSeconds: number | null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gameDurationSeconds(item: { startedAt?: string; completedAt?: string; durationSeconds?: number }): number | null {
  if (typeof item.durationSeconds === 'number' && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0) return item.durationSeconds;
  if (item.startedAt && item.completedAt) {
    const delta = (new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 1000;
    if (Number.isFinite(delta) && delta > 0) return Math.round(delta);
  }
  return null;
}

function setScores(sets: SetScore[], winner: 1 | 2): { scoreForWinner: number; scoreForLoser: number; totalScore: number } {
  const team1Score = sets.reduce((sum, set) => sum + set.team1Games, 0);
  const team2Score = sets.reduce((sum, set) => sum + set.team2Games, 0);
  return {
    scoreForWinner: winner === 1 ? team1Score : team2Score,
    scoreForLoser: winner === 1 ? team2Score : team1Score,
    totalScore: team1Score + team2Score,
  };
}

function recencyFactor(playedAt: string, asOf?: string): number {
  if (!asOf) return 1;
  const daysAgo = Math.max(0, (new Date(asOf).getTime() - new Date(playedAt).getTime()) / 86_400_000);
  return clamp(1 - daysAgo / 365, 0.5, 1);
}

function collectRawEvents(games: GameRecord[]): RawWeightedMatchEvent[] {
  const events: RawWeightedMatchEvent[] = [];

  for (const game of games) {
    if (game.type === '1vs1' && game.status === 'completed' && game.winner) {
      const scores = setScores(game.sets, game.winner);
      events.push({ id: game.id, sourceType: '1vs1', playedAt: game.date, team1: [game.player1], team2: [game.player2], winner: game.winner, ...scores, durationSeconds: gameDurationSeconds(game) });
    }
    if (game.type === '2vs2' && game.status === 'completed' && game.winner) {
      const scores = setScores(game.sets, game.winner);
      events.push({ id: game.id, sourceType: '2vs2', playedAt: game.date, team1: [...game.team1], team2: [...game.team2], winner: game.winner, ...scores, durationSeconds: gameDurationSeconds(game) });
    }
    if (game.type === '2vs2-tournament') collectTournamentEvents(game).forEach((event) => events.push(event));
    if (game.type === 'americano-klein' || game.type === 'americano-gross') collectAmericanoEvents(game).forEach((event) => events.push(event));
  }

  return events.sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
}

function collectTournamentEvents(tournament: Tournament): RawWeightedMatchEvent[] {
  return tournament.matches.flatMap((match) => {
    if (match.status !== 'completed' || !match.winnerId || !match.team1Id || !match.team2Id) return [];
    const team1 = tournament.teams.find((team) => team.id === match.team1Id);
    const team2 = tournament.teams.find((team) => team.id === match.team2Id);
    if (!team1 || !team2) return [];
    const winner = match.winnerId === match.team1Id ? 1 : 2;
    const scores = setScores(match.sets, winner);
    return [{ id: `${tournament.id}:${match.id}`, sourceType: 'tournament' as const, playedAt: tournament.date, team1: [...team1.players], team2: [...team2.players], winner, ...scores, durationSeconds: gameDurationSeconds(match) }];
  });
}

function collectAmericanoEvents(tournament: AmericanoTournament): RawWeightedMatchEvent[] {
  return tournament.games.flatMap((game) => {
    if (game.status !== 'completed') return [];
    const winner = game.team1Score >= game.team2Score ? 1 : 2;
    const scoreForWinner = winner === 1 ? game.team1Score : game.team2Score;
    const scoreForLoser = winner === 1 ? game.team2Score : game.team1Score;
    return [{
      id: `${tournament.id}:${game.id}`,
      sourceType: tournament.type,
      playedAt: tournament.date,
      team1: [...game.team1],
      team2: [...game.team2],
      winner,
      scoreForWinner,
      scoreForLoser,
      totalScore: game.team1Score + game.team2Score,
      durationSeconds: gameDurationSeconds(game),
    }];
  });
}

export function calculateMatchWeight({
  sourceType,
  scoreDifference,
  totalScore,
  durationSeconds,
  ownAvgElo,
  opponentAvgElo,
  playedAt,
  asOf,
  config = MATCH_WEIGHT_CONFIG,
}: {
  sourceType: WeightedMatchSourceType;
  scoreDifference: number;
  totalScore: number;
  durationSeconds: number | null;
  ownAvgElo?: number;
  opponentAvgElo?: number;
  playedAt: string;
  asOf?: string;
  config?: MatchWeightFormulaConfig;
}) {
  const baseWeight = config.baseWeights[sourceType];
  const expectedDurationSeconds = config.expectedDurationMinutes[sourceType] * 60;
  const durationFactor = durationSeconds
    ? clamp(durationSeconds / expectedDurationSeconds, config.durationFactorMin, config.durationFactorMax)
    : 1;
  const normalizedScoreDiff = clamp(scoreDifference / config.expectedWinningScore[sourceType], 0, 1);
  const closenessFactor = 1 + (1 - normalizedScoreDiff) * config.closenessBonusMax;
  const scoreConfidenceFactor = clamp(totalScore / config.expectedTotalScore[sourceType], config.scoreConfidenceMin, config.scoreConfidenceMax);
  const opponentQualityFactor = ownAvgElo !== undefined && opponentAvgElo !== undefined
    ? clamp(1 + (opponentAvgElo - ownAvgElo) / config.opponentQualityDivisor, config.opponentQualityMin, config.opponentQualityMax)
    : 1;
  const eventRecencyFactor = recencyFactor(playedAt, asOf);
  const finalWeight = clamp(
    baseWeight * durationFactor * closenessFactor * scoreConfidenceFactor * opponentQualityFactor * eventRecencyFactor,
    config.finalWeightMin,
    config.finalWeightMax,
  );
  return { baseWeight, durationFactor, closenessFactor, scoreConfidenceFactor, opponentQualityFactor, recencyFactor: eventRecencyFactor, finalWeight };
}

function xpForEvent(finalWeight: number, closenessFactor: number, winner: boolean, config: MatchWeightFormulaConfig): number {
  return Math.max(0, Math.round(
    config.baseXp +
    config.weightedXp * finalWeight +
    (winner ? config.winXp * finalWeight : 0) +
    (closenessFactor >= config.closeMatchFactorThreshold ? config.closeMatchXp : 0),
  ));
}

export function deriveWeightedMatchEvents(
  games: GameRecord[],
  options: { asOf?: string; playerElo?: Map<string, number>; config?: MatchWeightFormulaConfig } = {},
): WeightedMatchEvent[] {
  const config = options.config ?? MATCH_WEIGHT_CONFIG;
  return collectRawEvents(games).map((raw) => {
    const scoreDifference = Math.max(0, raw.scoreForWinner - raw.scoreForLoser);
    const teamElo = (team: string[]) => team.reduce((sum, id) => sum + (options.playerElo?.get(id) ?? config.defaultElo), 0) / team.length;
    const winnerTeam = raw.winner === 1 ? raw.team1 : raw.team2;
    const loserTeam = raw.winner === 1 ? raw.team2 : raw.team1;
    const factors = calculateMatchWeight({
      sourceType: raw.sourceType,
      scoreDifference,
      totalScore: raw.totalScore,
      durationSeconds: raw.durationSeconds,
      ownAvgElo: teamElo(winnerTeam),
      opponentAvgElo: teamElo(loserTeam),
      playedAt: raw.playedAt,
      asOf: options.asOf,
      config,
    });
    return {
      ...raw,
      scoreDifference,
      ...factors,
      xpForWinner: xpForEvent(factors.finalWeight, factors.closenessFactor, true, config),
      xpForLoser: xpForEvent(factors.finalWeight, factors.closenessFactor, false, config),
    };
  });
}
