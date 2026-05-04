'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '@/store/gameStore';
import PlayerSelector from '@/components/PlayerSelector';
import CourtCard from '@/components/CourtCard';
import { generateAmericanoGrossSchedule } from '@/lib/americano';
import type { AmericanoTournament } from '@/types';

const POINTS_OPTIONS = [16, 21, 24, 32] as const;

export default function AmericanoGrossSetupPage() {
  const router = useRouter();
  const { addGame, getPlayer } = useGameStore();

  const playerName = useCallback(
    (playerId: string) => getPlayer(playerId)?.name ?? 'Unbekannt',
    [getPlayer]
  );

  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [pointsToWin, setPointsToWin] = useState(10);
  const [courts, setCourts] = useState(1);

  const maxCourts = Math.max(1, Math.floor(selectedPlayers.length / 4));

  const previewGames = useMemo(() => {
    if (step !== 3 || selectedPlayers.length < 4) return [];
    return generateAmericanoGrossSchedule(selectedPlayers, courts);
  }, [step, selectedPlayers, courts]);

  const totalRounds = useMemo(() => {
    if (previewGames.length === 0) return 0;
    return Math.max(...previewGames.map((g) => g.round)) + 1;
  }, [previewGames]);

  const handleStart = () => {
    const id = uuidv4();
    const games = generateAmericanoGrossSchedule(selectedPlayers, courts);

    const tournament: AmericanoTournament = {
      id,
      type: 'americano-gross',
      date: new Date().toISOString(),
      players: selectedPlayers,
      games,
      pointsToWin,
      courts,
      currentRound: 0,
      status: 'in_progress',
    };

    addGame(tournament);
    router.push(`/game/americano-gross/${id}`);
  };

  return (
    <div className="min-h-screen app-text-primary animate-fade-in">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up stagger-1">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
            className="glass-card-static px-3 py-1.5 rounded-2xl text-sm app-text-secondary hover-surface mb-3 flex items-center gap-1.5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Zurück
          </button>
          <h1 className="text-2xl font-bold gradient-text">Americano Groß Einrichtung</h1>
          <p className="app-text-muted text-sm mt-1">
            Alle möglichen Kombinationen – mit und gegen jeden spielen
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 animate-fade-in-up stagger-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`glass-card-static w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  s === step
                    ? 'bg-rose-500/20 !border-rose-500/40 app-text-accent shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                    : s < step
                    ? 'bg-rose-500/10 !border-rose-500/20 app-text-accent/70'
                    : 'app-text-faint'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                    s < step ? 'bg-accent-soft' : 'bg-theme-soft'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Players */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-card-static rounded-2xl p-5">
              <PlayerSelector
                selectedPlayers={selectedPlayers}
                onPlayersChange={setSelectedPlayers}
                minPlayers={4}
              />
            </div>

            <div className="glass-card-static rounded-2xl px-4 py-3 text-center text-sm app-text-secondary">
              {selectedPlayers.length} Spieler ausgewählt
              {selectedPlayers.length < 4 && (
                <span className="ml-2 app-text-accent/80">· Mindestens 4</span>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={selectedPlayers.length < 4}
              className="btn-primary w-full py-3.5 text-base"
            >
              Weiter
            </button>
          </div>
        )}

        {/* Step 2: Settings */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Points to win */}
            <div className="glass-card-static rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold app-text-secondary">Punkte zum Gewinnen</h3>
              <div className="grid grid-cols-4 gap-2">
                {POINTS_OPTIONS.map((pts) => (
                  <button
                    key={pts}
                    onClick={() => setPointsToWin(pts)}
                    className={`glass-card-static py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                      pointsToWin === pts
                        ? 'bg-rose-500/15 !border-rose-500/40 app-text-accent shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'app-text-secondary hover-surface hover-text-primary'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm app-text-faint">Eigene:</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={pointsToWin}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0 && v <= 99) setPointsToWin(v);
                  }}
                  className="input-glass w-20 px-3 py-2 text-center text-sm"
                />
              </div>
            </div>

            {/* Courts */}
            <div className="glass-card-static rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold app-text-secondary">
                Anzahl Plätze
              </h3>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: maxCourts }, (_, i) => i + 1).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCourts(c)}
                    className={`glass-card-static w-14 h-12 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                      courts === c
                        ? 'bg-rose-500/15 !border-rose-500/40 app-text-accent shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'app-text-secondary hover-surface hover-text-primary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (courts > maxCourts) setCourts(maxCourts);
                setStep(3);
              }}
              className="btn-primary w-full py-3.5 text-base"
            >
              Vorschau
            </button>
          </div>
        )}

        {/* Step 3: Preview & Start */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-card-static rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold app-text-secondary">
                Turnier Vorschau
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card-static rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold app-text-accent">
                    {selectedPlayers.length}
                  </div>
                  <div className="text-xs app-text-muted mt-1">Spieler</div>
                </div>
                <div className="glass-card-static rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold app-text-accent">
                    {courts}
                  </div>
                  <div className="text-xs app-text-muted mt-1">
                    {courts !== 1 ? 'Plätze' : 'Platz'}
                  </div>
                </div>
                <div className="glass-card-static rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold app-text-accent">
                    {totalRounds}
                  </div>
                  <div className="text-xs app-text-muted mt-1">Runden</div>
                </div>
                <div className="glass-card-static rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold app-text-accent">
                    {previewGames.length}
                  </div>
                  <div className="text-xs app-text-muted mt-1">Spiele</div>
                </div>
              </div>

              <div className="text-xs app-text-faint text-center">
                Zuerst {pointsToWin} Punkte pro Spiel
              </div>
            </div>

            {/* Round preview */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Array.from({ length: totalRounds }, (_, r) => (
                <div
                  key={r}
                  className="glass-card-static rounded-2xl p-4"
                >
                  <div className="text-xs font-bold uppercase tracking-wider app-text-accent mb-2">
                    Runde {r + 1}
                  </div>
                  <div className="space-y-2">
                    {previewGames
                      .filter((g) => g.round === r)
                      .map((g) => (
                        <CourtCard
                          key={g.id}
                          compact
                          team1Players={[playerName(g.team1[0]), playerName(g.team1[1])]}
                          team2Players={[playerName(g.team2[0]), playerName(g.team2[1])]}
                          courtNumber={g.court + 1}
                          accentColor="rose"
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleStart}
              className="btn-primary w-full py-4 font-bold text-lg"
            >
              🏆 Turnier starten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
