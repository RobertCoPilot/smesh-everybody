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
}

export function PadelCourt({ formation, players, selectedSlot, onSelectSlot, onRemovePlayer, onDropPlayer, scoreLabel }: PadelCourtProps) {
  const config = PADEL_FORMATIONS[formation];

  return (
    <div className="relative overflow-hidden border border-theme bg-[#07152f] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(29,78,216,0.45),transparent_34%),linear-gradient(180deg,#0b2d66_0%,#092554_47%,#061a3a_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute inset-2 border border-theme shadow-[inset_0_0_34px_rgba(255,255,255,0.12)]" />
      <div className="absolute inset-x-5 top-4 z-10 h-px bg-white/20" />
      <div className="absolute inset-x-5 bottom-4 z-10 h-px bg-white/20" />
      <div className="absolute inset-y-5 left-5 z-10 w-px bg-white/20" />
      <div className="absolute inset-y-5 right-5 z-10 w-px bg-white/20" />

      <div className="relative aspect-[3/4] min-h-[31rem] overflow-hidden border-2 border-white/80 bg-[#0b3474]/35">
        <div className="absolute inset-x-0 top-1/2 z-10 h-[3px] -translate-y-1/2 bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.4)]" />
        <div className="absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 border-y border-white/25 bg-white/5 backdrop-blur-[1px]" />
        <div className="absolute left-0 top-1/2 z-10 h-12 w-full -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.18)_0_1px,transparent_1px_10px)]" />

        <div className="absolute left-1/2 top-0 z-10 h-full w-px -translate-x-1/2 bg-white/55" />
        <div className="absolute left-0 top-1/4 z-10 h-px w-full bg-white/45" />
        <div className="absolute bottom-1/4 left-0 z-10 h-px w-full bg-white/45" />
        <div className="absolute left-[18%] top-0 z-10 h-full w-px bg-white/25" />
        <div className="absolute right-[18%] top-0 z-10 h-full w-px bg-white/25" />

        <ChemistryLines players={players} />

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

        <div className="court-hud absolute bottom-3 left-3 z-30 px-3 py-2 text-left">
          <p className="text-[0.55rem] font-black uppercase tracking-[0.22em] app-text-secondary">Formation</p>
          <p className="text-lg font-black leading-none">{config.label}</p>
        </div>

        {scoreLabel && (
          <div className="court-hud absolute right-3 top-3 z-30 px-3 py-2 text-right">
            <p className="text-[0.55rem] font-black uppercase tracking-[0.22em] app-text-secondary">Match</p>
            <p className="text-lg font-black leading-none">{scoreLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}
