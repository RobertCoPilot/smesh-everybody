'use client';

import type { ReactNode } from 'react';
import { PadelBuilder } from '@/components/padel-builder/PadelBuilder';
import { createPadelPlayer } from '@/components/padel-builder/playerFactory';
import type { FormationId } from '@/config/padelFormations';
import type { PadelPlayer, PlacedPadelPlayers } from '@/components/padel-builder/types';

const ACCENTS = {
  violet: 'border-theme',
  amber: 'border-amber-500/25',
  rose: 'border-rose-500/25',
  blue: 'border-blue-500/25',
} as const;

type AccentColor = keyof typeof ACCENTS;

interface CourtCardProps {
  team1Players: string[];
  team2Players: string[];
  team1Score?: ReactNode;
  team2Score?: ReactNode;
  courtNumber?: number;
  accentColor?: AccentColor;
  compact?: boolean;
  completed?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  statusBadge?: ReactNode;
  className?: string;
}

function getFormation(team1Count: number, team2Count: number): FormationId {
  if (team1Count >= 2 && team2Count >= 2) return '2-2';
  if (team1Count >= 2 && team2Count <= 1) return '2-1';
  if (team1Count <= 1 && team2Count >= 2) return '1-2';
  return '1-1';
}

function createCourtPlayers(team1Players: string[], team2Players: string[]) {
  const players: PadelPlayer[] = [];
  const placements: PlacedPadelPlayers = {};

  const team1LeftName = team1Players[0];
  const team1RightName = team1Players[1];
  const team2LeftName = team2Players[0];
  const team2RightName = team2Players[1];

  if (team1LeftName) {
    const player = createPadelPlayer(team1LeftName, team1LeftName, 'left', `${team1LeftName}-left`);
    placements.left = player;
    players.push(player);
  }

  if (team1RightName) {
    const player = createPadelPlayer(team1RightName, team1RightName, 'right', `${team1RightName}-right`);
    placements.right = player;
    players.push(player);
  }

  if (team2LeftName) {
    const slot = team2RightName ? 'left2' : 'right2';
    const player = createPadelPlayer(team2LeftName, team2LeftName, slot, `${team2LeftName}-${slot}`);
    placements[slot] = player;
    players.push(player);
  }

  if (team2RightName) {
    const player = createPadelPlayer(team2RightName, team2RightName, 'right2', `${team2RightName}-right2`);
    placements.right2 = player;
    players.push(player);
  }

  return { players, placements };
}

function scoreLabelFromScores(team1Score?: ReactNode, team2Score?: ReactNode): string | undefined {
  if (typeof team1Score === 'number' || typeof team1Score === 'string') {
    if (typeof team2Score === 'number' || typeof team2Score === 'string') {
      return `${team1Score} - ${team2Score}`;
    }
  }
  return undefined;
}

export default function CourtCard({
  team1Players,
  team2Players,
  team1Score,
  team2Score,
  courtNumber,
  accentColor = 'violet',
  compact = false,
  completed = false,
  highlighted = false,
  onClick,
  footer,
  statusBadge,
  className = '',
}: CourtCardProps) {
  const formation = getFormation(team1Players.length, team2Players.length);
  const { players, placements } = createCourtPlayers(team1Players, team2Players);
  const hasScoreControls = team1Score !== undefined || team2Score !== undefined;
  const scoreLabel = scoreLabelFromScores(team1Score, team2Score);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      } : undefined}
      className={[
        'w-full text-left transition-all duration-300',
        ACCENTS[accentColor],
        highlighted ? 'ring-1 ring-red-500/40' : '',
        completed ? 'opacity-60' : '',
        onClick ? 'cursor-pointer active:scale-[0.98]' : '',
        compact ? '[&_.aspect-\[3\/4\]]:min-h-[24rem] [&_h2]:text-lg' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="relative">
        {(courtNumber !== undefined || statusBadge) && (
          <div className="mb-2 flex items-center justify-between gap-2">
            {courtNumber !== undefined ? (
              <span className="border border-[#fa520f]/30 bg-[#fff0c2] px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-widest text-[#fa520f]">
                Platz {courtNumber}
              </span>
            ) : <span />}
            {statusBadge}
          </div>
        )}

        <PadelBuilder
          title={courtNumber !== undefined ? `Court ${courtNumber}` : 'Court Card'}
          initialFormation={formation}
          players={players}
          initialPlacements={placements}
          scoreLabel={scoreLabel}
          readOnly
        />

        {hasScoreControls && !scoreLabel && (
          <div className="court-score-controls grid grid-cols-2 gap-3 border-x border-b p-3">
            <div className="flex justify-center">{team1Score}</div>
            <div className="flex justify-center">{team2Score}</div>
          </div>
        )}

        {footer && (
          <div className="court-footer border-x border-b px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface CourtSurfaceProps {
  className?: string;
  children: ReactNode;
}

export function CourtSurface({ className = '', children }: CourtSurfaceProps) {
  return (
    <div className={`app-dark-panel relative overflow-hidden border p-4 ${className}`}>
      {children}
    </div>
  );
}
