'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { propagateWinners, getRoundName } from '@/lib/tournament';
import {
  isSetComplete,
  getSetWinner,
  needsTiebreak,
  getMatchWinner,
  getSetsScore,
  formatSetScore,
} from '@/lib/scoring';
import type { Tournament, TournamentMatch, TournamentTeam, SetScore } from '@/types';
import CourtCard from '@/components/CourtCard';

function getRoundNameDE(round: number, totalRounds: number): string {
  const name = getRoundName(round, totalRounds);
  const translations: Record<string, string> = {
    'Final': 'Finale',
    'Semifinals': 'Halbfinale',
    'Quarterfinals': 'Viertelfinale',
    'Round of 16': 'Achtelfinale',
  };
  if (translations[name]) return translations[name];
  const m = name.match(/^Round (\d+)$/);
  if (m) return `Runde ${m[1]}`;
  return name;
}

export default function TournamentPage() {
  const params = useParams();
  const router = useRouter();
  const { getGame, updateGame, getPlayer } = useGameStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const tournament = getGame(params.id as string) as Tournament | undefined;

  const totalRounds = useMemo(() => {
    if (!tournament) return 0;
    return Math.max(...tournament.matches.map((m) => m.round)) + 1;
  }, [tournament]);

  const getTeam = useCallback(
    (teamId: string | null): TournamentTeam | undefined => {
      if (!teamId || !tournament) return undefined;
      return tournament.teams.find((t) => t.id === teamId);
    },
    [tournament],
  );

  const getTeamName = useCallback(
    (teamId: string | null): string => {
      const team = getTeam(teamId);
      if (!team) return 'Offen';
      const p1 = getPlayer(team.players[0]);
      const p2 = getPlayer(team.players[1]);
      return `${p1?.name || '?'} & ${p2?.name || '?'}`;
    },
    [getTeam, getPlayer],
  );

  const getTeamShortName = useCallback(
    (teamId: string | null): string => {
      const team = getTeam(teamId);
      if (!team) return 'Offen';
      const p1 = getPlayer(team.players[0]);
      const p2 = getPlayer(team.players[1]);
      const short = (name: string | undefined) =>
        name ? (name.length > 6 ? name.slice(0, 6) + '.' : name) : '?';
      return `${short(p1?.name)} & ${short(p2?.name)}`;
    },
    [getTeam, getPlayer],
  );

  // Determine which matches can be played (both teams assigned, not completed)
  const playableMatchIds = useMemo(() => {
    if (!tournament) return new Set<string>();
    return new Set(
      tournament.matches
        .filter(
          (m) =>
            m.team1Id !== null &&
            m.team2Id !== null &&
            m.status !== 'completed',
        )
        .map((m) => m.id),
    );
  }, [tournament]);

  // Auto-assign courts to playable matches, avoiding player overlap
  const courtAssignments = useMemo(() => {
    if (!tournament) return new Map<string, number>();
    const assignments = new Map<string, number>();
    const usedCourts = new Set<number>();
    const activePlayers = new Set<string>();

    const playable = tournament.matches
      .filter((m) => playableMatchIds.has(m.id))
      .sort((a, b) => a.round - b.round || a.position - b.position);

    for (const match of playable) {
      if (usedCourts.size >= tournament.courts) break;

      const t1 = getTeam(match.team1Id);
      const t2 = getTeam(match.team2Id);
      if (!t1 || !t2) continue;

      const matchPlayers = [...t1.players, ...t2.players];
      if (matchPlayers.some((p) => activePlayers.has(p))) continue;

      let courtNum = 1;
      while (usedCourts.has(courtNum)) courtNum++;
      usedCourts.add(courtNum);
      assignments.set(match.id, courtNum);
      matchPlayers.forEach((p) => activePlayers.add(p));
    }

    return assignments;
  }, [tournament, playableMatchIds, getTeam]);

  const scoringMatch = useMemo(
    () => tournament?.matches.find((m) => m.id === scoringMatchId) || null,
    [tournament, scoringMatchId],
  );

  const handleScoreGame = (matchId: string, team: 1 | 2) => {
    if (!tournament) return;

    updateGame(tournament.id, (game) => {
      const t = { ...(game as Tournament) };
      const matches = t.matches.map((m) => ({ ...m, sets: m.sets.map((s) => ({ ...s })) }));
      const match = matches.find((m) => m.id === matchId);
      if (!match) return game;

      if (match.status === 'pending') match.status = 'in_progress';

      // Ensure there's a current set
      if (match.sets.length === 0) {
        match.sets.push({ team1Games: 0, team2Games: 0 });
      }

      const currentSet = match.sets[match.sets.length - 1];

      // If current set is complete, start new one (if match isn't won yet)
      if (isSetComplete(currentSet)) {
        const matchWinner = getMatchWinner(match.sets, match.setsToWin);
        if (matchWinner) return game; // match already won
        match.sets.push({ team1Games: 0, team2Games: 0 });
        const newSet = match.sets[match.sets.length - 1];
        if (team === 1) newSet.team1Games++;
        else newSet.team2Games++;
      } else if (needsTiebreak(currentSet) && !currentSet.tiebreak) {
        // Need to start tiebreak - can't add regular games
        return game;
      } else {
        if (team === 1) currentSet.team1Games++;
        else currentSet.team2Games++;
      }

      // Check if set complete → check match complete
      const latestSet = match.sets[match.sets.length - 1];
      if (isSetComplete(latestSet)) {
        const matchWinner = getMatchWinner(match.sets, match.setsToWin);
        if (matchWinner) {
          match.winnerId = matchWinner === 1 ? match.team1Id : match.team2Id;
          match.status = 'completed';
          propagateWinners(matches);

          // Check if tournament is complete (final match done)
          const maxRound = Math.max(...matches.map((m) => m.round));
          const finalMatch = matches.find((m) => m.round === maxRound);
          if (finalMatch?.status === 'completed' && finalMatch.winnerId) {
            t.status = 'completed';
            t.winner = finalMatch.winnerId;
          }
        }
      }

      t.matches = matches;
      return t as Tournament;
    });
  };

  const handleStartTiebreak = (matchId: string) => {
    if (!tournament) return;

    updateGame(tournament.id, (game) => {
      const t = { ...(game as Tournament) };
      const matches = t.matches.map((m) => ({ ...m, sets: m.sets.map((s) => ({ ...s })) }));
      const match = matches.find((m) => m.id === matchId);
      if (!match || match.sets.length === 0) return game;

      const currentSet = match.sets[match.sets.length - 1];
      if (!needsTiebreak(currentSet) || currentSet.tiebreak) return game;

      currentSet.tiebreak = { team1Points: 0, team2Points: 0 };
      t.matches = matches;
      return t as Tournament;
    });
  };

  const handleTiebreakPoint = (matchId: string, team: 1 | 2) => {
    if (!tournament) return;

    updateGame(tournament.id, (game) => {
      const t = { ...(game as Tournament) };
      const matches = t.matches.map((m) => ({ ...m, sets: m.sets.map((s) => ({ ...s })) }));
      const match = matches.find((m) => m.id === matchId);
      if (!match || match.sets.length === 0) return game;

      const currentSet = match.sets[match.sets.length - 1];
      if (!needsTiebreak(currentSet) || !currentSet.tiebreak) return game;

      if (team === 1) currentSet.tiebreak.team1Points++;
      else currentSet.tiebreak.team2Points++;

      // Check if tiebreak resolves the set
      if (isSetComplete(currentSet)) {
        const tbWinner = getSetWinner(currentSet);
        if (tbWinner === 1) currentSet.team1Games = 7;
        else if (tbWinner === 2) currentSet.team2Games = 7;

        // Check match winner
        const matchWinner = getMatchWinner(match.sets, match.setsToWin);
        if (matchWinner) {
          match.winnerId = matchWinner === 1 ? match.team1Id : match.team2Id;
          match.status = 'completed';
          propagateWinners(matches);

          const maxRound = Math.max(...matches.map((m) => m.round));
          const finalMatch = matches.find((m) => m.round === maxRound);
          if (finalMatch?.status === 'completed' && finalMatch.winnerId) {
            t.status = 'completed';
            t.winner = finalMatch.winnerId;
          }
        }
      }

      t.matches = matches;
      return t as Tournament;
    });
  };

  const handleUndoLastAction = (matchId: string) => {
    if (!tournament) return;

    updateGame(tournament.id, (game) => {
      const t = { ...(game as Tournament) };
      const matches = t.matches.map((m) => ({ ...m, sets: m.sets.map((s) => ({ ...s })) }));
      const match = matches.find((m) => m.id === matchId);
      if (!match || match.sets.length === 0) return game;

      const currentSet = match.sets[match.sets.length - 1];

      if (currentSet.tiebreak) {
        if (currentSet.tiebreak.team1Points === 0 && currentSet.tiebreak.team2Points === 0) {
          delete currentSet.tiebreak;
        } else if (currentSet.tiebreak.team1Points >= currentSet.tiebreak.team2Points) {
          currentSet.tiebreak.team1Points = Math.max(0, currentSet.tiebreak.team1Points - 1);
        } else {
          currentSet.tiebreak.team2Points = Math.max(0, currentSet.tiebreak.team2Points - 1);
        }
      } else if (currentSet.team1Games === 0 && currentSet.team2Games === 0) {
        // Empty set, remove it (go back to previous)
        if (match.sets.length > 1) {
          match.sets.pop();
        }
      } else {
        // Remove last game scored (heuristic: higher score gets decremented)
        if (currentSet.team1Games >= currentSet.team2Games) {
          currentSet.team1Games = Math.max(0, currentSet.team1Games - 1);
        } else {
          currentSet.team2Games = Math.max(0, currentSet.team2Games - 1);
        }
      }

      t.matches = matches;
      return t as Tournament;
    });
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-white/25">Laden...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-white/40">Turnier nicht gefunden</p>
        <button
          onClick={() => router.push('/')}
          className="btn-secondary px-5 py-2.5 text-sm"
        >
          Zur Startseite
        </button>
      </div>
    );
  }

  // Group matches by round
  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort(
    (a, b) => a - b,
  );

  return (
    <div className="min-h-screen text-white pb-20 animate-fade-in">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fade-in-up stagger-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="glass w-10 h-10 rounded-2xl flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              ←
            </button>
            <h1 className="gradient-text text-2xl font-bold tracking-tight">Turnier</h1>
          </div>
          {tournament.status === 'completed' && (
            <span className="pill bg-violet-500/10 text-violet-400 border border-violet-500/20">
              Abgeschlossen
            </span>
          )}
        </div>

        {/* Winner celebration */}
        {tournament.status === 'completed' && tournament.winner && (
          <div className="glass-card-static rounded-3xl p-6 mb-6 text-center animate-fade-in-scale relative overflow-hidden">
            <div className="absolute inset-0 bg-[#fa520f]/8" />
            <div className="relative">
              <div className="text-5xl mb-3">🏆</div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Champions</p>
              <p className="gradient-text-accent text-xl font-bold">
                {getTeamName(tournament.winner)}
              </p>
            </div>
          </div>
        )}

        {/* Bracket */}
        <div className="space-y-6">
          {rounds.map((round, roundIdx) => {
            const roundMatches = tournament.matches.filter((m) => m.round === round);
            const roundName = getRoundNameDE(round, totalRounds);

            return (
              <div key={round} className={`animate-fade-in-up stagger-${Math.min(roundIdx + 2, 6)}`}>
                <h2 className="gradient-text-accent text-xs font-semibold mb-3 uppercase tracking-wider">
                  {roundName}
                </h2>
                <div className="space-y-2">
                  {roundMatches.map((match) => {
                    const isPlayable = playableMatchIds.has(match.id);
                    const court = courtAssignments.get(match.id);
                    const isBye =
                      match.status === 'completed' &&
                      match.sets.length === 0 &&
                      match.winnerId !== null;
                    const setsScore = match.sets.length > 0 ? getSetsScore(match.sets) : null;

                    return (
                      <CourtCard
                        key={match.id}
                        compact
                        team1Players={[getTeamShortName(match.team1Id)]}
                        team2Players={[getTeamShortName(match.team2Id)]}
                        highlighted={isPlayable && !isBye}
                        completed={match.status === 'completed' && !isBye}
                        onClick={isPlayable && !isBye ? () => setScoringMatchId(match.id) : undefined}
                        team1Score={setsScore ? (
                          <span className={`text-sm font-mono ${match.winnerId === match.team1Id ? 'text-violet-400 font-bold' : 'text-white/50'}`}>
                            {setsScore[0]}
                          </span>
                        ) : undefined}
                        team2Score={setsScore ? (
                          <span className={`text-sm font-mono ${match.winnerId === match.team2Id ? 'text-violet-400 font-bold' : 'text-white/50'}`}>
                            {setsScore[1]}
                          </span>
                        ) : undefined}
                        statusBadge={
                          <>
                            {match.status === 'completed' && !isBye && (
                              <span className="pill bg-violet-500/10 text-violet-400 border border-violet-500/20 !text-[10px] !py-0.5">Fertig</span>
                            )}
                            {match.status === 'in_progress' && (
                              <span className="pill bg-blue-500/10 text-blue-400 border border-blue-500/20 !text-[10px] !py-0.5">Live</span>
                            )}
                            {isBye && (
                              <span className="pill bg-white/[0.04] text-white/40 border border-white/[0.06] !text-[10px] !py-0.5">BYE</span>
                            )}
                            {court && (
                              <span className="pill bg-blue-500/10 text-blue-400 border border-blue-500/20 !text-[10px] !py-0.5">Platz {court}</span>
                            )}
                            {isPlayable && !isBye && (
                              <span className="text-[10px] text-violet-500/80 ml-auto font-medium">Tippen zum Eintragen →</span>
                            )}
                          </>
                        }
                        footer={match.sets.length > 0 ? (
                          <div className="flex gap-2">
                            {match.sets.map((set, i) => (
                              <span key={i} className="text-xs text-white/25 font-mono">{formatSetScore(set)}</span>
                            ))}
                          </div>
                        ) : undefined}
                        className={!isPlayable && !isBye && match.status !== 'completed' ? 'opacity-40' : ''}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scoring Modal */}
      {scoringMatch && (
        <ScoringModal
          match={scoringMatch}
          getTeamName={getTeamName}
          onScoreGame={handleScoreGame}
          onStartTiebreak={handleStartTiebreak}
          onTiebreakPoint={handleTiebreakPoint}
          onUndo={handleUndoLastAction}
          onClose={() => setScoringMatchId(null)}
        />
      )}
    </div>
  );
}

// -- Scoring Modal Component --

interface ScoringModalProps {
  match: TournamentMatch;
  getTeamName: (teamId: string | null) => string;
  onScoreGame: (matchId: string, team: 1 | 2) => void;
  onStartTiebreak: (matchId: string) => void;
  onTiebreakPoint: (matchId: string, team: 1 | 2) => void;
  onUndo: (matchId: string) => void;
  onClose: () => void;
}

function ScoringModal({
  match,
  getTeamName,
  onScoreGame,
  onStartTiebreak,
  onTiebreakPoint,
  onUndo,
  onClose,
}: ScoringModalProps) {
  const currentSet: SetScore | undefined = match.sets[match.sets.length - 1];
  const isTiebreak = currentSet ? needsTiebreak(currentSet) : false;
  const hasTiebreak = currentSet?.tiebreak != null;
  const setComplete = currentSet ? isSetComplete(currentSet) : false;
  const matchWinner = getMatchWinner(match.sets, match.setsToWin);
  const setsScore = getSetsScore(match.sets);

  const scoreAction = isTiebreak && hasTiebreak ? onTiebreakPoint : onScoreGame;

  // Auto-close when match completes
  useEffect(() => {
    if (match.status === 'completed') {
      const timer = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(timer);
    }
  }, [match.status, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[#081226]/75 backdrop-blur-xl flex items-end sm:items-center justify-center animate-fade-in">
      <div className="glass w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="gradient-text text-lg font-bold">Ergebnis eintragen</h3>
          <button
            onClick={onClose}
            className="glass-card-static w-9 h-9 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Match completed overlay */}
        {matchWinner && (
          <div className="glass-card-static rounded-2xl p-5 mb-5 text-center relative overflow-hidden animate-fade-in-scale">
            <div className="absolute inset-0 bg-[#fa520f]/8" />
            <p className="relative gradient-text-accent font-bold text-base">
              🎉 {getTeamName(matchWinner === 1 ? match.team1Id : match.team2Id)} gewinnt!
            </p>
          </div>
        )}

        {/* Sets overview */}
        <div className="glass-card-static rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/40 font-medium">Sätze</span>
            <span className="font-mono text-2xl font-bold text-white/90 tracking-wider">
              {setsScore[0]} — {setsScore[1]}
            </span>
          </div>
          {match.sets.length > 0 && (
            <div className="flex gap-3 text-xs text-white/25">
              {match.sets.map((set, i) => (
                <span key={i} className="font-mono bg-white/[0.03] px-2 py-1 rounded-lg">
                  {formatSetScore(set)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Current set / tiebreak indicator */}
        {currentSet && !matchWinner && (
          <div className="text-center mb-5">
            {isTiebreak && !hasTiebreak ? (
              <div className="glass-card-static rounded-2xl py-3 px-4 inline-flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-sm text-amber-400 font-semibold">
                  6-6 — Tiebreak!
                </p>
              </div>
            ) : isTiebreak && hasTiebreak ? (
              <div className="glass-card-static rounded-2xl py-3 px-5 inline-flex items-center gap-3 border-amber-500/20 !border-amber-500/30">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-sm text-amber-400 font-semibold font-mono tracking-wider">
                  TB: {currentSet.tiebreak!.team1Points} — {currentSet.tiebreak!.team2Points}
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/40 font-mono">
                Satz {match.sets.length}: <span className="text-white/60">{currentSet.team1Games} — {currentSet.team2Games}</span>
              </p>
            )}
          </div>
        )}

        {/* Start tiebreak button */}
        {isTiebreak && !hasTiebreak && !matchWinner && (
          <button
            onClick={() => onStartTiebreak(match.id)}
            className="w-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 py-3.5 rounded-2xl mb-5 font-semibold text-sm transition-all duration-300"
          >
            Tiebreak starten
          </button>
        )}

        {/* Scoring buttons */}
        {!matchWinner && !(isTiebreak && !hasTiebreak) && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Team 1 */}
            <button
              onClick={() => scoreAction(match.id, 1)}
              className="bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-white rounded-2xl p-4 transition-all duration-300 active:scale-95"
            >
              <p className="text-xs text-violet-400/70 mb-1.5 font-medium">
                {isTiebreak && hasTiebreak ? 'Punkt' : 'Spiel'}
              </p>
              <p className="text-sm font-semibold text-white/90 truncate">
                {getTeamName(match.team1Id)}
              </p>
            </button>

            {/* Team 2 */}
            <button
              onClick={() => scoreAction(match.id, 2)}
              className="bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-white rounded-2xl p-4 transition-all duration-300 active:scale-95"
            >
              <p className="text-xs text-blue-400/70 mb-1.5 font-medium">
                {isTiebreak && hasTiebreak ? 'Punkt' : 'Spiel'}
              </p>
              <p className="text-sm font-semibold text-white/90 truncate">
                {getTeamName(match.team2Id)}
              </p>
            </button>
          </div>
        )}

        {/* Undo */}
        {!matchWinner && match.sets.length > 0 && (
          <button
            onClick={() => onUndo(match.id)}
            className="btn-secondary w-full py-2.5 text-sm"
          >
            ↩ Rückgängig
          </button>
        )}
      </div>
    </div>
  );
}
