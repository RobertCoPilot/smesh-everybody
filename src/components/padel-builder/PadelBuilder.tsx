'use client';

import { useMemo, useState } from 'react';
import { PADEL_FORMATIONS, type FormationId, type PadelPosition } from '@/config/padelFormations';
import { FormationSelector } from './FormationSelector';
import { PadelCourt } from './PadelCourt';
import { PadelPlayerCard } from './PadelPlayerCard';
import type { PadelPlayer, PlacedPadelPlayers } from './types';

interface PadelBuilderProps {
  title?: string;
  initialFormation: FormationId;
  players: PadelPlayer[];
  initialPlacements: PlacedPadelPlayers;
  scoreLabel?: string;
  readOnly?: boolean;
}

function cleanupPlacements(formation: FormationId, placements: PlacedPadelPlayers): PlacedPadelPlayers {
  const activeSlots = new Set<PadelPosition>(PADEL_FORMATIONS[formation].activeSlots);
  const nextPlacements: PlacedPadelPlayers = {};

  for (const slot of activeSlots) {
    if (placements[slot]) nextPlacements[slot] = placements[slot];
  }

  return nextPlacements;
}

export function PadelBuilder({
  title = 'Padel Lineup Builder',
  initialFormation,
  players,
  initialPlacements,
  scoreLabel,
  readOnly = false,
}: PadelBuilderProps) {
  const [formation, setFormation] = useState<FormationId>(initialFormation);
  const [selectedSlot, setSelectedSlot] = useState<PadelPosition | null>(PADEL_FORMATIONS[initialFormation].activeSlots[0] ?? null);
  const [placements, setPlacements] = useState<PlacedPadelPlayers>(() => cleanupPlacements(initialFormation, initialPlacements));

  const benchedPlayers = useMemo(() => {
    const placedIds = new Set(Object.values(placements).map((player) => player?.id).filter(Boolean));
    return players.filter((player) => !placedIds.has(player.id));
  }, [placements, players]);

  const handleFormationChange = (nextFormation: FormationId) => {
    if (readOnly) return;
    setFormation(nextFormation);
    setPlacements((current) => cleanupPlacements(nextFormation, current));
    setSelectedSlot(PADEL_FORMATIONS[nextFormation].activeSlots[0] ?? null);
  };

  const handleAssignPlayer = (player: PadelPlayer) => {
    if (readOnly || !selectedSlot) return;
    setPlacements((current) => {
      const withoutDuplicate: PlacedPadelPlayers = {};
      for (const [slot, placedPlayer] of Object.entries(current) as Array<[PadelPosition, PadelPlayer | undefined]>) {
        if (placedPlayer?.id !== player.id) withoutDuplicate[slot] = placedPlayer;
      }
      return {
        ...withoutDuplicate,
        [selectedSlot]: {
          ...player,
          position: selectedSlot,
        },
      };
    });
  };

  const handleRemovePlayer = (position: PadelPosition) => {
    if (readOnly) return;
    setPlacements((current) => {
      const nextPlacements = { ...current };
      delete nextPlacements[position];
      return nextPlacements;
    });
  };

  const handleSelectSlot = (position: PadelPosition) => {
    if (!readOnly) setSelectedSlot(position);
  };

  return (
    <section className="space-y-4 text-white">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[#fa520f]">FUT-style Padel</p>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#1f1f1f]">{title}</h2>
        </div>
        <div className="text-right text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#1f1f1f]/45">
          {Object.values(placements).filter(Boolean).length}/{PADEL_FORMATIONS[formation].activeSlots.length} Slots
        </div>
      </div>

      {!readOnly && <FormationSelector activeFormation={formation} onChange={handleFormationChange} />}

      <PadelCourt
        formation={formation}
        players={placements}
        selectedSlot={readOnly ? null : selectedSlot}
        onSelectSlot={handleSelectSlot}
        onRemovePlayer={handleRemovePlayer}
        scoreLabel={scoreLabel}
      />

      {!readOnly && (
        <div className="border border-black/10 bg-[#1f1f1f] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">Player Pool</p>
              <p className="text-[0.7rem] text-white/35">Select a slot, then tap a card to place it.</p>
            </div>
            {selectedSlot && (
              <span className="border border-red-500/40 bg-red-500/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-widest text-red-200">
                {selectedSlot}
              </span>
            )}
          </div>

          {benchedPlayers.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {benchedPlayers.map((player) => (
                <button key={player.id} type="button" onClick={() => handleAssignPlayer(player)} className="transition hover:-translate-y-1 active:scale-95">
                  <PadelPlayerCard player={player} compact />
                </button>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-white/20 py-6 text-center text-xs uppercase tracking-[0.18em] text-white/35">
              All cards are on court
            </div>
          )}
        </div>
      )}
    </section>
  );
}
