import type { KeyboardEvent, MouseEvent } from 'react';
import type { PadelPosition, PadelSlotAnchor } from '@/config/padelFormations';
import { PadelPlayerCard } from './PadelPlayerCard';
import type { PadelPlayer } from './types';

interface PadelSlotProps {
  position: PadelPosition;
  anchor: PadelSlotAnchor;
  player?: PadelPlayer;
  selected: boolean;
  onSelect: (position: PadelPosition) => void;
  onRemove: (position: PadelPosition) => void;
}

const anchorClass: Record<PadelSlotAnchor, string> = {
  'bottom-left': 'left-[9%] top-[58%]',
  'bottom-right': 'right-[9%] top-[58%]',
  'bottom-center': 'left-1/2 top-[58%] -translate-x-1/2',
  'top-left': 'left-[9%] top-[9%]',
  'top-right': 'right-[9%] top-[9%]',
  'top-center': 'left-1/2 top-[9%] -translate-x-1/2',
};

export function PadelSlot({ position, anchor, player, selected, onSelect, onRemove }: PadelSlotProps) {
  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRemove(position);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(position)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(position);
      }}
      className={`absolute z-20 w-[34%] max-w-[8.7rem] min-w-[6.35rem] cursor-pointer transition-transform active:scale-95 ${anchorClass[anchor]} ${selected ? 'scale-[1.03]' : ''}`}
      aria-label={`${position} ${player ? player.name : 'leer'}`}
    >
      <PadelPlayerCard player={player} selected={selected} emptyLabel={position} compact />
      {player && selected && (
        <span className="absolute -right-2 -top-2 z-30">
          <button
            type="button"
            onClick={handleRemove}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-black text-white shadow-lg"
            aria-label={`${player.name} entfernen`}
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
