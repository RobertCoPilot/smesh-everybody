'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { getAmericanoLeaderboard } from '@/lib/americano';
import type { AmericanoTournament, AmericanoGame } from '@/types';
import CourtCard from '@/components/CourtCard';
import ScoreInput from '@/components/ScoreInput';

type Tab = 'games' | 'standings';

export default function AmericanoKleinTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const { getGame, updateGame, getPlayer } = useGameStore();

  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('games');

  useEffect(() => {
    setHydrated(true);
  }, []);

  const tournamentId = params.id as string;
  const tournament = getGame(tournamentId) as AmericanoTournament | undefined;

  const playerName = useCallback(
    (id: string) => getPlayer(id)?.name ?? 'Unbekannt',
    [getPlayer]
  );

  // Group games by round
  const rounds = useMemo(() => {
    if (!tournament) return [];
    const map = new Map<number, AmericanoGame[]>();
    for (const game of tournament.games) {
      const list = map.get(game.round) ?? [];
      list.push(game);
      map.set(game.round, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [tournament]);

  // Current active round: first round with non-completed games
  const currentRound = useMemo(() => {
    if (!tournament) return 0;
    for (const [roundNum, games] of rounds) {
      if (games.some((g) => g.status !== 'completed')) return roundNum;
    }
    return rounds.length > 0 ? rounds[rounds.length - 1][0] : 0;
  }, [tournament, rounds]);

  // Check if all games in a round are completed
  const isRoundComplete = useCallback(
    (roundNum: number) => {
      const roundGames = rounds.find(([r]) => r === roundNum)?.[1];
      return roundGames?.every((g) => g.status === 'completed') ?? false;
    },
    [rounds]
  );

  // Leaderboard
  const leaderboard = useMemo(() => {
    if (!tournament) return [];
    return getAmericanoLeaderboard(tournament.games, tournament.players);
  }, [tournament]);

  // Check if players have unequal game counts (use avg points then)
  const usingAvg = useMemo(() => {
    if (leaderboard.length === 0) return false;
    const counts = leaderboard.map((e) => e.gamesPlayed);
    return !counts.every((c) => c === counts[0]);
  }, [leaderboard]);

  const isTournamentComplete = useMemo(() => {
    return tournament?.games.every((g) => g.status === 'completed') ?? false;
  }, [tournament]);

  // Update a game's score
  const handleScoreChange = useCallback(
    (gameId: string, team: 'team1Score' | 'team2Score', delta: number) => {
      if (!tournament) return;
      updateGame(tournamentId, (record) => {
        const t = { ...record } as AmericanoTournament;
        const games = t.games.map((g) => {
          if (g.id !== gameId || g.status === 'completed') return g;

          const updated = { ...g };
          const newScore = Math.max(0, Math.min(t.pointsToWin, updated[team] + delta));
          updated[team] = newScore;

          // Mark in_progress on first score entry
          if (updated.status === 'pending' && (updated.team1Score > 0 || updated.team2Score > 0)) {
            updated.status = 'in_progress';
          }

          return updated;
        });
        return { ...t, games };
      });
    },
    [tournament, tournamentId, updateGame]
  );

  // Complete a game
  const handleCompleteGame = useCallback(
    (gameId: string) => {
      if (!tournament) return;
      updateGame(tournamentId, (record) => {
        const t = { ...record } as AmericanoTournament;
        const games = t.games.map((g) =>
          g.id === gameId ? { ...g, status: 'completed' as const } : g
        );
        return { ...t, games };
      });
    },
    [tournament, tournamentId, updateGame]
  );

  // Advance to next round
  const handleNextRound = useCallback(() => {
    if (!tournament) return;
    const nextRound = currentRound + 1;
    updateGame(tournamentId, (record) => {
      const t = { ...record } as AmericanoTournament;
      return { ...t, currentRound: nextRound };
    });
  }, [tournament, tournamentId, currentRound, updateGame]);

  // Complete the tournament
  const handleCompleteTournament = useCallback(() => {
    if (!tournament) return;
    updateGame(tournamentId, (record) => {
      const t = { ...record } as AmericanoTournament;
      return { ...t, status: 'completed' as const };
    });
  }, [tournament, tournamentId, updateGame]);

  // Finish tournament early: complete all open games at current scores
  const handleFinishTournamentEarly = useCallback(() => {
    if (!tournament) return;
    updateGame(tournamentId, (record) => {
      const t = { ...record } as AmericanoTournament;
      const games = t.games.map((g) =>
        g.status !== 'completed' ? { ...g, status: 'completed' as const } : g
      );
      return { ...t, games, status: 'completed' as const };
    });
  }, [tournament, tournamentId, updateGame]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen app-text-primary flex flex-col items-center justify-center gap-4">
        <p className="app-text-muted">Turnier nicht gefunden.</p>
        <button
          onClick={() => router.push('/game/americano-klein/setup')}
          className="btn-primary px-6 py-2.5"
        >
          Neues Turnier erstellen
        </button>
      </div>
    );
  }

  const hasNextRound = rounds.some(([r]) => r > currentRound);

  return (
    <div className="min-h-screen app-text-primary pb-24 animate-fade-in">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 animate-fade-in-up stagger-1">
          <button
            onClick={() => router.back()}
            className="glass-card-static p-2.5 rounded-2xl hover-surface transition-all"
          >
            <svg className="w-5 h-5 app-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold gradient-text">Americano Klein</h1>
            <p className="text-sm app-text-muted">
              {tournament.players.length} Spieler · {tournament.pointsToWin} Pkt.
              {tournament.status === 'completed' && (
                <span className="ml-2 app-text-accent font-medium">Abgeschlossen</span>
              )}
            </p>
          </div>
        </div>

        {/* Winner banner */}
        {tournament.status === 'completed' && leaderboard.length > 0 && (
          <div className="glass-card-static rounded-2xl p-5 mb-4 text-center animate-fade-in-scale" style={{ borderColor: 'rgba(168,85,247,0.2)' }}>
            <div className="text-3xl mb-2">🏆</div>
            <div className="font-bold text-xl gradient-text">
              {playerName(leaderboard[0].playerId)}
            </div>
            <div className="text-xs app-text-muted mt-1">
              {usingAvg ? `⌀ ${leaderboard[0].avgPoints.toFixed(1)} Pkt./Spiel` : `${leaderboard[0].points} Punkte`} • {leaderboard[0].wins} Siege
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="glass-card-static flex gap-1 mb-6 rounded-2xl p-1 animate-fade-in-up stagger-2">
          {(['games', 'standings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-amber-500/15 app-text-accent shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                  : 'app-text-muted hover-text-secondary'
              }`}
            >
              {tab === 'games' ? 'Spiele' : 'Tabelle'}
            </button>
          ))}
        </div>

        {/* Games Tab */}
        {activeTab === 'games' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Tournament Complete Banner */}
            {isTournamentComplete && tournament.status !== 'completed' && (
              <div className="glass-card-static rounded-2xl p-5 text-center space-y-3 border-amber-500/20">
                <p className="app-text-accent font-semibold text-lg">🏆 Alle Spiele abgeschlossen!</p>
                <button
                  onClick={handleCompleteTournament}
                  className="btn-primary px-8 py-3 font-bold"
                >
                  Turnier abschließen
                </button>
              </div>
            )}

            {rounds.map(([roundNum, games]) => {
              const isCurrent = roundNum === currentRound;
              const roundComplete = isRoundComplete(roundNum);

              return (
                <div key={roundNum} className="space-y-3">
                  {/* Round header */}
                  <div className="flex items-center gap-2">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${
                      isCurrent ? 'app-text-accent' : 'app-text-faint'
                    }`}>
                      Runde {roundNum + 1}
                    </h3>
                    {roundComplete && (
                      <span className="pill bg-theme-soft app-text-muted text-[10px]">
                        ✓ Fertig
                      </span>
                    )}
                    {isCurrent && !roundComplete && (
                      <span className="pill bg-amber-500/15 app-text-accent text-[10px]">
                        Aktiv
                      </span>
                    )}
                  </div>

                  {/* Game cards */}
                  {games.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      pointsToWin={tournament.pointsToWin}
                      playerName={playerName}
                      onScoreChange={handleScoreChange}
                      onComplete={handleCompleteGame}
                    />
                  ))}

                  {/* Next Round button */}
                  {isCurrent && roundComplete && hasNextRound && (
                    <button
                      onClick={handleNextRound}
                      className="btn-primary w-full py-3 font-semibold"
                    >
                      Nächste Runde →
                    </button>
                  )}
                </div>
              );
            })}

            {/* Finish tournament early button */}
            {!isTournamentComplete && tournament.status !== 'completed' && (
              <div className="pt-4 border-t border-theme-weak">
                <button
                  onClick={handleFinishTournamentEarly}
                  className="w-full py-3 text-sm font-semibold rounded-2xl border border-theme app-text-accent bg-amber-500/10 hover:bg-amber-500/20 transition-all"
                >
                  ⏱ Turnier vorzeitig beenden
                </button>
                <p className="text-[11px] app-text-subtle text-center mt-2">
                  Beendet alle offenen Spiele beim aktuellen Stand
                </p>
              </div>
            )}
          </div>
        )}

        {/* Standings Tab */}
        {activeTab === 'standings' && (
          <div className="space-y-4 animate-fade-in-up">
            {isTournamentComplete && (
              <div className="text-center py-3">
                <h2 className="text-2xl font-bold gradient-text">🏆 Endstand</h2>
              </div>
            )}

            <div className="glass-card-static rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className={`grid ${usingAvg ? 'grid-cols-[2rem_1fr_2.5rem_2.5rem_2rem_2rem]' : 'grid-cols-[2.5rem_1fr_3.5rem_2.5rem_2rem]'} gap-2 px-4 py-3 border-b border-theme-weak text-[11px] font-semibold uppercase tracking-wider app-text-faint`}>
                <span>#</span>
                <span>Spieler</span>
                {usingAvg && <span className="text-right">⌀</span>}
                <span className="text-right">Pkt.</span>
                <span className="text-right">S</span>
                <span className="text-right">Sp.</span>
              </div>

              {/* Rows */}
              {leaderboard.map((entry, i) => {
                const rank = i + 1;
                const medal =
                  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                const highlight =
                  rank === 1
                    ? 'bg-amber-500/[0.08] border-l-2 border-amber-500'
                    : rank === 2
                    ? 'bg-theme-softer border-l-2 border-theme'
                    : rank === 3
                    ? 'bg-orange-500/[0.05] border-l-2 border-orange-600'
                    : 'border-l-2 border-transparent';

                return (
                  <div
                    key={entry.playerId}
                    className={`grid ${usingAvg ? 'grid-cols-[2rem_1fr_2.5rem_2.5rem_2rem_2rem]' : 'grid-cols-[2.5rem_1fr_3.5rem_2.5rem_2rem]'} gap-2 px-4 py-3 items-center border-t border-theme-weak ${highlight}`}
                  >
                    <span className="text-sm">
                      {medal ?? <span className="app-text-faint">{rank}</span>}
                    </span>
                    <span className="text-sm font-medium truncate app-text-primary">
                      {playerName(entry.playerId)}
                    </span>
                    {usingAvg && (
                      <span className="text-sm font-bold app-text-accent text-right">
                        {entry.avgPoints.toFixed(1)}
                      </span>
                    )}
                    <span className={`text-sm ${usingAvg ? 'app-text-muted' : 'font-bold app-text-accent'} text-right`}>
                      {entry.points}
                    </span>
                    <span className="text-sm app-text-muted text-right">{entry.wins}</span>
                    <span className="text-sm app-text-faint text-right">
                      {entry.gamesPlayed}
                    </span>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <div className="px-4 py-8 text-center app-text-faint text-sm">
                  Noch keine Spiele abgeschlossen.
                </div>
              )}
            </div>

            {usingAvg && (
              <p className="text-[11px] app-text-subtle text-center mt-3 px-4">
                ⌀ = Durchschnittspunkte pro Spiel (Rangfolge basiert auf ⌀, da Spielanzahl ungleich)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Game Card Component ─── */

function GameCard({
  game,
  pointsToWin,
  playerName,
  onScoreChange,
  onComplete,
}: {
  game: AmericanoGame;
  pointsToWin: number;
  playerName: (id: string) => string;
  onScoreChange: (gameId: string, team: 'team1Score' | 'team2Score', delta: number) => void;
  onComplete: (gameId: string) => void;
}) {
  const isCompleted = game.status === 'completed';
  const team1Wins = isCompleted && game.team1Score > game.team2Score;
  const team2Wins = isCompleted && game.team2Score > game.team1Score;
  const canComplete =
    !isCompleted &&
    (game.team1Score === pointsToWin || game.team2Score === pointsToWin);
  const canFinishEarly =
    !isCompleted &&
    !canComplete &&
    (game.team1Score > 0 || game.team2Score > 0);

  return (
    <CourtCard
      team1Players={[`${team1Wins ? '👑 ' : ''}${playerName(game.team1[0])}`, `${team1Wins ? '👑 ' : ''}${playerName(game.team1[1])}`]}
      team2Players={[`${team2Wins ? '👑 ' : ''}${playerName(game.team2[0])}`, `${team2Wins ? '👑 ' : ''}${playerName(game.team2[1])}`]}
      courtNumber={game.court + 1}
      accentColor="amber"
      completed={isCompleted}
      team1Score={
        isCompleted ? (
          <span className={`text-2xl font-bold tabular-nums ${team1Wins ? 'app-text-accent' : 'app-text-subtle'}`}>
            {game.team1Score}
          </span>
        ) : (
          <ScoreInput
            score={game.team1Score}
            maxScore={pointsToWin}
            onScoreChange={(val) => onScoreChange(game.id, 'team1Score', val - game.team1Score)}
          />
        )
      }
      team2Score={
        isCompleted ? (
          <span className={`text-2xl font-bold tabular-nums ${team2Wins ? 'app-text-accent' : 'app-text-subtle'}`}>
            {game.team2Score}
          </span>
        ) : (
          <ScoreInput
            score={game.team2Score}
            maxScore={pointsToWin}
            onScoreChange={(val) => onScoreChange(game.id, 'team2Score', val - game.team2Score)}
          />
        )
      }
      statusBadge={isCompleted ? (
        <span className="text-[10px] font-medium app-text-faint">Abgeschlossen</span>
      ) : undefined}
      footer={
        canComplete ? (
          <button
            onClick={() => onComplete(game.id)}
            className="btn-primary w-full py-2.5 text-sm font-semibold"
          >
            Spiel beenden
          </button>
        ) : canFinishEarly ? (
          <button
            onClick={() => onComplete(game.id)}
            className="w-full py-2.5 text-sm font-semibold rounded-xl border border-theme app-text-accent bg-amber-500/10 hover:bg-amber-500/20 transition-all"
          >
            Vorzeitig beenden
          </button>
        ) : undefined
      }
    />
  );
}
