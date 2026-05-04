'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '@/store/gameStore';
import PlayerSelector from '@/components/PlayerSelector';
import { PadelBuilder } from '@/components/padel-builder/PadelBuilder';
import { createPadelPlayer } from '@/components/padel-builder/playerFactory';
import type { PlacedPadelPlayers } from '@/components/padel-builder/types';
import { generateTeams, generateBracket, getRoundName } from '@/lib/tournament';
import type { Tournament, TournamentMatch, TournamentTeam } from '@/types';

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

const STEPS = ['Spieler', 'Teams', 'Einstellungen', 'Vorschau'];

type TeamMode = 'manual' | 'random' | 'skill-based';

export default function TournamentSetupPage() {
  const router = useRouter();
  const { players, addGame, getPlayer, getPlayerWins } = useGameStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [teamMode, setTeamMode] = useState<TeamMode>('random');
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [courts, setCourts] = useState(1);
  const [setsPerRound, setSetsPerRound] = useState<Record<number, number>>({});

  // Manual team builder state
  const [manualSlots, setManualSlots] = useState<[string | null, string | null][]>([]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isOdd = selectedPlayers.length % 2 !== 0;
  const numTeams = Math.floor(selectedPlayers.length / 2);
  const totalRounds = numTeams > 0 ? Math.ceil(Math.log2(numTeams)) : 0;
  const maxCourts = Math.max(1, Math.floor(numTeams / 2));

  // Initialize manual slots when player count changes
  useEffect(() => {
    const slotCount = Math.floor(selectedPlayers.length / 2);
    setManualSlots(Array.from({ length: slotCount }, () => [null, null]));
  }, [selectedPlayers.length]);

  // Initialize sets per round when totalRounds changes
  useEffect(() => {
    if (totalRounds > 0) {
      const defaultSets: Record<number, number> = {};
      for (let r = 0; r < totalRounds; r++) {
        defaultSets[r] = setsPerRound[r] || 1;
      }
      setSetsPerRound(defaultSets);
    }
  }, [totalRounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTeamPlayerNames = useCallback(
    (team: TournamentTeam) => {
      const p1 = getPlayer(team.players[0]);
      const p2 = getPlayer(team.players[1]);
      return `${p1?.name || '?'} & ${p2?.name || '?'}`;
    },
    [getPlayer],
  );

  const buildTeams = useCallback(() => {
    if (teamMode === 'manual') {
      const validSlots = manualSlots.filter(
        (s): s is [string, string] => s[0] !== null && s[1] !== null,
      );
      if (validSlots.length !== numTeams) return;
      return generateTeams(selectedPlayers, 'manual', validSlots);
    }

    if (teamMode === 'skill-based') {
      const rankings: Record<string, number> = {};
      for (const pid of selectedPlayers) {
        const stats = getPlayerWins(pid);
        rankings[pid] = stats.twovstwoWins + stats.tournamentWins * 2;
      }
      return generateTeams(selectedPlayers, 'skill-based', undefined, rankings);
    }

    return generateTeams(selectedPlayers, 'random');
  }, [teamMode, manualSlots, numTeams, selectedPlayers, getPlayerWins]);

  // Generate teams when moving to step 2 or changing mode
  const handleGenerateTeams = useCallback(() => {
    if (teamMode === 'manual') return; // manual teams built interactively
    const result = buildTeams();
    if (result) setTeams(result);
  }, [teamMode, buildTeams]);

  const previewMatches = useMemo(() => {
    if (teams.length < 2) return [];
    return generateBracket(teams, setsPerRound);
  }, [teams, setsPerRound]);

  const getReadOnlyLineup = useCallback(
    (match: TournamentMatch): PlacedPadelPlayers => {
      const team1 = teams.find((team) => team.id === match.team1Id);
      const team2 = teams.find((team) => team.id === match.team2Id);
      const placements: PlacedPadelPlayers = {};

      if (team1) {
        const player1 = getPlayer(team1.players[0]);
        const player2 = getPlayer(team1.players[1]);
        placements.left = createPadelPlayer(team1.players[0], player1?.name ?? 'Offen', 'left', `${match.id}-${team1.players[0]}-left`, player1?.currentElo);
        placements.right = createPadelPlayer(team1.players[1], player2?.name ?? 'Offen', 'right', `${match.id}-${team1.players[1]}-right`, player2?.currentElo);
      }

      if (team2) {
        const player3 = getPlayer(team2.players[0]);
        const player4 = getPlayer(team2.players[1]);
        placements.left2 = createPadelPlayer(team2.players[0], player3?.name ?? 'Offen', 'left2', `${match.id}-${team2.players[0]}-left2`, player3?.currentElo);
        placements.right2 = createPadelPlayer(team2.players[1], player4?.name ?? 'Offen', 'right2', `${match.id}-${team2.players[1]}-right2`, player4?.currentElo);
      }

      return placements;
    },
    [getPlayer, teams],
  );

  // Manual team builder helpers
  const assignedPlayers = useMemo(
    () => new Set(manualSlots.flat().filter(Boolean) as string[]),
    [manualSlots],
  );

  const unassignedPlayers = useMemo(
    () => selectedPlayers.filter((p) => !assignedPlayers.has(p)),
    [selectedPlayers, assignedPlayers],
  );

  const [activeSlot, setActiveSlot] = useState<{ team: number; pos: 0 | 1 } | null>(null);

  const handleAssignPlayer = (playerId: string) => {
    if (!activeSlot) return;
    const newSlots = manualSlots.map((s) => [...s] as [string | null, string | null]);
    newSlots[activeSlot.team][activeSlot.pos] = playerId;
    setManualSlots(newSlots);
    // Auto-advance to next empty slot
    let found = false;
    for (let t = activeSlot.team; t < newSlots.length && !found; t++) {
      const startPos = t === activeSlot.team ? activeSlot.pos + 1 : 0;
      for (let p = startPos; p < 2 && !found; p++) {
        if (!newSlots[t][p]) {
          setActiveSlot({ team: t, pos: p as 0 | 1 });
          found = true;
        }
      }
    }
    if (!found) setActiveSlot(null);
  };

  const handleRemoveFromSlot = (teamIdx: number, pos: 0 | 1) => {
    const newSlots = manualSlots.map((s) => [...s] as [string | null, string | null]);
    newSlots[teamIdx][pos] = null;
    setManualSlots(newSlots);
  };

  const manualTeamsComplete = manualSlots.length > 0 && manualSlots.every((s) => s[0] && s[1]);

  const handleConfirmManualTeams = () => {
    const validSlots = manualSlots.filter(
      (s): s is [string, string] => s[0] !== null && s[1] !== null,
    );
    const result = generateTeams(selectedPlayers, 'manual', validSlots);
    setTeams(result);
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return selectedPlayers.length >= 4 && !isOdd;
      case 1:
        return teams.length >= 2;
      case 2:
        return courts >= 1 && Object.keys(setsPerRound).length === totalRounds;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 1 && teams.length === 0) {
      handleGenerateTeams();
    }
    if (step === 0) {
      // reset teams when going to step 1
      setTeams([]);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleStart = () => {
    const tournament: Tournament = {
      id: uuidv4(),
      type: '2vs2-tournament',
      date: new Date().toISOString(),
      players: selectedPlayers,
      teams,
      matches: generateBracket(teams, setsPerRound),
      setsPerRound,
      courts,
      status: 'in_progress',
      winner: null,
    };
    addGame(tournament);
    router.push(`/game/tournament/${tournament.id}`);
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse app-text-faint">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-text-primary pb-20 animate-fade-in">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-fade-in-up stagger-1">
          <button
            onClick={() => router.back()}
            className="glass w-10 h-10 rounded-2xl flex items-center justify-center app-text-secondary hover-text-primary transition-colors"
          >
            ←
          </button>
          <h1 className="gradient-text text-2xl font-bold tracking-tight">2vs2 Turnier</h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-6 animate-fade-in-up stagger-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  i < step
                    ? 'bg-accent-soft app-text-accent border border-theme cursor-pointer'
                    : i === step
                      ? 'app-choice-active ring-2 ring-[var(--league-accent)]/30'
                      : 'glass-card-static app-text-faint'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-[2px] mx-2 rounded-full transition-colors duration-300 ${
                    i < step ? 'bg-accent-soft' : 'bg-theme-soft'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm app-text-muted mb-5 font-medium tracking-wide uppercase animate-fade-in-up stagger-2">
          {STEPS[step]}
        </p>

        {/* Step 1: Select Players */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in-up">
            <PlayerSelector
              selectedPlayers={selectedPlayers}
              onPlayersChange={setSelectedPlayers}
              minPlayers={4}
            />
            <div className="glass-card-static rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm app-text-secondary">
                <span className="app-text-primary font-semibold">{selectedPlayers.length}</span> Spieler ausgewählt
              </span>
              {selectedPlayers.length >= 4 && (
                <span className="text-sm app-text-muted">
                  → <span className="app-text-accent font-semibold">{numTeams}</span> Teams
                </span>
              )}
            </div>
            {isOdd && selectedPlayers.length >= 4 && (
              <div className="pill bg-rose-500/10 app-text-accent border border-rose-500/20 inline-flex items-center gap-1.5 !px-3 !py-1.5 rounded-xl">
                <span className="text-xs">⚠️ Wähle eine gerade Anzahl an Spielern für 2vs2 Teams</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure Teams */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Mode selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['random', 'skill-based', 'manual'] as TeamMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setTeamMode(mode);
                    setTeams([]);
                  }}
                  className={`glass-card-static py-2.5 px-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                    teamMode === mode
                      ? 'bg-accent-soft border-theme app-text-accent shadow-[0_0_16px_rgba(139,92,246,0.1)]'
                      : 'app-text-secondary hover-text-primary hover-surface'
                  }`}
                >
                  {mode === 'skill-based' ? 'Ausgeglichen' : mode === 'random' ? 'Zufällig' : 'Manuell'}
                </button>
              ))}
            </div>

            {/* Manual team builder */}
            {teamMode === 'manual' && (
              <div className="space-y-3">
                {manualSlots.map((slot, teamIdx) => (
                  <div key={teamIdx} className="glass-card-static rounded-2xl p-4">
                    <p className="text-xs app-text-muted mb-2 font-medium">Team {teamIdx + 1}</p>
                    <div className="flex gap-2">
                      {([0, 1] as const).map((pos) => {
                        const pid = slot[pos];
                        const player = pid ? getPlayer(pid) : null;
                        const isActive =
                          activeSlot?.team === teamIdx && activeSlot?.pos === pos;
                        return (
                          <button
                            key={pos}
                            onClick={() => {
                              if (pid) {
                                handleRemoveFromSlot(teamIdx, pos);
                              } else {
                                setActiveSlot({ team: teamIdx, pos });
                              }
                            }}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-sm transition-all duration-300 ${
                              pid
                                ? 'bg-accent-soft app-text-accent border border-theme'
                                : isActive
                                  ? 'bg-accent-soft border-2 border-blue-500/50 app-text-accent'
                                  : 'glass-card-static app-text-faint'
                            }`}
                          >
                            {player?.name || (isActive ? 'Auswählen...' : 'Tippen zum Füllen')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Unassigned players */}
                {unassignedPlayers.length > 0 && activeSlot && (
                  <div className="space-y-2">
                    <p className="text-xs app-text-muted font-medium">Spieler antippen zum Zuweisen:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {unassignedPlayers.map((pid) => {
                        const player = getPlayer(pid);
                        return (
                          <button
                            key={pid}
                            onClick={() => handleAssignPlayer(pid)}
                            className="glass-card app-text-primary py-2.5 px-3 rounded-xl text-sm"
                          >
                            {player?.name || pid}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {manualTeamsComplete && teams.length === 0 && (
                  <button
                    onClick={handleConfirmManualTeams}
                    className="btn-primary w-full py-3 text-sm"
                  >
                    Teams bestätigen
                  </button>
                )}
              </div>
            )}

            {/* Random / Skill-Based generate button */}
            {teamMode !== 'manual' && teams.length === 0 && (
              <button
                onClick={handleGenerateTeams}
                className="btn-secondary w-full py-3 text-sm"
              >
                Teams erstellen
              </button>
            )}

            {/* Team preview */}
            {teams.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm app-text-muted font-medium">Teams ({teams.length})</p>
                  {teamMode !== 'manual' && (
                    <button
                      onClick={() => {
                        setTeams([]);
                        handleGenerateTeams();
                      }}
                      className="text-xs app-text-accent hover-text-primary transition-colors"
                    >
                      Mischen ↻
                    </button>
                  )}
                </div>
                {teams.map((team, i) => (
                  <div
                    key={team.id}
                    className={`glass-card-static rounded-2xl p-3.5 flex items-center gap-3 animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <span className="text-xs app-text-faint w-5 font-mono">#{i + 1}</span>
                    <span className="text-sm app-text-primary">{getTeamPlayerNames(team)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Tournament Settings */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Courts */}
            <div>
              <label className="text-sm app-text-muted block mb-3 font-medium">
                Anzahl der Plätze
              </label>
              <div className="flex gap-2">
                {Array.from({ length: maxCourts }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setCourts(n)}
                    className={`glass-card-static flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                      courts === n
                        ? 'bg-accent-soft border-theme app-text-accent shadow-[0_0_16px_rgba(139,92,246,0.1)]'
                        : 'app-text-secondary hover-text-primary'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Sets per round */}
            <div className="space-y-3">
              <label className="text-sm app-text-muted block font-medium">
                Sätze zum Gewinnen pro Runde
              </label>
              {Array.from({ length: totalRounds }, (_, r) => r).map((round) => {
                const name = getRoundNameDE(round, totalRounds);
                return (
                  <div
                    key={round}
                    className="glass-card-static rounded-2xl p-4 flex items-center justify-between"
                  >
                    <span className="text-sm app-text-primary font-medium">{name}</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() =>
                            setSetsPerRound((prev) => ({ ...prev, [round]: n }))
                          }
                          className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all duration-300 ${
                            setsPerRound[round] === n
                              ? 'bg-accent-soft app-text-accent border border-theme'
                              : 'glass-card-static app-text-muted hover-text-primary/60'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Bracket Preview & Start */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in-up">
            <p className="text-sm app-text-muted font-medium">Turnierbaum Vorschau</p>

            {/* Simple bracket visualization */}
            {(() => {
              const rounds = [...new Set(previewMatches.map((m) => m.round))].sort(
                (a, b) => a - b,
              );
              return (
                <div className="space-y-5">
                  {rounds.map((round) => {
                    const roundMatches = previewMatches.filter((m) => m.round === round);
                    const roundName = getRoundNameDE(round, totalRounds);
                    return (
                      <div key={round}>
                        <p className="gradient-text-accent text-xs font-semibold mb-2 uppercase tracking-wider">{roundName}</p>
                        <div className="space-y-5">
                          {roundMatches.map((match, matchIndex) => {
                            const lineup = getReadOnlyLineup(match);
                            const playerCards = Object.values(lineup).filter((player) => player !== undefined);
                            return (
                              <PadelBuilder
                                key={match.id}
                                title={`${roundName} · Match ${matchIndex + 1}`}
                                initialFormation="2-2"
                                players={playerCards}
                                initialPlacements={lineup}
                                scoreLabel={match.status === 'completed' ? 'BYE' : '0 - 0'}
                                readOnly
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Summary */}
            <div className="glass-card-static rounded-2xl p-4 space-y-1.5">
              <p className="text-sm app-text-secondary">
                <span className="app-text-primary font-semibold">{teams.length}</span> Teams · <span className="app-text-primary font-semibold">{totalRounds}</span> Runden · <span className="app-text-primary font-semibold">{courts}</span> {courts > 1 ? 'Plätze' : 'Platz'}
              </p>
              <p className="text-xs app-text-muted">
                Sätze:{' '}
                {Array.from({ length: totalRounds }, (_, r) =>
                  `${getRoundNameDE(r, totalRounds)}: Bo${(setsPerRound[r] || 1) * 2 - 1}`,
                ).join(', ')}
              </p>
            </div>

            <button
              onClick={handleStart}
              className="btn-primary w-full py-4 rounded-2xl font-semibold text-base"
            >
              🏆 Turnier starten
            </button>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary flex-1 py-3 text-sm"
            >
              Zurück
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`btn-primary flex-1 py-3 text-sm ${
                !canProceed() ? 'opacity-100' : ''
              }`}
            >
              Weiter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
