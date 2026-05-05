'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameStore } from '@/store/gameStore';
import {
  isSetComplete,
  getSetWinner,
  needsTiebreak,
  canAddGame,
  getMatchWinner,
  getSetsScore,
  formatSetScore,
} from '@/lib/scoring';
import { markCompleted, markStarted } from '@/lib/matchTiming';
import { PadelBuilder } from '@/components/padel-builder/PadelBuilder';
import { createPadelPlayer } from '@/components/padel-builder/playerFactory';
import type { Match1vs1, SetScore } from '@/types';

export default function Match1vs1Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getGame, getPlayer, updateGame } = useGameStore();

  const [hydrated, setHydrated] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  const match = getGame(params.id) as Match1vs1 | undefined;

  const playerName = useCallback(
    (id: string) => getPlayer(id)?.name ?? 'Unbekannt',
    [getPlayer]
  );

  useEffect(() => {
    if (match?.status === 'completed' && match.winner) {
      setShowCompletionModal(true);
    }
  }, [match?.status, match?.winner]);

  useEffect(() => {
    if (!showCompletionModal) return;
    const timeout = window.setTimeout(() => setShowCompletionModal(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [showCompletionModal]);

  const currentSet: SetScore | null =
    match && match.sets.length > 0 ? match.sets[match.sets.length - 1] : null;

  const handleAddGame = useCallback(
    (team: 1 | 2) => {
      if (!match || match.status === 'completed') return;
      updateGame(match.id, (game) => {
        let m = markStarted({ ...game } as Match1vs1);
        const sets = m.sets.map((s) => ({ ...s, tiebreak: s.tiebreak ? { ...s.tiebreak } : undefined }));
        const lastSet = { ...sets[sets.length - 1] };
        if (lastSet.tiebreak) lastSet.tiebreak = { ...lastSet.tiebreak };

        if (isSetComplete(lastSet)) return m;
        if (!canAddGame(lastSet, team)) return m;

        if (team === 1) lastSet.team1Games++;
        else lastSet.team2Games++;

        sets[sets.length - 1] = lastSet;
        m.sets = sets;

        if (isSetComplete(lastSet)) {
          const matchWinner = getMatchWinner(sets, m.setsToWin);
          if (matchWinner) {
            m.winner = matchWinner;
            m.status = 'completed';
            m = markCompleted(m);
          } else {
            m.sets = [...sets, { team1Games: 0, team2Games: 0 }];
          }
        }
        return m;
      });
    },
    [match, updateGame]
  );

  const handleAddTiebreakPoint = useCallback(
    (team: 1 | 2) => {
      if (!match || match.status === 'completed') return;
      updateGame(match.id, (game) => {
        let m = markStarted({ ...game } as Match1vs1);
        const sets = m.sets.map((s) => ({ ...s, tiebreak: s.tiebreak ? { ...s.tiebreak } : undefined }));
        const lastSet = { ...sets[sets.length - 1] };

        if (!needsTiebreak(lastSet)) return m;
        if (isSetComplete(lastSet)) return m;

        if (!lastSet.tiebreak) {
          lastSet.tiebreak = { team1Points: 0, team2Points: 0 };
        } else {
          lastSet.tiebreak = { ...lastSet.tiebreak };
        }

        if (team === 1) lastSet.tiebreak.team1Points++;
        else lastSet.tiebreak.team2Points++;

        const { team1Points, team2Points } = lastSet.tiebreak;
        const tiebreakWon =
          (team1Points >= 7 && team1Points - team2Points >= 2) ||
          (team2Points >= 7 && team2Points - team1Points >= 2);

        if (tiebreakWon) {
          if (team1Points > team2Points) {
            lastSet.team1Games = 7; lastSet.team2Games = 6;
          } else {
            lastSet.team1Games = 6; lastSet.team2Games = 7;
          }
        }

        sets[sets.length - 1] = lastSet;
        m.sets = sets;

        if (isSetComplete(lastSet)) {
          const matchWinner = getMatchWinner(sets, m.setsToWin);
          if (matchWinner) {
            m.winner = matchWinner;
            m.status = 'completed';
            m = markCompleted(m);
          } else {
            m.sets = [...sets, { team1Games: 0, team2Games: 0 }];
          }
        }
        return m;
      });
    },
    [match, updateGame]
  );

  const handleFinishEarly = useCallback(() => {
    if (!match || match.status === 'completed') return;
    updateGame(match.id, (game) => {
      let m = markStarted({ ...game } as Match1vs1);
      const [s1, s2] = getSetsScore(m.sets);
      // Determine winner: whoever has more sets, or if tied, whoever leads in current set games
      let winner: 1 | 2;
      if (s1 > s2) {
        winner = 1;
      } else if (s2 > s1) {
        winner = 2;
      } else {
        const currentSet = m.sets[m.sets.length - 1];
        winner = currentSet && currentSet.team1Games >= currentSet.team2Games ? 1 : 2;
      }
      m.winner = winner;
      m.status = 'completed';
      m = markCompleted(m);
      return m;
    });
  }, [match, updateGame]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--league-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen app-text-primary flex flex-col items-center justify-center gap-4 px-4">
        <p className="app-text-muted text-lg">Match nicht gefunden</p>
        <Link href="/" className="btn-primary px-6 py-3 text-sm">Zur Startseite</Link>
      </div>
    );
  }

  const [team1SetsWon, team2SetsWon] = getSetsScore(match.sets);
  const completedSets = match.sets.filter((s) => isSetComplete(s));
  const activeSet = match.sets[match.sets.length - 1];
  const isMatchComplete = match.status === 'completed';
  const showTiebreak = activeSet && needsTiebreak(activeSet) && !isSetComplete(activeSet);

  const winnerName = match.winner === 1 ? playerName(match.player1) : playerName(match.player2);
  const player1 = getPlayer(match.player1);
  const player2 = getPlayer(match.player2);
  const team1Player = createPadelPlayer(match.player1, player1?.name ?? 'Unbekannt', 'left', `${match.player1}-left`, player1?.currentElo);
  const team2Player = createPadelPlayer(match.player2, player2?.name ?? 'Unbekannt', 'right2', `${match.player2}-right2`, player2?.currentElo);

  return (
    <div className="min-h-screen app-text-primary px-4 py-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up stagger-1">
        <button
          onClick={() => router.back()}
          className="glass-card-static w-10 h-10 rounded-full flex items-center justify-center hover-border-theme transition-all active:scale-95"
        >
          <svg className="w-5 h-5 app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {isMatchComplete && (
          <span className="bg-accent-soft app-text-accent px-4 py-1.5 rounded-full text-xs font-semibold border border-theme">
            Abgeschlossen
          </span>
        )}
      </div>

      {/* FUT-style padel lineup editor */}
      <div className="mb-5 animate-fade-in-up stagger-2">
        <PadelBuilder
          title="Match Lineup"
          initialFormation="1-1"
          players={[team1Player, team2Player]}
          initialPlacements={{ left: team1Player, right2: team2Player }}
          scoreLabel={`${team1SetsWon} - ${team2SetsWon}`}
        />
      </div>

      {/* Current set */}
      {!isMatchComplete && activeSet && (
        <div className="glass-card-static rounded-2xl p-6 mb-4 animate-fade-in-up stagger-4">
          <p className="text-xs app-text-faint text-center uppercase tracking-widest mb-3">
            Satz {match.sets.length} – Spiele
          </p>
          <div className="flex items-center justify-center gap-10">
            <span className="text-5xl font-black tabular-nums app-text-primary">{activeSet.team1Games}</span>
            <span className="text-xl app-text-faint font-bold">–</span>
            <span className="text-5xl font-black tabular-nums app-text-primary">{activeSet.team2Games}</span>
          </div>

          {showTiebreak && activeSet.tiebreak && (
            <div className="mt-4 pt-4 border-t border-theme-weak">
              <div className="glass-card-static rounded-xl p-4 !border-amber-500/15 bg-amber-500/5">
                <p className="text-xs app-text-accent text-center font-semibold uppercase tracking-widest mb-2">Tiebreak</p>
                <div className="flex items-center justify-center gap-6">
                  <span className="text-3xl font-bold tabular-nums app-text-accent">{activeSet.tiebreak.team1Points}</span>
                  <span className="text-lg app-text-faint font-bold">–</span>
                  <span className="text-3xl font-bold tabular-nums app-text-accent">{activeSet.tiebreak.team2Points}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous sets */}
      {completedSets.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap animate-fade-in-up stagger-5">
          {completedSets.map((set, i) => {
            const winner = getSetWinner(set);
            return (
              <div key={i} className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${
                winner === 1
                  ? 'bg-accent-soft app-text-accent border border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              }`}>
                <span className="app-text-faint mr-1">S{i + 1}</span>
                {formatSetScore(set)}
              </div>
            );
          })}
        </div>
      )}

      {/* Scoring buttons */}
      {!isMatchComplete && (
        <div className="space-y-3 mt-6 animate-fade-in-up stagger-6">
          {showTiebreak ? (
            <>
              <p className="text-xs app-text-accent text-center font-semibold uppercase tracking-widest">
                Tiebreak – Tippe um Punkt hinzuzufügen
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleAddTiebreakPoint(1)} className="py-8 rounded-2xl btn-primary flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold block mb-1">+1 Punkt</span>
                  <span className="text-xs opacity-70 font-medium">{playerName(match.player1)}</span>
                </button>
                <button onClick={() => handleAddTiebreakPoint(2)} className="py-8 rounded-2xl btn-primary flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold block mb-1">+1 Punkt</span>
                  <span className="text-xs opacity-70 font-medium">{playerName(match.player2)}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {activeSet && needsTiebreak(activeSet) && !activeSet.tiebreak ? (
                <button
                  onClick={() => {
                    updateGame(match.id, (game) => {
                      const m = markStarted({ ...game } as Match1vs1);
                      const sets = m.sets.map((s) => ({ ...s, tiebreak: s.tiebreak ? { ...s.tiebreak } : undefined }));
                      const lastSet = { ...sets[sets.length - 1] };
                      lastSet.tiebreak = { team1Points: 0, team2Points: 0 };
                      sets[sets.length - 1] = lastSet;
                      m.sets = sets;
                      return m;
                    });
                  }}
                  className="w-full py-5 rounded-2xl font-bold text-base text-white transition-all active:scale-[0.98] shadow-lg shadow-amber-600/20"
                  style={{
                    background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
                    boxShadow: '0 4px 24px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  🎯 Tiebreak starten (6-6)
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAddGame(1)}
                    disabled={!!currentSet && !canAddGame(currentSet, 1)}
                    className="py-8 rounded-2xl btn-primary flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl font-bold block mb-1">+1 Spiel</span>
                    <span className="text-xs opacity-70 font-medium">{playerName(match.player1)}</span>
                  </button>
                  <button
                    onClick={() => handleAddGame(2)}
                    disabled={!!currentSet && !canAddGame(currentSet, 2)}
                    className="py-8 rounded-2xl btn-primary flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl font-bold block mb-1">+1 Spiel</span>
                    <span className="text-xs opacity-70 font-medium">{playerName(match.player2)}</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Finish match early button */}
          <button
            onClick={handleFinishEarly}
            className="w-full py-3 mt-4 text-sm font-semibold rounded-2xl border border-theme app-text-muted bg-theme-softer hover-surface hover-text-secondary transition-all"
          >
            ⏱ Match vorzeitig beenden
          </button>
        </div>
      )}

      {/* Completed result */}
      {isMatchComplete && !showCompletionModal && (
        <div className="glass-card-static rounded-3xl p-8 mt-6 text-center animate-fade-in-scale">
          <div className="text-5xl mb-3">🏆</div>
          <p className="gradient-text-accent font-bold text-xl mb-2">{winnerName} gewinnt!</p>
          <Link href="/" className="inline-block mt-5 btn-primary px-8 py-3 text-sm">Zurück zur Startseite</Link>
        </div>
      )}

      {/* Completion toast */}
      {showCompletionModal && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-lg justify-center px-4 pointer-events-none">
          <div className="glass border-[#fa520f]/30 bg-[#1f1f1f]/90 px-4 py-3 text-white shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-sm font-black uppercase tracking-wide">{winnerName} gewinnt!</p>
                <p className="text-xs app-text-secondary">
                  {match.sets.filter((s) => isSetComplete(s)).map(formatSetScore).join(' · ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
