import type { ChemistryChange, GameRecord, Match1vs1, Match2vs2, MatchTracking, Player, SetScore } from '@/types';
import { calculateEloChanges, type EloChange } from './elo';

function scoreLabel(sets: SetScore[]): string {
  return sets.map((set) => `${set.team1Games}-${set.team2Games}`).join(', ');
}

function chemistryForTeam(players: string[], winner: boolean): ChemistryChange[] {
  if (players.length < 2) return [];
  return [{ pairKey: [...players].sort().join(':'), delta: winner ? 2 : -1 }];
}

function selectMvp(winnerPlayers: string[], eloChanges: EloChange[]): string | null {
  const winnerChanges = eloChanges.filter((change) => winnerPlayers.includes(change.playerId));
  if (winnerChanges.length === 0) return winnerPlayers[0] ?? null;
  return winnerChanges.sort((a, b) => b.delta - a.delta)[0].playerId;
}

function playersById(players: Player[]): Map<string, Player> {
  return new Map(players.map((player) => [player.id, player]));
}

function buildMatchTracking(game: Match1vs1 | Match2vs2, players: Player[]): MatchTracking | null {
  if (game.status !== 'completed' || !game.winner) return null;
  if (game.matchTracking?.trackedAt) return game.matchTracking;

  const playerMap = playersById(players);
  const team1Ids = game.type === '1vs1' ? [game.player1] : game.team1;
  const team2Ids = game.type === '1vs1' ? [game.player2] : game.team2;
  const team1 = team1Ids.map((id) => playerMap.get(id)).filter((player): player is Player => Boolean(player));
  const team2 = team2Ids.map((id) => playerMap.get(id)).filter((player): player is Player => Boolean(player));
  if (team1.length !== team1Ids.length || team2.length !== team2Ids.length) return null;

  const eloChanges = calculateEloChanges({ team1, team2, winner: game.winner });
  const winnerPlayers = game.winner === 1 ? team1Ids : team2Ids;
  const loserPlayers = game.winner === 1 ? team2Ids : team1Ids;

  return {
    trackedAt: new Date().toISOString(),
    teams: [team1Ids, team2Ids],
    score: scoreLabel(game.sets),
    mvp: selectMvp(winnerPlayers, eloChanges),
    winnerPlayers,
    loserPlayers,
    eloChanges,
    chemistryChanges: [
      ...chemistryForTeam(team1Ids, game.winner === 1),
      ...chemistryForTeam(team2Ids, game.winner === 2),
    ],
  };
}

export function finalizeMatchTracking(game: GameRecord, players: Player[]): GameRecord {
  if (game.type !== '1vs1' && game.type !== '2vs2') return game;
  const matchTracking = buildMatchTracking(game, players);
  if (!matchTracking) return game;
  return { ...game, matchTracking };
}

export function getEloChangesFromGame(game: GameRecord): EloChange[] {
  if ((game.type === '1vs1' || game.type === '2vs2') && game.matchTracking?.eloChanges) {
    return game.matchTracking.eloChanges;
  }
  return [];
}
