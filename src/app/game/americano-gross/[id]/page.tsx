'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { getAmericanoLeaderboard } from '@/lib/americano';
import { markCompleted } from '@/lib/matchTiming';
import CourtCard from '@/components/CourtCard';
import ScoreInput from '@/components/ScoreInput';
import type { AmericanoTournament, AmericanoGame } from '@/types';

type Tab = 'games' | 'standings';

export default function AmericanoGrossLivePage() {
  const params = useParams();
  const router = useRouter();
  const { getGame, updateGame, getPlayer } = useGameStore();

  const id = params.id as string;
  const tournament = getGame(id) as AmericanoTournament | undefined;

  const [activeTab, setActiveTab] = useState<Tab>('games');

  const totalRounds = useMemo(() => {
    if (!tournament || tournament.games.length === 0) return 0;
    return Math.max(...tournament.games.map((g) => g.round)) + 1;
  }, [tournament]);

  const allCompleted = useMemo(() => {
    if (!tournament) return false;
    return tournament.games.every((g) => g.status === 'completed');
  }, [tournament]);

  // Mark tournament completed when all games are done
  useEffect(() => {
    if (allCompleted && tournament && tournament.status !== 'completed') {
      updateGame(id, (g) => ({
        ...(g as AmericanoTournament),
        status: 'completed',
      }));
    }
  }, [allCompleted, tournament, id, updateGame]);

  // Auto-advance current round
  useEffect(() => {
    if (!tournament || tournament.status === 'completed') return;
    const currentRoundGames = tournament.games.filter(
      (g) => g.round === tournament.currentRound
    );
    const allCurrentDone = currentRoundGames.every(
      (g) => g.status === 'completed'
    );
    if (allCurrentDone && tournament.currentRound < totalRounds - 1) {
      updateGame(id, (g) => ({
        ...(g as AmericanoTournament),
        currentRound: (g as AmericanoTournament).currentRound + 1,
      }));
    }
  }, [tournament, id, totalRounds, updateGame]);

  const handleScoreChange = useCallback(
    (gameId: string, team: 'team1' | 'team2', delta: number) => {
      if (!tournament) return;
      updateGame(id, (g) => {
        const t = g as AmericanoTournament;
        const updatedGames = t.games.map((game) => {
          if (game.id !== gameId) return game;
          if (game.status === 'completed') return game;

          const key = team === 'team1' ? 'team1Score' : 'team2Score';
          const newScore = Math.max(
            0,
            Math.min(t.pointsToWin, game[key] + delta)
          );

          return {
            ...game,
            [key]: newScore,
            status:
              game.status === 'pending'
                ? ('in_progress' as const)
                : game.status,
            startedAt: game.startedAt ?? new Date().toISOString(),
          };
        });
        return { ...t, games: updatedGames };
      });
    },
    [tournament, id, updateGame]
  );

  const handleCompleteGame = useCallback(
    (gameId: string) => {
      if (!tournament) return;
      updateGame(id, (g) => {
        const t = g as AmericanoTournament;
        const updatedGames = t.games.map((game) => {
          if (game.id !== gameId) return game;
          return markCompleted({ ...game, status: 'completed' as const });
        });
        return { ...t, games: updatedGames };
      });
    },
    [tournament, id, updateGame]
  );

  // Finish tournament early: complete all open games at current scores
  const handleFinishTournamentEarly = useCallback(() => {
    if (!tournament) return;
    updateGame(id, (g) => {
      const t = g as AmericanoTournament;
      const updatedGames = t.games.map((game) =>
        game.status !== 'completed' ? markCompleted({ ...game, status: 'completed' as const }) : game
      );
      return { ...t, games: updatedGames, status: 'completed' as const };
    });
  }, [tournament, id, updateGame]);

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

  const playerName = useCallback(
    (playerId: string) => getPlayer(playerId)?.name ?? 'Unbekannt',
    [getPlayer]
  );

  if (!tournament) {
    return (
      <div className="min-h-screen app-text-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="app-text-muted">Turnier nicht gefunden</p>
          <button
            onClick={() => router.push('/')}
            className="btn-secondary px-5 py-2 text-sm app-text-accent"
          >
            ← Zur Startseite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-text-primary animate-fade-in">
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
            <h1 className="text-xl font-bold gradient-text">Americano Groß</h1>
            <p className="text-sm app-text-muted">
              {tournament.players.length} Spieler · Runde {tournament.currentRound + 1}/{totalRounds} · {tournament.pointsToWin} Pkt.
              {tournament.status === 'completed' && (
                <span className="ml-2 app-text-accent font-medium">Abgeschlossen</span>
              )}
            </p>
          </div>
        </div>

        {/* Final standings banner */}
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
        <div className="glass-card-static flex gap-1 rounded-2xl p-1 mb-5 animate-fade-in-up stagger-2">
          {(['games', 'standings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-rose-500/15 app-text-accent shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                  : 'app-text-muted hover-text-secondary'
              }`}
            >
              {tab === 'games' ? 'Spiele' : 'Tabelle'}
            </button>
          ))}
        </div>

        {/* Games Tab */}
        {activeTab === 'games' && (
          <div className="space-y-5 animate-fade-in-up">
            {Array.from({ length: totalRounds }, (_, r) => {
              const roundGames = tournament.games.filter(
                (g) => g.round === r
              );
              const isCurrentRound = r === tournament.currentRound;
              const roundComplete = roundGames.every(
                (g) => g.status === 'completed'
              );

              return (
                <div key={r}>
                  {/* Round header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isCurrentRound ? 'app-text-accent' : 'app-text-faint'
                      }`}
                    >
                      Runde {r + 1}
                    </h2>
                    {roundComplete && (
                      <span className="pill bg-theme-soft app-text-muted text-[10px]">✓ Fertig</span>
                    )}
                    {isCurrentRound && !roundComplete && (
                      <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                    )}
                  </div>

                  {/* Game cards */}
                  <div className="space-y-3">
                    {roundGames.map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        pointsToWin={tournament.pointsToWin}
                        playerName={playerName}
                        onScoreChange={handleScoreChange}
                        onComplete={handleCompleteGame}
                        isCurrentRound={isCurrentRound}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Finish tournament early button */}
            {!allCompleted && tournament.status !== 'completed' && (
              <div className="pt-4 border-t border-theme-weak">
                <button
                  onClick={handleFinishTournamentEarly}
                  className="w-full py-3 text-sm font-semibold rounded-2xl border border-rose-500/30 app-text-accent bg-rose-500/10 hover:bg-rose-500/20 transition-all"
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
          <div className="animate-fade-in-up">
            {allCompleted && (
              <div className="text-center py-3 mb-4">
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
                    <span className="text-sm app-text-muted text-right">
                      {entry.wins}
                    </span>
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

interface GameCardProps {
  game: AmericanoGame;
  pointsToWin: number;
  playerName: (id: string) => string;
  onScoreChange: (gameId: string, team: 'team1' | 'team2', delta: number) => void;
  onComplete: (gameId: string) => void;
  isCurrentRound: boolean;
}

function GameCard({
  game,
  pointsToWin,
  playerName,
  onScoreChange,
  onComplete,
  isCurrentRound,
}: GameCardProps) {
  const isCompleted = game.status === 'completed';
  const canComplete =
    !isCompleted &&
    (game.team1Score === pointsToWin || game.team2Score === pointsToWin);
  const canFinishEarly =
    !isCompleted &&
    !canComplete &&
    (game.team1Score > 0 || game.team2Score > 0);

  const team1Won = isCompleted && game.team1Score > game.team2Score;
  const team2Won = isCompleted && game.team2Score > game.team1Score;

  const renderScore = (team: 'team1' | 'team2') => {
    const score = team === 'team1' ? game.team1Score : game.team2Score;
    const won = team === 'team1' ? team1Won : team2Won;

    if (isCompleted) {
      return (
        <span className={`text-2xl font-bold tabular-nums ${won ? 'app-text-accent' : 'app-text-subtle'}`}>
          {score}
        </span>
      );
    }

    return (
      <ScoreInput
        score={score}
        maxScore={pointsToWin}
        onScoreChange={(val) => onScoreChange(game.id, team, val - score)}
      />
    );
  };

  return (
    <CourtCard
      team1Players={[
        `${team1Won ? '👑 ' : ''}${playerName(game.team1[0])}`,
        `${team1Won ? '👑 ' : ''}${playerName(game.team1[1])}`,
      ]}
      team2Players={[
        `${team2Won ? '👑 ' : ''}${playerName(game.team2[0])}`,
        `${team2Won ? '👑 ' : ''}${playerName(game.team2[1])}`,
      ]}
      courtNumber={game.court + 1}
      accentColor="rose"
      completed={isCompleted}
      highlighted={isCurrentRound && !isCompleted}
      team1Score={renderScore('team1')}
      team2Score={renderScore('team2')}
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
            className="w-full py-2.5 text-sm font-semibold rounded-xl border border-rose-500/30 app-text-accent bg-rose-500/10 hover:bg-rose-500/20 transition-all"
          >
            Vorzeitig beenden
          </button>
        ) : undefined
      }
    />
  );
}
