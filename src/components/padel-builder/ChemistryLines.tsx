import type { PadelPosition } from '@/config/padelFormations';
import type { PlacedPadelPlayers } from './types';

interface ChemistryLinesProps {
  players: PlacedPadelPlayers;
}

const teammatePairs: Array<[PadelPosition, PadelPosition]> = [
  ['left', 'right'],
  ['left2', 'right2'],
];

const coordinates: Record<PadelPosition, { x: number; y: number }> = {
  left: { x: 30, y: 76 },
  right: { x: 70, y: 76 },
  left2: { x: 30, y: 24 },
  right2: { x: 70, y: 24 },
};

export function ChemistryLines({ players }: ChemistryLinesProps) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {teammatePairs.map(([from, to]) => {
        if (!players[from] || !players[to]) return null;
        const start = coordinates[from];
        const end = coordinates[to];
        return (
          <line
            key={`${from}-${to}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(34,197,94,0.75)"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
