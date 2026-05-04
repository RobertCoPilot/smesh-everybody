import { getEloTier, getTierLabel } from '@/lib/eloTiers';
import type { EloTier, GameRecord, Match1vs1, Match2vs2, Player } from '@/types';

export const DEFAULT_ELO = 1000;
const K_FACTOR = 32;

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
  wins: number;
  losses: number;
  winPct: number;
  tier: EloTier;
}

export interface EloMatchSummary {
  gameId: string;
  playedAt: string;
  type: '1vs1' | '2vs2';
  winner: 1 | 2;
  changes: EloChange[];
}

interface MutableEloState {
  playerId: string;
  name: string;
  currentElo: number;
  peakElo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
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
}: {
  team1: Player[];
  team2: Player[];
  winner: 1 | 2;
}): EloChange[] {
  const team1Elo = averageElo(team1);
  const team2Elo = averageElo(team2);
  const team1Actual = winner === 1 ? 1 : 0;
  const team2Actual = winner === 2 ? 1 : 0;
  const team1Delta = Math.round(K_FACTOR * (team1Actual - expectedScore(team1Elo, team2Elo)));
  const team2Delta = Math.round(K_FACTOR * (team2Actual - expectedScore(team2Elo, team1Elo)));

  return [
    ...team1.map((player) => {
      const before = getPlayerElo(player);
      const delta = team1Delta;
      return { playerId: player.id, before, after: before + delta, delta };
    }),
    ...team2.map((player) => {
      const before = getPlayerElo(player);
      const delta = team2Delta;
      return { playerId: player.id, before, after: before + delta, delta };
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

function getCompletedEloMatch(game: GameRecord): Match1vs1 | Match2vs2 | null {
  if (game.type !== '1vs1' && game.type !== '2vs2') return null;
  if (game.status !== 'completed' || !game.winner) return null;
  return game;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
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
      wins: 0,
      losses: 0,
    });
  }

  return state;
}

function getChronologicalCompletedMatches(games: GameRecord[]): Array<Match1vs1 | Match2vs2> {
  return games
    .map(getCompletedEloMatch)
    .filter((game): game is Match1vs1 | Match2vs2 => game !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function replayElo(players: Player[], games: GameRecord[]): {
  state: Map<string, MutableEloState>;
  summaries: EloMatchSummary[];
} {
  const state = createInitialEloState(players);
  const summaries: EloMatchSummary[] = [];

  for (const match of getChronologicalCompletedMatches(games)) {
    if (!match.winner) continue;

    const winner = match.winner;
    const team1Ids = match.type === '1vs1' ? [match.player1] : uniqueIds(match.team1);
    const team2Ids = match.type === '1vs1' ? [match.player2] : uniqueIds(match.team2);
    const team1 = team1Ids.map((id) => state.get(id)).filter((player): player is MutableEloState => Boolean(player));
    const team2 = team2Ids.map((id) => state.get(id)).filter((player): player is MutableEloState => Boolean(player));

    if (team1.length !== team1Ids.length || team2.length !== team2Ids.length) continue;

    const persistedChanges = match.matchTracking?.eloChanges;
    const changes: EloChange[] = [];

    if (persistedChanges && persistedChanges.length > 0) {
      for (const change of persistedChanges) {
        const player = state.get(change.playerId);
        if (!player) continue;
        player.currentElo = change.after;
        player.peakElo = Math.max(player.peakElo, player.currentElo);
        player.matchesPlayed += 1;
        if ((winner === 1 && team1Ids.includes(player.playerId)) || (winner === 2 && team2Ids.includes(player.playerId))) player.wins += 1;
        else player.losses += 1;
        changes.push(change);
      }
    } else {
      const team1Elo = averageStateElo(team1);
      const team2Elo = averageStateElo(team2);
      const team1Delta = Math.round(K_FACTOR * ((winner === 1 ? 1 : 0) - expectedScore(team1Elo, team2Elo)));
      const team2Delta = Math.round(K_FACTOR * ((winner === 2 ? 1 : 0) - expectedScore(team2Elo, team1Elo)));

      for (const player of team1) {
        const before = player.currentElo;
        player.currentElo += team1Delta;
        player.peakElo = Math.max(player.peakElo, player.currentElo);
        player.matchesPlayed += 1;
        if (winner === 1) player.wins += 1;
        else player.losses += 1;
        changes.push({ playerId: player.playerId, before, after: player.currentElo, delta: team1Delta });
      }

      for (const player of team2) {
        const before = player.currentElo;
        player.currentElo += team2Delta;
        player.peakElo = Math.max(player.peakElo, player.currentElo);
        player.matchesPlayed += 1;
        if (winner === 2) player.wins += 1;
        else player.losses += 1;
        changes.push({ playerId: player.playerId, before, after: player.currentElo, delta: team2Delta });
      }
    }

    summaries.push({
      gameId: match.id,
      playedAt: match.date,
      type: match.type,
      winner,
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
      wins: player.wins,
      losses: player.losses,
      winPct: player.matchesPlayed > 0 ? (player.wins / player.matchesPlayed) * 100 : 0,
      tier: getEloTier(player.currentElo),
    }))
    .sort((a, b) => b.currentElo - a.currentElo);
}
