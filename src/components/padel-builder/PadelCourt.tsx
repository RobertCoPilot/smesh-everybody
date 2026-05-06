import { PADEL_FORMATIONS, type FormationId, type PadelPosition } from '@/config/padelFormations';
import { ChemistryLines } from './ChemistryLines';
import { PadelSlot } from './PadelSlot';
import type { PlacedPadelPlayers } from './types';

interface PadelCourtProps {
  formation: FormationId;
  players: PlacedPadelPlayers;
  selectedSlot: PadelPosition | null;
  onSelectSlot: (position: PadelPosition) => void;
  onRemovePlayer: (position: PadelPosition) => void;
  onDropPlayer?: (position: PadelPosition, playerId: string) => void;
  scoreLabel?: string;
  chemistryScores?: Record<string, number>;
}

export function PadelCourt({ formation, players, selectedSlot, onSelectSlot, onRemovePlayer, onDropPlayer, scoreLabel, chemistryScores }: PadelCourtProps) {
  const config = PADEL_FORMATIONS[formation];

  return (
    <div className="padel-court-shell">
      <div className="padel-court">
        <div className="padel-court-line net" />
        <div className="padel-court-line center" />
        <div className="padel-court-line service-top" />
        <div className="padel-court-line service-bottom" />
        <div className="padel-court-line side-left" />
        <div className="padel-court-line side-right" />

        <ChemistryLines players={players} chemistryScores={chemistryScores} />

        {config.activeSlots.map((slot) => {
          const anchor = config.slotAnchors[slot];
          if (!anchor) return null;
          return (
            <PadelSlot
              key={slot}
              position={slot}
              anchor={anchor}
              player={players[slot]}
              selected={selectedSlot === slot}
              onSelect={onSelectSlot}
              onRemove={onRemovePlayer}
              onDropPlayer={onDropPlayer}
            />
          );
        })}

        <div className="court-hud padel-court-hud padel-court-hud-formation">
          <p>Formation</p>
          <strong>{config.label}</strong>
        </div>

        {scoreLabel && (
          <div className="court-hud padel-court-hud padel-court-hud-score">
            <p>Match</p>
            <strong>{scoreLabel}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
