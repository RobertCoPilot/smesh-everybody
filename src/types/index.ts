export type EloTier = 'bronze' | 'silver' | 'gold' | 'elite' | 'icon';

export interface EloChange {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

export interface ChemistryChange {
  pairKey: string;
  delta: number;
}

export interface MatchTracking {
  trackedAt: string;
  teams: [string[], string[]];
  score: string;
  mvp: string | null;
  winnerPlayers: string[];
  loserPlayers: string[];
  eloChanges: EloChange[];
  chemistryChanges: ChemistryChange[];
}

export interface Player {
  id: string;
  name: string;
  createdAt: string;
  currentElo?: number;
  peakElo?: number;
  allTimeBestElo?: number;
  eloTier?: EloTier;
}

export interface SetScore {
  team1Games: number;
  team2Games: number;
  tiebreak?: { team1Points: number; team2Points: number };
}

export interface Match1vs1 {
  id: string;
  type: '1vs1';
  date: string;
  player1: string;
  player2: string;
  setsToWin: number;
  sets: SetScore[];
  winner: 1 | 2 | null;
  status: 'in_progress' | 'completed';
  matchTracking?: MatchTracking;
}

export interface Match2vs2 {
  id: string;
  type: '2vs2';
  date: string;
  team1: [string, string];
  team2: [string, string];
  setsToWin: number;
  sets: SetScore[];
  winner: 1 | 2 | null;
  status: 'in_progress' | 'completed';
  matchTracking?: MatchTracking;
}

export interface TournamentTeam {
  id: string;
  players: [string, string];
  seed: number;
}

export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
  setsToWin: number;
  sets: SetScore[];
  winnerId: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  court?: number;
}

export interface Tournament {
  id: string;
  type: '2vs2-tournament';
  date: string;
  players: string[];
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  setsPerRound: Record<number, number>;
  courts: number;
  status: 'in_progress' | 'completed';
  winner: string | null;
}

export interface AmericanoGame {
  id: string;
  round: number;
  court: number;
  team1: [string, string];
  team2: [string, string];
  team1Score: number;
  team2Score: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AmericanoTournament {
  id: string;
  type: 'americano-klein' | 'americano-gross';
  date: string;
  players: string[];
  games: AmericanoGame[];
  pointsToWin: number;
  courts: number;
  currentRound: number;
  status: 'in_progress' | 'completed';
}

export type GameRecord = Match1vs1 | Match2vs2 | Tournament | AmericanoTournament;

export interface PlayerRanking {
  playerId: string;
  gamesPlayed: number;
  americanoPoints: number;
  americanoWins: number;
  twovstwoWins: number;
  tournamentWins: number;
}
