'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '@/store/gameStore';
import PlayerSelector from '@/components/PlayerSelector';
import { PadelBuilder } from '@/components/padel-builder/PadelBuilder';
import { createPadelPlayer } from '@/components/padel-builder/playerFactory';
import type { Match1vs1 } from '@/types';

export default function Setup1vs1Page() {
  const router = useRouter();
  const { addGame, getPlayer } = useGameStore();

  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [setsToWin, setSetsToWin] = useState(1);

  const previewPlayer1 = selectedPlayers[0] ? getPlayer(selectedPlayers[0]) : undefined;
  const previewPlayer2 = selectedPlayers[1] ? getPlayer(selectedPlayers[1]) : undefined;
  const previewCard1 = previewPlayer1
    ? createPadelPlayer(previewPlayer1.id, previewPlayer1.name, 'left', `${previewPlayer1.id}-setup-left`, previewPlayer1.currentElo)
    : undefined;
  const previewCard2 = previewPlayer2
    ? createPadelPlayer(previewPlayer2.id, previewPlayer2.name, 'right2', `${previewPlayer2.id}-setup-right2`, previewPlayer2.currentElo)
    : undefined;

  const handleStart = () => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const match: Match1vs1 = {
      id,
      type: '1vs1',
      date: now,
      startedAt: now,
      player1: selectedPlayers[0],
      player2: selectedPlayers[1],
      setsToWin,
      sets: [{ team1Games: 0, team2Games: 0 }],
      winner: null,
      status: 'in_progress',
    };
    addGame(match);
    router.push(`/game/1vs1/${id}`);
  };

  return (
    <div className="px-4 pt-8 pb-10 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-in-up">
        <Link
          href="/new-game"
          className="flex items-center justify-center w-11 h-11 rounded-full glass-card-static transition-all hover-border-theme active:scale-95"
        >
          <svg className="w-5 h-5 app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">1vs1 Einrichtung</h1>
          <p className="text-sm app-text-muted mt-0.5">Schritt {step} von 2</p>
        </div>
      </div>

      {/* Step 1: Select Players */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in-up stagger-1">
          <PlayerSelector
            selectedPlayers={selectedPlayers}
            onPlayersChange={setSelectedPlayers}
            minPlayers={2}
            maxPlayers={2}
            exactCount={2}
          />
          <button
            onClick={() => setStep(2)}
            disabled={selectedPlayers.length !== 2}
            className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-30"
          >
            Weiter
          </button>
        </div>
      )}

      {/* Step 2: Settings + Preview */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in-up stagger-1">
          {/* Sets to win */}
          <div className="glass-card-static rounded-2xl p-5">
            <label className="text-xs app-text-muted font-semibold uppercase tracking-wider block mb-3">
              Sätze zum Gewinnen
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setSetsToWin(n)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    setsToWin === n
                      ? 'app-choice-active'
                      : 'glass-card-static app-text-secondary hover-text-primary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Match Preview */}
          <div className="glass-card-static rounded-2xl p-6 space-y-5">
            <h3 className="text-xs font-semibold app-text-muted uppercase tracking-wider text-center">
              Match Übersicht
            </h3>
            {previewCard1 && previewCard2 ? (
              <PadelBuilder
                title="Match Preview"
                initialFormation="1-1"
                players={[previewCard1, previewCard2]}
                initialPlacements={{ left: previewCard1, right2: previewCard2 }}
                scoreLabel="0 - 0"
                readOnly
              />
            ) : null}
            <p className="text-center text-xs app-text-subtle">
              Best of {setsToWin * 2 - 1} · {setsToWin} {setsToWin === 1 ? 'Satz' : 'Sätze'} zum Gewinnen
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="btn-secondary flex-1 py-4 text-sm font-semibold"
            >
              Zurück
            </button>
            <button
              onClick={handleStart}
              className="btn-primary flex-1 py-4 text-base font-semibold"
            >
              Spiel starten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
