import { v4 as uuidv4 } from 'uuid';
import type { AmericanoGame } from '@/types';

// Track how many consecutive rounds each player has rested
// Prioritize matchups that include players who've been sitting out longest
function priorityScore(
  players: string[],
  restCounts: Map<string, number>
): number {
  return players.reduce((sum, p) => sum + (restCounts.get(p) || 0), 0);
}

// Generate Americano Klein schedule: every player partners with every other player once
export function generateAmericanoKleinSchedule(
  playerIds: string[],
  courts: number
): AmericanoGame[] {
  const n = playerIds.length;
  if (n < 4) return [];

  // Generate all matchups: each partnership paired with a non-overlapping partnership
  const partnerships = generateAllPartnerships(n);
  const allMatchups: { team1: [string, string]; team2: [string, string]; partnerKeys: [string, string] }[] = [];

  for (let a = 0; a < partnerships.length; a++) {
    for (let b = a + 1; b < partnerships.length; b++) {
      const [i1, i2] = partnerships[a];
      const [i3, i4] = partnerships[b];
      if (i1 === i3 || i1 === i4 || i2 === i3 || i2 === i4) continue;
      allMatchups.push({
        team1: [playerIds[i1], playerIds[i2]],
        team2: [playerIds[i3], playerIds[i4]],
        partnerKeys: [`${i1}-${i2}`, `${i3}-${i4}`],
      });
    }
  }

  // We need exactly one game per partnership
  const usedPartnerships = new Set<string>();
  const games: AmericanoGame[] = [];
  const restCounts = new Map<string, number>(playerIds.map((p) => [p, 0]));
  let round = 0;

  while (usedPartnerships.size < partnerships.length) {
    // Filter to matchups where at least one partnership is unused
    const candidates = allMatchups.filter(
      (m) => !usedPartnerships.has(m.partnerKeys[0]) || !usedPartnerships.has(m.partnerKeys[1])
    ).filter(
      (m) => !usedPartnerships.has(m.partnerKeys[0]) && !usedPartnerships.has(m.partnerKeys[1])
    );

    if (candidates.length === 0) {
      // Try matchups where at least one partnership is unused
      const partial = allMatchups.filter(
        (m) => !usedPartnerships.has(m.partnerKeys[0]) || !usedPartnerships.has(m.partnerKeys[1])
      );
      if (partial.length === 0) break;
      // Use the old greedy method for remaining
      const leftover = scheduleRoundLegacy(playerIds, partnerships, usedPartnerships, courts, round);
      if (leftover.length === 0) break;
      games.push(...leftover);
      // Update rest counts
      const playedThisRound = new Set<string>();
      for (const g of leftover) { [...g.team1, ...g.team2].forEach((p) => playedThisRound.add(p)); }
      for (const p of playerIds) {
        restCounts.set(p, playedThisRound.has(p) ? 0 : (restCounts.get(p) || 0) + 1);
      }
      round++;
      continue;
    }

    // Sort candidates by rest priority (prefer matchups with rested players)
    candidates.sort((a, b) => {
      const pa = [...a.team1, ...a.team2];
      const pb = [...b.team1, ...b.team2];
      return priorityScore(pb, restCounts) - priorityScore(pa, restCounts);
    });

    // Greedily fill the round
    const usedInRound = new Set<string>();
    const roundGames: AmericanoGame[] = [];
    let court = 0;

    for (const m of candidates) {
      if (court >= courts) break;
      if (usedPartnerships.has(m.partnerKeys[0]) || usedPartnerships.has(m.partnerKeys[1])) continue;
      const players = [...m.team1, ...m.team2];
      if (players.some((p) => usedInRound.has(p))) continue;

      const swap = Math.random() < 0.5;
      roundGames.push({
        id: uuidv4(),
        round,
        court,
        team1: swap ? m.team2 : m.team1,
        team2: swap ? m.team1 : m.team2,
        team1Score: 0,
        team2Score: 0,
        status: 'pending',
      });

      players.forEach((p) => usedInRound.add(p));
      usedPartnerships.add(m.partnerKeys[0]);
      usedPartnerships.add(m.partnerKeys[1]);
      court++;
    }

    if (roundGames.length === 0) break;
    games.push(...roundGames);

    // Update rest counts
    for (const p of playerIds) {
      restCounts.set(p, usedInRound.has(p) ? 0 : (restCounts.get(p) || 0) + 1);
    }
    round++;
  }

  return games;
}

// Generate Americano Groß schedule: every possible 2v2 matchup
export function generateAmericanoGrossSchedule(
  playerIds: string[],
  courts: number
): AmericanoGame[] {
  const n = playerIds.length;
  if (n < 4) return [];

  // Generate ALL unique matchups
  const allMatchups: { team1: [string, string]; team2: [string, string] }[] = [];

  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          const p = [playerIds[a], playerIds[b], playerIds[c], playerIds[d]];
          allMatchups.push({ team1: [p[0], p[1]], team2: [p[2], p[3]] });
          allMatchups.push({ team1: [p[0], p[2]], team2: [p[1], p[3]] });
          allMatchups.push({ team1: [p[0], p[3]], team2: [p[1], p[2]] });
        }
      }
    }
  }

  // Schedule with balanced rest: always prefer matchups with players who rested most
  const games: AmericanoGame[] = [];
  const remaining = [...allMatchups];
  const restCounts = new Map<string, number>(playerIds.map((p) => [p, 0]));
  let round = 0;

  while (remaining.length > 0) {
    // Sort remaining by rest priority (highest rest first)
    remaining.sort((a, b) => {
      const pa = [...a.team1, ...a.team2];
      const pb = [...b.team1, ...b.team2];
      return priorityScore(pb, restCounts) - priorityScore(pa, restCounts);
    });

    const usedInRound = new Set<string>();
    const scheduled: number[] = [];
    let court = 0;

    for (let i = 0; i < remaining.length && court < courts; i++) {
      const m = remaining[i];
      const players = [...m.team1, ...m.team2];
      if (players.some((p) => usedInRound.has(p))) continue;

      const swap = Math.random() < 0.5;
      games.push({
        id: uuidv4(),
        round,
        court,
        team1: swap ? m.team2 : m.team1,
        team2: swap ? m.team1 : m.team2,
        team1Score: 0,
        team2Score: 0,
        status: 'pending',
      });

      players.forEach((p) => usedInRound.add(p));
      scheduled.push(i);
      court++;
    }

    if (scheduled.length === 0) break;
    for (let i = scheduled.length - 1; i >= 0; i--) {
      remaining.splice(scheduled[i], 1);
    }

    // Update rest counts
    for (const p of playerIds) {
      restCounts.set(p, usedInRound.has(p) ? 0 : (restCounts.get(p) || 0) + 1);
    }
    round++;
  }

  return games;
}

function generateAllPartnerships(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

function scheduleRoundLegacy(
  playerIds: string[],
  allPartnerships: [number, number][],
  usedPartnerships: Set<string>,
  maxCourts: number,
  round: number
): AmericanoGame[] {
  const games: AmericanoGame[] = [];
  const usedInRound = new Set<number>();
  let court = 0;

  // Find unused partnerships and try to form games
  const availablePartnerships = allPartnerships.filter(
    ([i, j]) => !usedPartnerships.has(`${i}-${j}`)
  );

  // Greedily pair partnerships into games
  const usedThisRound = new Set<string>();

  for (let a = 0; a < availablePartnerships.length && court < maxCourts; a++) {
    const [p1, p2] = availablePartnerships[a];
    if (usedInRound.has(p1) || usedInRound.has(p2)) continue;
    if (usedThisRound.has(`${p1}-${p2}`)) continue;

    // Find a second partnership with no overlapping players
    for (let b = a + 1; b < availablePartnerships.length; b++) {
      const [p3, p4] = availablePartnerships[b];
      if (usedInRound.has(p3) || usedInRound.has(p4)) continue;
      if (p3 === p1 || p3 === p2 || p4 === p1 || p4 === p2) continue;
      if (usedThisRound.has(`${p3}-${p4}`)) continue;

      // Create the game – randomize which partnership is team1 vs team2
      const swapSides = Math.random() < 0.5;
      const game: AmericanoGame = {
        id: uuidv4(),
        round,
        court,
        team1: swapSides ? [playerIds[p3], playerIds[p4]] : [playerIds[p1], playerIds[p2]],
        team2: swapSides ? [playerIds[p1], playerIds[p2]] : [playerIds[p3], playerIds[p4]],
        team1Score: 0,
        team2Score: 0,
        status: 'pending',
      };

      games.push(game);
      usedInRound.add(p1);
      usedInRound.add(p2);
      usedInRound.add(p3);
      usedInRound.add(p4);
      usedPartnerships.add(`${p1}-${p2}`);
      usedPartnerships.add(`${p3}-${p4}`);
      usedThisRound.add(`${p1}-${p2}`);
      usedThisRound.add(`${p3}-${p4}`);
      court++;
      break;
    }
  }

  return games;
}

// Get the leaderboard for an Americano tournament
export function getAmericanoLeaderboard(
  games: AmericanoGame[],
  playerIds: string[]
): { playerId: string; points: number; avgPoints: number; wins: number; gamesPlayed: number }[] {
  const stats: Record<string, { points: number; wins: number; gamesPlayed: number }> = {};

  for (const pid of playerIds) {
    stats[pid] = { points: 0, wins: 0, gamesPlayed: 0 };
  }

  for (const game of games) {
    if (game.status !== 'completed') continue;

    for (const pid of game.team1) {
      if (stats[pid]) {
        stats[pid].points += game.team1Score;
        stats[pid].gamesPlayed++;
        if (game.team1Score > game.team2Score) stats[pid].wins++;
      }
    }
    for (const pid of game.team2) {
      if (stats[pid]) {
        stats[pid].points += game.team2Score;
        stats[pid].gamesPlayed++;
        if (game.team2Score > game.team1Score) stats[pid].wins++;
      }
    }
  }

  // Check if all players have equal games played
  const gameCounts = playerIds.map((pid) => stats[pid].gamesPlayed);
  const allEqual = gameCounts.every((c) => c === gameCounts[0]);

  return playerIds
    .map((pid) => ({
      playerId: pid,
      ...stats[pid],
      avgPoints: stats[pid].gamesPlayed > 0
        ? Math.round((stats[pid].points / stats[pid].gamesPlayed) * 100) / 100
        : 0,
    }))
    .sort((a, b) => {
      // If unequal games, sort by average points; otherwise by total points
      if (!allEqual) {
        if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
      } else {
        if (b.points !== a.points) return b.points - a.points;
      }
      return b.wins - a.wins;
    });
}
