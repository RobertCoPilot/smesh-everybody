import { create } from 'zustand';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { calculateEloLeaderboard, DEFAULT_ELO } from '@/lib/elo';
import { getEloTier } from '@/lib/eloTiers';
import { firestoreCollections } from '@/lib/firestoreCollections';
import { db } from '@/lib/firebase';
import { finalizeMatchTracking } from '@/lib/matchTracking';
import type {
  Player,
  Match1vs1,
  Match2vs2,
  Tournament,
  AmericanoTournament,
  GameRecord,
} from '@/types';

// Strip undefined values (Firestore rejects them)
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function playersWithHistoricalElo(players: Player[], games: GameRecord[], excludeGameId?: string): Player[] {
  const replayGames = excludeGameId ? games.filter((game) => game.id !== excludeGameId) : games;
  const rows = calculateEloLeaderboard(players, replayGames);
  const eloByPlayerId = new Map(rows.map((row) => [row.playerId, row]));

  return players.map((player) => {
    const row = eloByPlayerId.get(player.id);
    const currentElo = row?.currentElo ?? player.currentElo ?? DEFAULT_ELO;
    const peakElo = Math.max(row?.peakElo ?? currentElo, player.peakElo ?? DEFAULT_ELO);
    return {
      ...player,
      currentElo,
      peakElo,
      allTimeBestElo: Math.max(player.allTimeBestElo ?? DEFAULT_ELO, peakElo),
      eloTier: getEloTier(currentElo),
    };
  });
}

interface GameStore {
  players: Player[];
  games: GameRecord[];

  // Internal setters (used by FirestoreProvider)
  _setPlayers: (players: Player[]) => void;
  _setGames: (games: GameRecord[]) => void;

  // Player actions
  addPlayer: (name: string) => Player;
  removePlayer: (id: string) => void;
  getPlayer: (id: string) => Player | undefined;

  // Game actions
  addGame: (game: GameRecord) => void;
  updateGame: (id: string, updater: (game: GameRecord) => GameRecord) => void;
  removeGame: (id: string) => void;
  getGame: (id: string) => GameRecord | undefined;

  // Ranking helpers
  getPlayerWins: (playerId: string) => {
    gamesPlayed: number;
    americanoPoints: number;
    americanoWins: number;
    americanoTournamentWins: number;
    americanoTournamentsPlayed: number;
    americanoGamesPlayed: number;
    americanoNormalizedPoints: number;
    twovstwoWins: number;
    twovstwoPlayed: number;
    onevoneWins: number;
    onevonePlayed: number;
    tournamentWins: number;
    tournamentsPlayed: number;
  };
}

export const useGameStore = create<GameStore>()((set, get) => ({
  players: [],
  games: [],

  _setPlayers: (players) => set((state) => ({ players: playersWithHistoricalElo(players, state.games) })),
  _setGames: (games) => set((state) => ({ games, players: playersWithHistoricalElo(state.players, games) })),

  addPlayer: (name: string) => {
    const player: Player = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      createdAt: new Date().toISOString(),
      currentElo: DEFAULT_ELO,
      peakElo: DEFAULT_ELO,
      allTimeBestElo: DEFAULT_ELO,
      eloTier: getEloTier(DEFAULT_ELO),
    };
    set((state) => ({ players: [...state.players, player] }));
    setDoc(doc(db, firestoreCollections.players, player.id), clean(player)).catch(console.error);
    return player;
  },

  removePlayer: (id: string) => {
    set((state) => ({
      players: state.players.filter((p) => p.id !== id),
    }));
    deleteDoc(doc(db, firestoreCollections.players, id)).catch(console.error);
  },

  getPlayer: (id: string) => {
    return get().players.find((p) => p.id === id);
  },

  addGame: (game: GameRecord) => {
    let gameToWrite = game;
    set((state) => {
      gameToWrite = finalizeMatchTracking(game, playersWithHistoricalElo(state.players, state.games));
      return { games: [...state.games, gameToWrite] };
    });
    setDoc(doc(db, firestoreCollections.games, gameToWrite.id), clean(gameToWrite)).catch(console.error);
  },

  updateGame: (id: string, updater: (game: GameRecord) => GameRecord) => {
    let updatedGame: GameRecord | undefined;
    set((state) => ({
      games: state.games.map((g) => {
        if (g.id === id) {
          const rawUpdatedGame = updater(g);
          updatedGame = finalizeMatchTracking(rawUpdatedGame, playersWithHistoricalElo(state.players, state.games, id));
          return updatedGame;
        }
        return g;
      }),
    }));
    if (updatedGame) {
      setDoc(doc(db, firestoreCollections.games, id), clean(updatedGame)).catch(console.error);
    }
  },

  removeGame: (id: string) => {
    set((state) => ({
      games: state.games.filter((g) => g.id !== id),
    }));
    deleteDoc(doc(db, firestoreCollections.games, id)).catch(console.error);
  },

  getGame: (id: string) => {
    return get().games.find((g) => g.id === id);
  },

      getPlayerWins: (playerId: string) => {
        const { games } = get();
        let gamesPlayed = 0;
        let americanoPoints = 0;
        let americanoWins = 0;
        let americanoTournamentWins = 0;
        let americanoTournamentsPlayed = 0;
        let americanoGamesPlayed = 0;
        let americanoNormalizedPoints = 0;
        let twovstwoWins = 0;
        let twovstwoPlayed = 0;
        let onevoneWins = 0;
        let onevonePlayed = 0;
        let tournamentWins = 0;
        let tournamentsPlayed = 0;

        for (const game of games) {
          if (game.type === '1vs1') {
            const m = game as Match1vs1;
            const isP1 = m.player1 === playerId;
            const isP2 = m.player2 === playerId;
            if (!isP1 && !isP2) continue;
            if (m.status === 'completed') {
              gamesPlayed++;
              onevonePlayed++;
              if (m.winner === 1 && isP1) onevoneWins++;
              if (m.winner === 2 && isP2) onevoneWins++;
            }
          }

          if (game.type === '2vs2') {
            const m = game as Match2vs2;
            const isInGame =
              m.team1.includes(playerId) || m.team2.includes(playerId);
            if (!isInGame) continue;
            if (m.status === 'completed') {
              gamesPlayed++;
              twovstwoPlayed++;
              if (m.winner === 1 && m.team1.includes(playerId)) twovstwoWins++;
              if (m.winner === 2 && m.team2.includes(playerId)) twovstwoWins++;
            }
          }

          if (game.type === '2vs2-tournament') {
            const t = game as Tournament;
            if (!t.players.includes(playerId)) continue;
            tournamentsPlayed++;
            const completedMatches = t.matches.filter(
              (m) => m.status === 'completed'
            );
            for (const match of completedMatches) {
              const team1 = t.teams.find((tm) => tm.id === match.team1Id);
              const team2 = t.teams.find((tm) => tm.id === match.team2Id);
              if (
                team1?.players.includes(playerId) ||
                team2?.players.includes(playerId)
              ) {
                gamesPlayed++;
              }
            }
            if (t.status === 'completed' && t.winner) {
              const winnerTeam = t.teams.find((tm) => tm.id === t.winner);
              if (winnerTeam?.players.includes(playerId)) {
                tournamentWins++;
              }
            }
          }

          if (
            game.type === 'americano-klein' ||
            game.type === 'americano-gross'
          ) {
            const a = game as AmericanoTournament;
            if (!a.players.includes(playerId)) continue;
            americanoTournamentsPlayed++;

            for (const ag of a.games) {
              if (ag.status !== 'completed') continue;
              const inTeam1 = ag.team1.includes(playerId);
              const inTeam2 = ag.team2.includes(playerId);
              if (!inTeam1 && !inTeam2) continue;

              gamesPlayed++;
              americanoGamesPlayed++;
              const ptw = a.pointsToWin || 10;
              if (inTeam1) {
                americanoPoints += ag.team1Score;
                americanoNormalizedPoints += (ag.team1Score / ptw) * 10;
                if (ag.team1Score > ag.team2Score) americanoWins++;
              }
              if (inTeam2) {
                americanoPoints += ag.team2Score;
                americanoNormalizedPoints += (ag.team2Score / ptw) * 10;
                if (ag.team2Score > ag.team1Score) americanoWins++;
              }
            }

            // Check if player won the americano tournament
            if (a.status === 'completed') {
              const playerScores = new Map<string, number>();
              const playerGameCounts = new Map<string, number>();
              for (const ag of a.games) {
                if (ag.status !== 'completed') continue;
                for (const pid of ag.team1) {
                  playerScores.set(pid, (playerScores.get(pid) || 0) + ag.team1Score);
                  playerGameCounts.set(pid, (playerGameCounts.get(pid) || 0) + 1);
                }
                for (const pid of ag.team2) {
                  playerScores.set(pid, (playerScores.get(pid) || 0) + ag.team2Score);
                  playerGameCounts.set(pid, (playerGameCounts.get(pid) || 0) + 1);
                }
              }
              const counts = [...playerGameCounts.values()];
              const allEqual = counts.every((c) => c === counts[0]);

              let myMetric = 0;
              let maxMetric = -1;
              for (const [pid, score] of playerScores) {
                const gc = playerGameCounts.get(pid) || 1;
                const metric = allEqual ? score : score / gc;
                if (pid === playerId) myMetric = metric;
                if (metric > maxMetric) maxMetric = metric;
              }
              if (myMetric === maxMetric && myMetric > 0) {
                americanoTournamentWins++;
              }
            }
          }
        }

        return {
          gamesPlayed,
          americanoPoints,
          americanoWins,
          americanoTournamentWins,
          americanoTournamentsPlayed,
          americanoGamesPlayed,
          americanoNormalizedPoints: Math.round(americanoNormalizedPoints * 100) / 100,
          twovstwoWins,
          twovstwoPlayed,
          onevoneWins,
          onevonePlayed,
          tournamentWins,
          tournamentsPlayed,
        };
      },
    })
  );
