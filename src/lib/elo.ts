import { getEloTier, getTierLabel } from '@/lib/eloTiers';
import { deriveWeightedMatchEvents, MATCH_WEIGHT_CONFIG, clamp, type WeightedMatchEvent } from './matchWeights';
import type { EloTier, GameRecord, Player } from '@/types';

export const DEFAULT_ELO = 1000;
export const BASE_K_FACTOR = 32;

export interface EloChange {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

export interface EloLeaderboardRow {
  playerId: string;
  name: string;
  currentElo: number;
  peakElo: number;
  matchesPlayed: number;
  weightedMatchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  experience: number;
  tier: EloTier;
}

export interface EloMatchSummary {
  gameId: string;
  playedAt: string;
  type: WeightedMatchEvent['sourceType'];
  winner: 1 | 2;
  finalWeight: number;
  xpForWinner: number;
  xpForLoser: number;
  changes: EloChange[];
}

interface MutableEloState {
  playerId: string;
  name: string;
  currentElo: number;
  peakElo: number;
  matchesPlayed: number;
  weightedMatchesPlayed: number;
  wins: number;
  losses: number;
  experience: number;
}

export function getPlayerElo(player: Player | undefined): number {
  return player?.currentElo ?? DEFAULT_ELO;
}

export { getEloTier, getTierLabel };

function averageElo(players: Array<Player | undefined>): number {
  if (players.length === 0) return DEFAULT_ELO;
  return players.reduce((sum, player) => sum + getPlayerElo(player), 0) / players.length;
}

function averageStateElo(players: MutableEloState[]): number {
  if (players.length === 0) return DEFAULT_ELO;
  return players.reduce((sum, player) => sum + player.currentElo, 0) / players.length;
}

function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function calculateEloChanges({
  team1,
  team2,
  winner,
  finalWeight = 1,
}: {
  team1: Player[];
  team2: Player[];
  winner: 1 | 2;
  finalWeight?: number;
}): EloChange[] {
  const team1Elo = averageElo(team1);
  const team2Elo = averageElo(team2);
  const team1Actual = winner === 1 ? 1 : 0;
  const team2Actual = winner === 2 ? 1 : 0;
  const weightedK = BASE_K_FACTOR * finalWeight;
  const team1Delta = Math.round(weightedK * (team1Actual - expectedScore(team1Elo, team2Elo)));
  const team2Delta = Math.round(weightedK * (team2Actual - expectedScore(team2Elo, team1Elo)));

  return [
    ...team1.map((player) => {
      const before = getPlayerElo(player);
      return { playerId: player.id, before, after: before + team1Delta, delta: team1Delta };
    }),
    ...team2.map((player) => {
      const before = getPlayerElo(player);
      return { playerId: player.id, before, after: before + team2Delta, delta: team2Delta };
    }),
  ];
}

export function applyEloChange(player: Player, change: EloChange): Player {
  const peakElo = Math.max(player.peakElo ?? DEFAULT_ELO, change.after);
  const allTimeBestElo = Math.max(player.allTimeBestElo ?? DEFAULT_ELO, peakElo);
  return {
    ...player,
    currentElo: change.after,
    peakElo,
    allTimeBestElo,
    eloTier: getEloTier(change.after),
  };
}

function createInitialEloState(players: Player[]): Map<string, MutableEloState> {
  const state = new Map<string, MutableEloState>();

  for (const player of players) {
    const initialElo = DEFAULT_ELO;
    state.set(player.id, {
      playerId: player.id,
      name: player.name,
      currentElo: initialElo,
      peakElo: player.peakElo ?? initialElo,
      matchesPlayed: 0,
      weightedMatchesPlayed: 0,
      wins: 0,
      losses: 0,
      experience: player.experience ?? 0,
    });
  }

  return state;
}

function stateEloMap(state: Map<string, MutableEloState>): Map<string, number> {
  return new Map([...state].map(([id, player]) => [id, player.currentElo]));
}

function clampNewPlayerDelta(delta: number, team: MutableEloState[]): number {
  if (team.some((player) => player.weightedMatchesPlayed < MATCH_WEIGHT_CONFIG.newPlayerWeightedMatches)) {
    return Math.round(clamp(delta, -MATCH_WEIGHT_CONFIG.newPlayerEloCap, MATCH_WEIGHT_CONFIG.newPlayerEloCap));
  }
  return delta;
}

function replayElo(players: Player[], games: GameRecord[]): {
  state: Map<string, MutableEloState>;
  summaries: EloMatchSummary[];
} {
  const state = createInitialEloState(players);
  const summaries: EloMatchSummary[] = [];

  for (const event of deriveWeightedMatchEvents(games, { playerElo: stateEloMap(state) })) {
    const team1 = event.team1.map((id) => state.get(id)).filter((player): player is MutableEloState => Boolean(player));
    const team2 = event.team2.map((id) => state.get(id)).filter((player): player is MutableEloState => Boolean(player));
    if (team1.length !== event.team1.length || team2.length !== event.team2.length) continue;

    const team1Elo = averageStateElo(team1);
    const team2Elo = averageStateElo(team2);
    const hasNewPlayer = [...team1, ...team2].some((player) => player.weightedMatchesPlayed < MATCH_WEIGHT_CONFIG.newPlayerWeightedMatches);
    const weightedK = BASE_K_FACTOR * event.finalWeight * (hasNewPlayer ? MATCH_WEIGHT_CONFIG.provisionalKMultiplier : 1);
    const team1Delta = clampNewPlayerDelta(
      Math.round(weightedK * ((event.winner === 1 ? 1 : 0) - expectedScore(team1Elo, team2Elo))),
      team1,
    );
    const team2Delta = clampNewPlayerDelta(
      Math.round(weightedK * ((event.winner === 2 ? 1 : 0) - expectedScore(team2Elo, team1Elo))),
      team2,
    );
    const changes: EloChange[] = [];

    for (const player of team1) {
      const before = player.currentElo;
      player.currentElo += team1Delta;
      player.peakElo = Math.max(player.peakElo, player.currentElo);
      player.matchesPlayed += 1;
      player.weightedMatchesPlayed += event.finalWeight;
      player.experience += event.winner === 1 ? event.xpForWinner : event.xpForLoser;
      if (event.winner === 1) player.wins += 1;
      else player.losses += 1;
      changes.push({ playerId: player.playerId, before, after: player.currentElo, delta: team1Delta });
    }

    for (const player of team2) {
      const before = player.currentElo;
      player.currentElo += team2Delta;
      player.peakElo = Math.max(player.peakElo, player.currentElo);
      player.matchesPlayed += 1;
      player.weightedMatchesPlayed += event.finalWeight;
      player.experience += event.winner === 2 ? event.xpForWinner : event.xpForLoser;
      if (event.winner === 2) player.wins += 1;
      else player.losses += 1;
      changes.push({ playerId: player.playerId, before, after: player.currentElo, delta: team2Delta });
    }

    summaries.push({
      gameId: event.id,
      playedAt: event.playedAt,
      type: event.sourceType,
      winner: event.winner,
      finalWeight: event.finalWeight,
      xpForWinner: event.xpForWinner,
      xpForLoser: event.xpForLoser,
      changes,
    });
  }

  return { state, summaries };
}

export function calculateEloMatchSummaries(players: Player[], games: GameRecord[]): EloMatchSummary[] {
  return replayElo(players, games).summaries;
}

export function calculateEloLeaderboard(players: Player[], games: GameRecord[]): EloLeaderboardRow[] {
  const { state } = replayElo(players, games);

  return [...state.values()]
    .map((player) => ({
      playerId: player.playerId,
      name: player.name,
      currentElo: player.currentElo,
      peakElo: player.peakElo,
      matchesPlayed: player.matchesPlayed,
      weightedMatchesPlayed: Math.round(player.weightedMatchesPlayed * 100) / 100,
      wins: player.wins,
      losses: player.losses,
      winPct: player.matchesPlayed > 0 ? (player.wins / player.matchesPlayed) * 100 : 0,
      experience: player.experience,
      tier: getEloTier(player.currentElo),
    }))
    .sort((a, b) => b.currentElo - a.currentElo);
}
