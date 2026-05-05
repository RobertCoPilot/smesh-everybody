import { calculateEloLeaderboard, DEFAULT_ELO } from './elo';
import { calculateActivityStatus, calculatePlayerStreaks, getPlayerCompetitiveResults } from './phase2Engagement';
import type { AmericanoTournament, GameRecord, Match1vs1, Match2vs2, Player, SetScore, Tournament } from '@/types';

export type PairEntityType = 'player' | 'duo';
export type ArchetypeId = 'grinder' | 'clutcher' | 'choker' | 'coin-flip' | 'front-runner' | 'team-anchor' | 'rookie';

export interface DuoChemistrySummary {
  pairKey: string;
  players: [string, string];
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDifferential: number;
  recentResults: Array<{ gameId: string; date: string; won: boolean; scoreDifferential: number }>;
  chemistryScore: number;
  linkStrength: 'untested' | 'weak' | 'solid' | 'strong' | 'elite';
}

export interface DuoTitle {
  pairKey: string;
  title: string;
  reason: string;
}

export interface RivalrySummary {
  rivalryKey: string;
  entityType: PairEntityType;
  sideA: string[];
  sideB: string[];
  encounters: number;
  winsA: number;
  winsB: number;
  closeMatches: number;
  averageEloGap: number | null;
  intensity: number;
  recentWinner: string[] | null;
  history: Array<{ gameId: string; date: string; winner: 'A' | 'B'; close: boolean }>;
}

export interface PlayerArchetypeSummary {
  playerId: string;
  primary: ArchetypeId;
  secondary: ArchetypeId | null;
  scores: Record<ArchetypeId, number>;
  reasons: string[];
}

export interface TeamBalanceOption {
  teams: [[string, string], [string, string]];
  eloGap: number;
  chemistryGap: number;
  activityGap: number;
  balanceScore: number;
  explanation: string;
}

export interface Phase3SocialStatsSummary {
  chemistry: Map<string, DuoChemistrySummary>;
  duoTitles: Map<string, DuoTitle>;
  rivalries: RivalrySummary[];
  archetypes: Map<string, PlayerArchetypeSummary>;
}

interface TeamMatch {
  id: string;
  date: string;
  team1: string[];
  team2: string[];
  winner: 1 | 2;
  sets: SetScore[];
}

const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  grinder: 'Grinder',
  clutcher: 'Clutcher',
  choker: 'Choker',
  'coin-flip': 'Coin Flip Player',
  'front-runner': 'Front Runner',
  'team-anchor': 'Team Anchor',
  rookie: 'Rookie',
};

export function pairKey(ids: string[]): string {
  return [...ids].sort().join(':');
}

function completedTeamMatches(games: GameRecord[]): TeamMatch[] {
  const matches: TeamMatch[] = [];
  for (const game of games) {
    if (game.type === '1vs1' && game.status === 'completed' && game.winner) {
      matches.push({ id: game.id, date: game.date, team1: [game.player1], team2: [game.player2], winner: game.winner, sets: game.sets });
    }
    if (game.type === '2vs2' && game.status === 'completed' && game.winner) {
      matches.push({ id: game.id, date: game.date, team1: [...game.team1], team2: [...game.team2], winner: game.winner, sets: game.sets });
    }
    if (game.type === '2vs2-tournament') {
      collectTournamentMatches(game).forEach((match) => matches.push(match));
    }
    if (game.type === 'americano-klein' || game.type === 'americano-gross') {
      collectAmericanoMatches(game).forEach((match) => matches.push(match));
    }
  }
  return matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function collectTournamentMatches(tournament: Tournament): TeamMatch[] {
  return tournament.matches.flatMap((match) => {
    if (match.status !== 'completed' || !match.winnerId || !match.team1Id || !match.team2Id) return [];
    const team1 = tournament.teams.find((team) => team.id === match.team1Id);
    const team2 = tournament.teams.find((team) => team.id === match.team2Id);
    if (!team1 || !team2) return [];
    return [{
      id: `${tournament.id}:${match.id}`,
      date: tournament.date,
      team1: [...team1.players],
      team2: [...team2.players],
      winner: match.winnerId === match.team1Id ? 1 as const : 2 as const,
      sets: match.sets,
    }];
  });
}

function collectAmericanoMatches(tournament: AmericanoTournament): TeamMatch[] {
  return tournament.games.flatMap((game) => {
    if (game.status !== 'completed') return [];
    const winner = game.team1Score >= game.team2Score ? 1 as const : 2 as const;
    return [{
      id: `${tournament.id}:${game.id}`,
      date: tournament.date,
      team1: [...game.team1],
      team2: [...game.team2],
      winner,
      sets: [{ team1Games: game.team1Score, team2Games: game.team2Score }],
    }];
  });
}

function isCloseScore(sets: SetScore[]): boolean {
  const setDiff = Math.abs(sets.reduce((sum, set) => sum + set.team1Games - set.team2Games, 0));
  return setDiff <= 3 || sets.some((set) => Math.abs(set.team1Games - set.team2Games) <= 2 || Boolean(set.tiebreak));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function linkStrength(score: number): DuoChemistrySummary['linkStrength'] {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'solid';
  if (score > 0) return 'weak';
  return 'untested';
}

export function deriveChemistrySummaries(games: GameRecord[]): Map<string, DuoChemistrySummary> {
  const summaries = new Map<string, DuoChemistrySummary>();
  for (const match of completedTeamMatches(games)) {
    for (const [team, won] of [[match.team1, match.winner === 1], [match.team2, match.winner === 2]] as const) {
      if (team.length !== 2) continue;
      const key = pairKey(team);
      const existing = summaries.get(key) ?? {
        pairKey: key,
        players: [...team].sort() as [string, string],
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        scoreDifferential: 0,
        recentResults: [],
        chemistryScore: 0,
        linkStrength: 'untested' as const,
      };
      const teamIsOne = pairKey(team) === pairKey(match.team1);
      const pointsFor = match.sets.reduce((sum, set) => sum + (teamIsOne ? set.team1Games : set.team2Games), 0);
      const pointsAgainst = match.sets.reduce((sum, set) => sum + (teamIsOne ? set.team2Games : set.team1Games), 0);
      const diff = pointsFor - pointsAgainst;
      existing.matchesPlayed += 1;
      existing.wins += won ? 1 : 0;
      existing.losses += won ? 0 : 1;
      existing.pointsFor += pointsFor;
      existing.pointsAgainst += pointsAgainst;
      existing.scoreDifferential += diff;
      existing.recentResults.push({ gameId: match.id, date: match.date, won, scoreDifferential: diff });
      existing.recentResults = existing.recentResults.slice(-5);
      existing.winRate = existing.matchesPlayed > 0 ? existing.wins / existing.matchesPlayed : 0;
      const volume = Math.min(existing.matchesPlayed, 10) * 4;
      const performance = (existing.winRate - 0.5) * 45;
      const margin = clamp(existing.scoreDifferential, -30, 30) * 0.8;
      existing.chemistryScore = Math.round(clamp(45 + volume + performance + margin, 0, 100));
      existing.linkStrength = linkStrength(existing.chemistryScore);
      summaries.set(key, existing);
    }
  }
  return summaries;
}

export function deriveChemistryScoreMap(games: GameRecord[], pairs: Array<[string, string]> = []): Record<string, number> {
  const chemistry = deriveChemistrySummaries(games);
  const scores = Object.fromEntries([...chemistry.values()].map((duo) => [duo.pairKey, duo.chemistryScore]));
  for (const pair of pairs) {
    const key = pairKey(pair);
    if (scores[key] !== undefined) continue;
    scores[key] = deriveProvisionalChemistryScore(pair, games);
  }
  return scores;
}

function deriveProvisionalChemistryScore(pair: [string, string], games: GameRecord[]): number {
  const [a, b] = pair;
  const aResults = getPlayerCompetitiveResults(a, games);
  const bResults = getPlayerCompetitiveResults(b, games);
  const sharedOpponents = new Set<string>();
  for (const game of games) {
    if ((game.type !== '1vs1' && game.type !== '2vs2') || game.status !== 'completed') continue;
    const participants = game.type === '1vs1' ? [game.player1, game.player2] : [...game.team1, ...game.team2];
    if (participants.includes(a) && !participants.includes(b)) participants.filter((id) => id !== a).forEach((id) => sharedOpponents.add(id));
    if (participants.includes(b) && !participants.includes(a)) participants.filter((id) => id !== b).forEach((id) => sharedOpponents.add(id));
  }
  const aWinRate = aResults.length ? aResults.filter((result) => result.won).length / aResults.length : 0.5;
  const bWinRate = bResults.length ? bResults.filter((result) => result.won).length / bResults.length : 0.5;
  const experience = Math.min(aResults.length + bResults.length, 20) * 0.8;
  const form = ((aWinRate + bWinRate) / 2 - 0.5) * 28;
  const commonContext = Math.min(sharedOpponents.size, 6) * 2;
  return Math.round(clamp(35 + experience + form + commonContext, 20, 65));
}

export function deriveDuoTitles(chemistry: Map<string, DuoChemistrySummary>, players: Player[] = []): Map<string, DuoTitle> {
  const names = new Map(players.map((player) => [player.id, player.name]));
  const titles = new Map<string, DuoTitle>();
  for (const duo of chemistry.values()) {
    const [a, b] = duo.players.map((id) => names.get(id) ?? id);
    let title = 'Court Compadres';
    let reason = 'Reliable duo with enough shared match data.';
    if (duo.matchesPlayed < 2) {
      title = 'Fresh Pair';
      reason = 'Still building chemistry.';
    } else if (duo.winRate >= 0.75 && duo.scoreDifferential > 10) {
      title = 'Smash Syndicate';
      reason = 'High win rate with a strong score margin.';
    } else if (duo.recentResults.slice(-3).length === 3 && duo.recentResults.slice(-3).every((result) => result.won)) {
      title = 'Hot Hands';
      reason = 'Won their last three matches together.';
    } else if (duo.scoreDifferential < -8) {
      title = 'Chaos Partnership';
      reason = 'Entertaining but still searching for control.';
    } else if (duo.winRate >= 0.55) {
      title = 'Net Alliance';
      reason = 'Positive record as a team.';
    } else if ((a[0] ?? '').toLowerCase() === (b[0] ?? '').toLowerCase()) {
      title = 'Initial Twins';
      reason = 'Same initial, shared court identity.';
    }
    titles.set(duo.pairKey, { pairKey: duo.pairKey, title, reason });
  }
  return titles;
}

export function deriveRivalries(
  players: Player[],
  games: GameRecord[],
  options: { minEncounters?: number; maxEloGap?: number } = {},
): RivalrySummary[] {
  const minEncounters = options.minEncounters ?? 3;
  const maxEloGap = options.maxEloGap ?? 220;
  const elo = new Map(calculateEloLeaderboard(players, games).map((row) => [row.playerId, row.currentElo]));
  const rivalries = new Map<string, RivalrySummary>();

  for (const match of completedTeamMatches(games)) {
    const entities: Array<{ type: PairEntityType; a: string[]; b: string[] }> = [];
    for (const a of match.team1) for (const b of match.team2) entities.push({ type: 'player', a: [a], b: [b] });
    if (match.team1.length === 2 && match.team2.length === 2) entities.push({ type: 'duo', a: [...match.team1].sort(), b: [...match.team2].sort() });

    for (const entity of entities) {
      const aKey = pairKey(entity.a);
      const bKey = pairKey(entity.b);
      const [sideA, sideB] = aKey < bKey ? [entity.a, entity.b] : [entity.b, entity.a];
      const key = `${entity.type}:${pairKey(sideA)}|${pairKey(sideB)}`;
      const winnerKey = match.winner === 1 ? pairKey(match.team1.filter((id) => entity.a.includes(id) || entity.b.includes(id))) : pairKey(match.team2.filter((id) => entity.a.includes(id) || entity.b.includes(id)));
      const winner: 'A' | 'B' = winnerKey === pairKey(sideA) ? 'A' : 'B';
      const existing = rivalries.get(key) ?? {
        rivalryKey: key,
        entityType: entity.type,
        sideA: [...sideA],
        sideB: [...sideB],
        encounters: 0,
        winsA: 0,
        winsB: 0,
        closeMatches: 0,
        averageEloGap: null,
        intensity: 0,
        recentWinner: null,
        history: [],
      };
      existing.encounters += 1;
      existing.winsA += winner === 'A' ? 1 : 0;
      existing.winsB += winner === 'B' ? 1 : 0;
      const close = isCloseScore(match.sets);
      existing.closeMatches += close ? 1 : 0;
      const sideAElo = sideA.reduce((sum, id) => sum + (elo.get(id) ?? DEFAULT_ELO), 0) / sideA.length;
      const sideBElo = sideB.reduce((sum, id) => sum + (elo.get(id) ?? DEFAULT_ELO), 0) / sideB.length;
      const gap = Math.abs(sideAElo - sideBElo);
      existing.averageEloGap = existing.averageEloGap === null
        ? gap
        : ((existing.averageEloGap * (existing.encounters - 1)) + gap) / existing.encounters;
      existing.recentWinner = winner === 'A' ? [...sideA] : [...sideB];
      existing.history.push({ gameId: match.id, date: match.date, winner, close });
      existing.history = existing.history.slice(-8);
      rivalries.set(key, existing);
    }
  }

  return [...rivalries.values()]
    .filter((rivalry) => rivalry.encounters >= minEncounters && (rivalry.averageEloGap ?? 0) <= maxEloGap)
    .map((rivalry) => {
      const splitScore = 1 - Math.abs(rivalry.winsA - rivalry.winsB) / rivalry.encounters;
      const closeScore = rivalry.closeMatches / rivalry.encounters;
      const repeatScore = Math.min(rivalry.encounters / 8, 1);
      return { ...rivalry, intensity: Math.round(clamp((repeatScore * 35 + closeScore * 40 + splitScore * 25), 0, 100)) };
    })
    .sort((a, b) => b.intensity - a.intensity || b.encounters - a.encounters);
}

export function deriveArchetypes(playerId: string, games: GameRecord[]): PlayerArchetypeSummary {
  const results = getPlayerCompetitiveResults(playerId, games);
  const streaks = calculatePlayerStreaks(playerId, games);
  const scores: Record<ArchetypeId, number> = { grinder: 0, clutcher: 0, choker: 0, 'coin-flip': 0, 'front-runner': 0, 'team-anchor': 0, rookie: 0 };
  const reasons: string[] = [];

  if (results.length < 3) {
    scores.rookie = 80;
    reasons.push('Needs more completed matches for a stable read.');
  }

  let closeWins = 0;
  let closeLosses = 0;
  let straightWins = 0;
  let volatileSwings = 0;
  const outcomes = results.map((result) => result.won);
  for (const result of results) {
    const game = games.find((item) => item.id === result.gameId) as Match1vs1 | Match2vs2 | undefined;
    if (!game || (game.type !== '1vs1' && game.type !== '2vs2')) continue;
    const close = isCloseScore(game.sets);
    if (close && result.won) closeWins += 1;
    if (close && !result.won) closeLosses += 1;
    if (result.won && game.sets.every((set) => {
      const team1 = game.type === '1vs1' ? [game.player1] : game.team1;
      const onTeam1 = team1.includes(playerId);
      return onTeam1 ? set.team1Games > set.team2Games : set.team2Games > set.team1Games;
    })) straightWins += 1;
  }
  for (let i = 1; i < outcomes.length; i += 1) if (outcomes[i] !== outcomes[i - 1]) volatileSwings += 1;

  const winRate = results.length ? results.filter((result) => result.won).length / results.length : 0;
  scores.clutcher = closeWins * 22 + streaks.comebackWins * 14;
  scores.choker = closeLosses * 22 + Math.max(0, streaks.bestLosingStreak - 2) * 8;
  scores.grinder = results.length * 3 + streaks.comebackWins * 16 + (closeWins + closeLosses) * 8;
  scores['coin-flip'] = results.length >= 6 && winRate > 0.4 && winRate < 0.6 ? 55 + volatileSwings * 5 : volatileSwings * 4;
  scores['front-runner'] = straightWins * 15 + Math.max(0, streaks.bestWinStreak - 2) * 10;
  scores['team-anchor'] = results.filter((result) => result.doubles && result.won).length * 10;

  if (closeWins > closeLosses) reasons.push('Wins tight sets more often than not.');
  if (closeLosses > closeWins) reasons.push('Frequently lands on the wrong side of tight sets.');
  if (streaks.comebackWins > 0) reasons.push('Has comeback wins after losing the first set.');
  if (volatileSwings >= 4) reasons.push('Results alternate frequently.');

  const ranked = (Object.keys(scores) as ArchetypeId[]).sort((a, b) => scores[b] - scores[a]);
  return {
    playerId,
    primary: ranked[0],
    secondary: scores[ranked[1]] >= 35 ? ranked[1] : null,
    scores,
    reasons: reasons.length > 0 ? reasons : [`Default read: ${ARCHETYPE_LABELS[ranked[0]]}.`],
  };
}

export function deriveTeamBalanceOptions(players: Player[], games: GameRecord[], playerIds: string[]): TeamBalanceOption[] {
  const uniqueIds = [...new Set(playerIds)];
  if (uniqueIds.length !== 4) return [];
  const leaderboard = new Map(calculateEloLeaderboard(players, games).map((row) => [row.playerId, row.currentElo]));
  const chemistry = deriveChemistrySummaries(games);
  const activity = new Map(uniqueIds.map((id) => [id, calculateActivityStatus(id, games).confidence]));
  const seen = new Set<string>();
  const options: TeamBalanceOption[] = [];

  for (let i = 0; i < uniqueIds.length; i += 1) {
    for (let j = i + 1; j < uniqueIds.length; j += 1) {
      const team1 = [uniqueIds[i], uniqueIds[j]] as [string, string];
      const team2 = uniqueIds.filter((id) => !team1.includes(id)) as [string, string];
      const canonical = [pairKey(team1), pairKey(team2)].sort().join('|');
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      const teamElo = (team: [string, string]) => team.reduce((sum, id) => sum + (leaderboard.get(id) ?? DEFAULT_ELO), 0);
      const teamActivity = (team: [string, string]) => team.reduce((sum, id) => sum + (activity.get(id) ?? 0), 0) / 2;
      const teamChemistry = (team: [string, string]) => chemistry.get(pairKey(team))?.chemistryScore ?? 35;
      const eloGap = Math.abs(teamElo(team1) - teamElo(team2));
      const chemistryGap = Math.abs(teamChemistry(team1) - teamChemistry(team2));
      const activityGap = Math.abs(teamActivity(team1) - teamActivity(team2));
      const balanceScore = Math.round(clamp(100 - eloGap / 8 - chemistryGap * 0.7 - activityGap * 0.3, 0, 100));
      options.push({
        teams: [team1, team2],
        eloGap,
        chemistryGap,
        activityGap,
        balanceScore,
        explanation: `ELO gap ${Math.round(eloGap)}, chemistry gap ${Math.round(chemistryGap)}, activity gap ${Math.round(activityGap)}.`,
      });
    }
  }

  return options.sort((a, b) => b.balanceScore - a.balanceScore || a.eloGap - b.eloGap);
}

export function derivePhase3SocialStats(players: Player[], games: GameRecord[]): Phase3SocialStatsSummary {
  const chemistry = deriveChemistrySummaries(games);
  return {
    chemistry,
    duoTitles: deriveDuoTitles(chemistry, players),
    rivalries: deriveRivalries(players, games),
    archetypes: new Map(players.map((player) => [player.id, deriveArchetypes(player.id, games)])),
  };
}
