import type { PadelPosition } from '@/config/padelFormations';
import type { PlacedPadelPlayers } from './types';

interface ChemistryLinesProps {
  players: PlacedPadelPlayers;
  chemistryScores?: Record<string, number>;
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

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

export function ChemistryLines({ players, chemistryScores = {} }: ChemistryLinesProps) {
  const activePairs = teammatePairs.flatMap(([from, to]) => {
    const fromPlayer = players[from];
    const toPlayer = players[to];
    if (!fromPlayer || !toPlayer) return [];
    const start = coordinates[from];
    const end = coordinates[to];
    const score = chemistryScores[pairKey(fromPlayer.id, toPlayer.id)] ?? 0;
    return [{ from, to, start, end, score }];
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {activePairs.map(({ from, to, start, end }) => (
          <line
            key={`${from}-${to}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(239,68,68,0.95)"
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {activePairs.map(({ from, to, start, end, score }) => (
        <span
          key={`${from}-${to}-score`}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-200 bg-red-600 px-2 py-0.5 text-[0.65rem] font-black leading-none text-white shadow-[0_0_18px_rgba(239,68,68,0.65)]"
          style={{ left: `${(start.x + end.x) / 2}%`, top: `${(start.y + end.y) / 2}%` }}
        >
          {score}
        </span>
      ))}
    </div>
  );
}
