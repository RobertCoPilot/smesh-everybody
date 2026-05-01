'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '@/store/gameStore';
import { generateTeams } from '@/lib/tournament';
import PlayerSelector from '@/components/PlayerSelector';
import CourtCard from '@/components/CourtCard';
import type { Match2vs2, TournamentTeam } from '@/types';

type TeamMode = 'manual' | 'random' | 'skill-based';

export default function Setup2vs2Page() {
  const router = useRouter();
  const { getPlayer, getPlayerWins, addGame } = useGameStore();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [teamMode, setTeamMode] = useState<TeamMode>('random');
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [manualPool, setManualPool] = useState<string[]>([]);
  const [manualTeam1, setManualTeam1] = useState<string[]>([]);
  const [manualTeam2, setManualTeam2] = useState<string[]>([]);
  const [setsToWin, setSetsToWin] = useState(2);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const playerName = useCallback(
    (id: string) => getPlayer(id)?.name ?? 'Unbekannt',
    [getPlayer]
  );

  // Reset team state when mode changes
  useEffect(() => {
    setTeams([]);
    if (teamMode === 'manual') {
      setManualPool([...selectedPlayers]);
      setManualTeam1([]);
      setManualTeam2([]);
    }
  }, [teamMode, selectedPlayers]);

  const handleGenerateRandom = () => {
    const result = generateTeams(selectedPlayers, 'random');
    setTeams(result);
  };

  const handleGenerateSkillBased = () => {
    const rankings: Record<string, number> = {};
    for (const id of selectedPlayers) {
      rankings[id] = getPlayerWins(id).twovstwoWins;
    }
    const result = generateTeams(selectedPlayers, 'skill-based', undefined, rankings);
    setTeams(result);
  };

  const handleManualAssign = (playerId: string) => {
    if (manualTeam1.includes(playerId)) {
      setManualTeam1((prev) => prev.filter((id) => id !== playerId));
      setManualPool((prev) => [...prev, playerId]);
    } else if (manualTeam2.includes(playerId)) {
      setManualTeam2((prev) => prev.filter((id) => id !== playerId));
      setManualPool((prev) => [...prev, playerId]);
    } else if (manualPool.includes(playerId)) {
      // Assign to first team that has room
      if (manualTeam1.length < 2) {
        setManualTeam1((prev) => [...prev, playerId]);
        setManualPool((prev) => prev.filter((id) => id !== playerId));
      } else if (manualTeam2.length < 2) {
        setManualTeam2((prev) => [...prev, playerId]);
        setManualPool((prev) => prev.filter((id) => id !== playerId));
      }
    }
  };

  const handleMoveToTeam = (playerId: string, targetTeam: 1 | 2) => {
    // Remove from current location
    setManualPool((prev) => prev.filter((id) => id !== playerId));
    setManualTeam1((prev) => prev.filter((id) => id !== playerId));
    setManualTeam2((prev) => prev.filter((id) => id !== playerId));

    if (targetTeam === 1 && manualTeam1.filter((id) => id !== playerId).length < 2) {
      setManualTeam1((prev) => [...prev.filter((id) => id !== playerId), playerId]);
    } else if (targetTeam === 2 && manualTeam2.filter((id) => id !== playerId).length < 2) {
      setManualTeam2((prev) => [...prev.filter((id) => id !== playerId), playerId]);
    } else {
      setManualPool((prev) => [...prev, playerId]);
    }
  };

  const manualTeamsReady = manualTeam1.length === 2 && manualTeam2.length === 2;

  const finalTeam1: [string, string] | null =
    teamMode === 'manual' && manualTeamsReady
      ? [manualTeam1[0], manualTeam1[1]]
      : teams.length === 2
        ? teams[0].players
        : null;

  const finalTeam2: [string, string] | null =
    teamMode === 'manual' && manualTeamsReady
      ? [manualTeam2[0], manualTeam2[1]]
      : teams.length === 2
        ? teams[1].players
        : null;

  const canProceedStep1 = selectedPlayers.length === 4;
  const canProceedStep2 = finalTeam1 !== null && finalTeam2 !== null;

  const handleStartMatch = () => {
    if (!finalTeam1 || !finalTeam2) return;

    const match: Match2vs2 = {
      id: uuidv4(),
      type: '2vs2',
      date: new Date().toISOString(),
      team1: finalTeam1,
      team2: finalTeam2,
      setsToWin,
      sets: [{ team1Games: 0, team2Games: 0 }],
      winner: null,
      status: 'in_progress',
    };

    addGame(match);
    router.push(`/game/2vs2/${match.id}`);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const steps = ['Spieler', 'Teams', 'Einstellungen'];

  return (
    <div className="min-h-screen text-white px-4 py-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up stagger-1">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
          className="glass-card-static w-10 h-10 rounded-full flex items-center justify-center mb-4 hover:border-white/20 transition-all active:scale-95"
        >
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold gradient-text">2 vs 2 Einrichtung</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-3 mb-10 animate-fade-in-up stagger-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className={`flex items-center gap-2 transition-all ${
                i <= step ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step
                    ? 'bg-[#1f1f1f] text-white shadow-lg shadow-[#8a4a17]/20'
                    : i === step
                      ? 'bg-[#1f1f1f] text-white ring-2 ring-[#fa520f]/30 shadow-lg shadow-[#8a4a17]/20'
                      : 'glass-card-static text-white/25'
                }`}
              >
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline transition-colors ${
                  i <= step ? 'text-white/90' : 'text-white/25'
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`w-10 h-px transition-colors ${i < step ? 'bg-violet-500/50' : 'bg-white/6'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 - Select Players */}
      {step === 0 && (
        <div className="space-y-6 animate-fade-in-up">
          <PlayerSelector
            selectedPlayers={selectedPlayers}
            onPlayersChange={setSelectedPlayers}
            exactCount={4}
          />

          {selectedPlayers.length > 0 && (
            <div className="glass-card-static rounded-2xl p-5">
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Ausgewählt ({selectedPlayers.length}/4)
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedPlayers.map((id) => (
                  <span
                    key={id}
                    className="bg-violet-500/10 text-violet-400 px-4 py-1.5 rounded-full text-sm font-semibold border border-violet-500/20"
                  >
                    {playerName(id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(1)}
            disabled={!canProceedStep1}
            className="w-full py-3.5 btn-primary text-sm"
          >
            Weiter – Teams konfigurieren
          </button>
        </div>
      )}

      {/* Step 2 - Configure Teams */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Mode selector */}
          <div>
            <h3 className="text-sm font-semibold text-white/60 mb-3">Teambildung</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['manual', 'random', 'skill-based'] as TeamMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTeamMode(mode)}
                  className={`py-3 px-3 rounded-2xl text-sm font-medium transition-all ${
                    teamMode === mode
                      ? 'bg-[#1f1f1f] text-white shadow-lg shadow-[#8a4a17]/20'
                      : 'glass-card-static text-white/40 hover:text-white/70 hover:border-white/12'
                  }`}
                >
                  {mode === 'manual' ? '✋ Manuell' : mode === 'random' ? '🎲 Zufällig' : '⚖️ Ausgeglichen'}
                </button>
              ))}
            </div>
          </div>

          {/* Manual mode */}
          {teamMode === 'manual' && (
            <div className="space-y-4">
              {/* Unassigned pool */}
              {manualPool.length > 0 && (
                <div className="glass-card-static rounded-2xl p-5">
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                    Zum Zuweisen tippen
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {manualPool.map((id) => (
                      <div key={id} className="flex gap-px">
                        <button
                          onClick={() => handleMoveToTeam(id, 1)}
                          className="glass-card-static hover:bg-blue-500/10 text-white/60 px-3 py-2 rounded-l-xl text-sm font-medium transition-all hover:border-blue-500/30 hover:text-blue-400"
                        >
                          ← T1
                        </button>
                        <span className="glass-card-static text-white/90 px-3 py-2 text-sm font-medium flex items-center border-x-0 rounded-none">
                          {playerName(id)}
                        </span>
                        <button
                          onClick={() => handleMoveToTeam(id, 2)}
                          className="glass-card-static hover:bg-amber-500/10 text-white/60 px-3 py-2 rounded-r-xl text-sm font-medium transition-all hover:border-amber-500/30 hover:text-amber-400"
                        >
                          T2 →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team boxes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card-static rounded-2xl p-4 !border-blue-500/20">
                  <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">
                    Team 1 ({manualTeam1.length}/2)
                  </h4>
                  <div className="space-y-2 min-h-[60px]">
                    {manualTeam1.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleManualAssign(id)}
                        className="w-full bg-blue-500/10 text-blue-300 px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500/15 transition-colors text-left border border-blue-500/15"
                      >
                        {playerName(id)}
                        <span className="text-blue-500/50 text-xs ml-1">✕</span>
                      </button>
                    ))}
                    {manualTeam1.length === 0 && (
                      <p className="text-white/20 text-xs text-center py-3">Spieler zuweisen</p>
                    )}
                  </div>
                </div>

                <div className="glass-card-static rounded-2xl p-4 !border-amber-500/20">
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
                    Team 2 ({manualTeam2.length}/2)
                  </h4>
                  <div className="space-y-2 min-h-[60px]">
                    {manualTeam2.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleManualAssign(id)}
                        className="w-full bg-amber-500/10 text-amber-300 px-3 py-2 rounded-xl text-sm font-medium hover:bg-amber-500/15 transition-colors text-left border border-amber-500/15"
                      >
                        {playerName(id)}
                        <span className="text-amber-500/50 text-xs ml-1">✕</span>
                      </button>
                    ))}
                    {manualTeam2.length === 0 && (
                      <p className="text-white/20 text-xs text-center py-3">Spieler zuweisen</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Random mode */}
          {teamMode === 'random' && (
            <div className="space-y-4">
              <button
                onClick={handleGenerateRandom}
                className="w-full py-3.5 rounded-2xl btn-secondary text-sm"
              >
                🎲 Zufällige Teams erstellen
              </button>
              {teams.length === 2 && <TeamsPreview teams={teams} playerName={playerName} />}
            </div>
          )}

          {/* Skill-based mode */}
          {teamMode === 'skill-based' && (
            <div className="space-y-4">
              <button
                onClick={handleGenerateSkillBased}
                className="w-full py-3.5 rounded-2xl btn-secondary text-sm"
              >
                ⚖️ Ausgeglichene Teams erstellen
              </button>
              <p className="text-xs text-white/40 text-center">
                Paart stärksten mit schwächstem Spieler für ausgeglichene Matches
              </p>
              {teams.length === 2 && <TeamsPreview teams={teams} playerName={playerName} />}
            </div>
          )}

          {/* Manual teams preview */}
          {teamMode === 'manual' && manualTeamsReady && (
            <div className="glass-card-static rounded-2xl p-4 !border-violet-500/20">
              <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider text-center mb-2">
                Teams bereit ✓
              </p>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!canProceedStep2}
            className="w-full py-3.5 btn-primary text-sm"
          >
            Weiter – Spieleinstellungen
          </button>
        </div>
      )}

      {/* Step 3 - Match Settings */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Sets to win */}
          <div>
            <h3 className="text-sm font-semibold text-white/60 mb-3">Sätze zum Gewinnen</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setSetsToWin(n)}
                  className={`py-3.5 rounded-2xl text-lg font-bold transition-all ${
                    setsToWin === n
                      ? 'bg-[#1f1f1f] text-white shadow-lg shadow-[#8a4a17]/20'
                      : 'glass-card-static text-white/40 hover:text-white/70 hover:border-white/12'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-2 text-center">
              Best of {setsToWin * 2 - 1} Sätze
            </p>
          </div>

          {/* Match summary */}
          <div className="glass-card-static rounded-2xl p-6 space-y-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider text-center">
              Match Übersicht
            </h3>

            <CourtCard
              team1Players={[playerName(finalTeam1![0]), playerName(finalTeam1![1])]}
              team2Players={[playerName(finalTeam2![0]), playerName(finalTeam2![1])]}
              accentColor="blue"
            />

            <div className="text-center">
              <span className="text-xs text-white/40">Best of </span>
              <span className="text-sm text-white/90 font-semibold">{setsToWin * 2 - 1} Sätze</span>
              <span className="text-xs text-white/40"> (zuerst {setsToWin})</span>
            </div>
          </div>

          <button
            onClick={handleStartMatch}
            className="w-full py-4.5 btn-primary text-base font-bold"
          >
            🏆 Match starten
          </button>
        </div>
      )}
    </div>
  );
}

function TeamsPreview({
  teams,
  playerName,
}: {
  teams: TournamentTeam[];
  playerName: (id: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass-card-static rounded-2xl p-4 !border-blue-500/15">
        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
          Team 1
        </h4>
        {teams[0].players.map((id) => (
          <p key={id} className="text-sm text-white/90 font-medium">
            {playerName(id)}
          </p>
        ))}
      </div>
      <div className="glass-card-static rounded-2xl p-4 !border-amber-500/15">
        <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
          Team 2
        </h4>
        {teams[1].players.map((id) => (
          <p key={id} className="text-sm text-white/90 font-medium">
            {playerName(id)}
          </p>
        ))}
      </div>
    </div>
  );
}
