import { v4 as uuidv4 } from 'uuid';
import type { TournamentTeam, TournamentMatch } from '@/types';

export function generateTeams(
  playerIds: string[],
  mode: 'manual' | 'random' | 'skill-based',
  manualTeams?: [string, string][],
  rankings?: Record<string, number>
): TournamentTeam[] {
  if (mode === 'manual' && manualTeams) {
    return manualTeams.map((players, i) => ({
      id: uuidv4(),
      players: players as [string, string],
      seed: i + 1,
    }));
  }

  const shuffled = [...playerIds];

  if (mode === 'random') {
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const teams: TournamentTeam[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      teams.push({
        id: uuidv4(),
        players: [shuffled[i], shuffled[i + 1]] as [string, string],
        seed: teams.length + 1,
      });
    }
    return teams;
  }

  // Skill-based: pair best with worst for balance
  if (mode === 'skill-based' && rankings) {
    const sorted = [...playerIds].sort(
      (a, b) => (rankings[b] || 0) - (rankings[a] || 0)
    );
    const teams: TournamentTeam[] = [];
    const half = Math.floor(sorted.length / 2);
    for (let i = 0; i < half; i++) {
      teams.push({
        id: uuidv4(),
        players: [sorted[i], sorted[sorted.length - 1 - i]] as [string, string],
        seed: i + 1,
      });
    }
    return teams;
  }

  return [];
}

export function generateBracket(
  teams: TournamentTeam[],
  setsPerRound: Record<number, number>
): TournamentMatch[] {
  const numTeams = teams.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numTeams)));
  const totalRounds = Math.ceil(Math.log2(nextPowerOf2));
  const matches: TournamentMatch[] = [];

  // First round with byes
  const firstRoundSize = nextPowerOf2 / 2;

  // Seed ordering for bracket placement
  const slots: (TournamentTeam | null)[] = new Array(nextPowerOf2).fill(null);
  for (let i = 0; i < teams.length; i++) {
    slots[i] = teams[i];
  }

  // Generate first round matches
  for (let i = 0; i < firstRoundSize; i++) {
    const team1 = slots[i * 2];
    const team2 = slots[i * 2 + 1];

    // Randomize which team is on which side of the court
    const swapSides = Math.random() < 0.5;
    const sideA = swapSides ? team2 : team1;
    const sideB = swapSides ? team1 : team2;

    const match: TournamentMatch = {
      id: uuidv4(),
      round: 0,
      position: i,
      team1Id: sideA?.id || null,
      team2Id: sideB?.id || null,
      setsToWin: setsPerRound[0] || 1,
      sets: [],
      winnerId: null,
      status: 'pending',
    };

    // If one team has a bye, auto-advance
    if (sideA && !sideB) {
      match.winnerId = sideA.id;
      match.status = 'completed';
    } else if (sideB && !sideA) {
      match.winnerId = sideB.id;
      match.status = 'completed';
    }

    matches.push(match);
  }

  // Generate subsequent round matches (empty)
  for (let round = 1; round < totalRounds; round++) {
    const matchesInRound = firstRoundSize / Math.pow(2, round);
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: uuidv4(),
        round,
        position: i,
        team1Id: null,
        team2Id: null,
        setsToWin: setsPerRound[round] || setsPerRound[0] || 1,
        sets: [],
        winnerId: null,
        status: 'pending',
      });
    }
  }

  // Propagate byes to next round
  propagateWinners(matches);

  return matches;
}

export function propagateWinners(matches: TournamentMatch[]): void {
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);

  for (let r = 0; r < rounds.length - 1; r++) {
    const currentRound = matches.filter(m => m.round === rounds[r]);
    const nextRound = matches.filter(m => m.round === rounds[r + 1]);

    for (const match of currentRound) {
      if (!match.winnerId) continue;

      const nextMatchIndex = Math.floor(match.position / 2);
      const nextMatch = nextRound[nextMatchIndex];
      if (!nextMatch) continue;

      // Randomize court sides for later rounds
      if (match.position % 2 === 0) {
        const goToTeam1 = Math.random() < 0.5;
        if (goToTeam1) {
          nextMatch.team1Id = match.winnerId;
        } else {
          nextMatch.team2Id = match.winnerId;
        }
      } else {
        // Fill whichever slot is still empty
        if (!nextMatch.team1Id) {
          nextMatch.team1Id = match.winnerId;
        } else {
          nextMatch.team2Id = match.winnerId;
        }
      }
    }
  }
}

export function getRoundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  switch (fromEnd) {
    case 0: return 'Final';
    case 1: return 'Semifinals';
    case 2: return 'Quarterfinals';
    case 3: return 'Round of 16';
    default: return `Round ${round + 1}`;
  }
}
