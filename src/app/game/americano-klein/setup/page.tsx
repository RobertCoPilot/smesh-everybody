'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import PlayerSelector from '@/components/PlayerSelector';
import CourtCard from '@/components/CourtCard';
import { useGameStore } from '@/store/gameStore';
import { generateAmericanoKleinSchedule } from '@/lib/americano';
import type { AmericanoTournament, AmericanoGame } from '@/types';

const POINTS_OPTIONS = [16, 21, 24, 32] as const;

export default function AmericanoKleinSetupPage() {
  const router = useRouter();
  const { getPlayer, addGame } = useGameStore();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [pointsToWin, setPointsToWin] = useState(10);
  const [courts, setCourts] = useState(1);
  const [previewGames, setPreviewGames] = useState<AmericanoGame[]>([]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const maxCourts = Math.max(1, Math.floor(selectedPlayers.length / 4));

  // Clamp courts when player count changes
  useEffect(() => {
    if (courts > maxCourts) setCourts(maxCourts);
  }, [maxCourts, courts]);

  // Generate preview when entering step 3
  useEffect(() => {
    if (step === 3 && selectedPlayers.length >= 4) {
      const games = generateAmericanoKleinSchedule(selectedPlayers, courts);
      setPreviewGames(games);
    }
  }, [step, selectedPlayers, courts]);

  const previewRounds = useMemo(() => {
    const rounds = new Map<number, AmericanoGame[]>();
    for (const game of previewGames) {
      const list = rounds.get(game.round) ?? [];
      list.push(game);
      rounds.set(game.round, list);
    }
    return Array.from(rounds.entries()).sort(([a], [b]) => a - b);
  }, [previewGames]);

  const playerName = (id: string) => getPlayer(id)?.name ?? 'Unbekannt';

  const handleStart = () => {
    const id = uuidv4();
    const tournament: AmericanoTournament = {
      id,
      type: 'americano-klein',
      date: new Date().toISOString(),
      players: selectedPlayers,
      games: previewGames,
      pointsToWin,
      courts,
      currentRound: 0,
      status: 'in_progress',
    };
    addGame(tournament);
    router.push(`/game/americano-klein/${id}`);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen app-text-primary pb-24 animate-fade-in">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-fade-in-up stagger-1">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
            className="glass-card-static p-2.5 rounded-2xl hover-surface transition-all"
          >
            <svg className="w-5 h-5 app-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold gradient-text">Americano Klein Einrichtung</h1>
            <p className="text-sm app-text-muted">Schritt {step} von 3</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8 animate-fade-in-up stagger-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-theme-soft'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Select Players */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-semibold app-text-primary mb-1">Spieler auswählen</h2>
              <p className="text-sm app-text-muted">
                Jeder Spieler spielt einmal mit jedem anderen.
              </p>
            </div>

            <PlayerSelector
              selectedPlayers={selectedPlayers}
              onPlayersChange={setSelectedPlayers}
              minPlayers={4}
            />

            <div className="glass-card-static rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm app-text-secondary">
                {selectedPlayers.length} Spieler ausgewählt
              </span>
              {selectedPlayers.length < 4 && (
                <span className="text-sm app-text-accent/80">Mindestens 4 Spieler</span>
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
          <div className="space-y-8 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-semibold app-text-primary mb-1">Einstellungen</h2>
              <p className="text-sm app-text-muted">Konfiguriere dein Turnier.</p>
            </div>

            {/* Points to win */}
            <div className="space-y-3">
              <label className="text-sm font-medium app-text-secondary">Punkte zum Gewinnen</label>
              <div className="grid grid-cols-4 gap-2">
                {POINTS_OPTIONS.map((pts) => (
                  <button
                    key={pts}
                    onClick={() => setPointsToWin(pts)}
                    className={`glass-card-static py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                      pointsToWin === pts
                        ? 'bg-amber-500/15 !border-amber-500/40 app-text-accent shadow-[0_0_12px_rgba(245,158,11,0.15)]'
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

            {/* Number of courts */}
            <div className="space-y-3">
              <label className="text-sm font-medium app-text-secondary">
                Anzahl Plätze
              </label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: maxCourts }, (_, i) => i + 1).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCourts(c)}
                    className={`glass-card-static w-14 h-12 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                      courts === c
                        ? 'bg-amber-500/15 !border-amber-500/40 app-text-accent shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'app-text-secondary hover-surface hover-text-primary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-xs app-text-faint">
                Max. {maxCourts} {maxCourts !== 1 ? 'Plätze' : 'Platz'} für {selectedPlayers.length} Spieler
              </p>
            </div>

            <button
              onClick={() => setStep(3)}
              className="btn-primary w-full py-3.5 text-base"
            >
              Spielplan anzeigen
            </button>
          </div>
        )}

        {/* Step 3: Preview & Start */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-semibold app-text-primary mb-1">Spielplan Vorschau</h2>
              <p className="text-sm app-text-muted">
                {previewRounds.length} {previewRounds.length !== 1 ? 'Runden' : 'Runde'} ·{' '}
                {previewGames.length} {previewGames.length !== 1 ? 'Spiele' : 'Spiel'} ·{' '}
                {pointsToWin} Pkt. zum Gewinnen
              </p>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {previewRounds.map(([roundNum, games]) => (
                <div key={roundNum} className="glass-card-static rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider app-text-accent">
                    Runde {roundNum + 1}
                  </h3>
                  {games.map((game) => (
                    <CourtCard
                      key={game.id}
                      compact
                      team1Players={[playerName(game.team1[0]), playerName(game.team1[1])]}
                      team2Players={[playerName(game.team2[0]), playerName(game.team2[1])]}
                      courtNumber={game.court + 1}
                      accentColor="amber"
                    />
                  ))}
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
