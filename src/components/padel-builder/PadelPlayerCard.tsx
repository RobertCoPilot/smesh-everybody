import { getTierBorderClassName, getTierCardClassName, getTierLabel } from '@/lib/eloTiers';
import type { PadelPlayer } from './types';

interface PadelPlayerCardProps {
  player?: PadelPlayer;
  selected?: boolean;
  emptyLabel?: string;
  compact?: boolean;
}

const statRows: Array<[keyof PadelPlayer['stats'], string]> = [
  ['speed', 'SPD'],
  ['power', 'PWR'],
  ['control', 'CTL'],
  ['defense', 'DEF'],
  ['volley', 'VOL'],
  ['serve', 'SVA'],
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PadelPlayerCard({ player, selected = false, emptyLabel = 'Slot', compact = false }: PadelPlayerCardProps) {
  if (!player) {
    return (
      <div className="flex h-full min-h-[8.5rem] w-full flex-col items-center justify-center border border-dashed border-white/35 bg-theme-soft px-3 text-center app-text-secondary backdrop-blur-sm">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/35 text-lg">+</div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em]">{emptyLabel}</p>
      </div>
    );
  }

  const variant = player.cardVariant ?? player.eloTier ?? 'silver';
  const tierLabel = getTierLabel(variant);
  const sideLabel = player.preferredSide === 'both' ? 'B' : player.preferredSide === 'right' ? 'R' : 'L';
  const cosmeticClass = player.equippedCosmetic?.cardClassName ?? '';
  const effectClass = [player.cardEffect?.glowClassName, player.cardEffect?.borderClassName].filter(Boolean).join(' ');

  return (
    <div className="relative h-full w-full">
      {selected && (
        <div className="pointer-events-none absolute -inset-2 z-20">
          <span className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-red-500" />
          <span className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-red-500" />
          <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-red-500" />
          <span className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-red-500" />
        </div>
      )}

      <div className={`relative h-full min-h-[9rem] overflow-hidden border bg-gradient-to-br ${getTierCardClassName(variant)} ${getTierBorderClassName(variant)} ${cosmeticClass} ${effectClass} p-2 shadow-[0_18px_35px_rgba(0,0,0,0.38)]`}>
        <div className="absolute inset-[3px] border border-theme" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.5),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.18),transparent_42%)]" />
        {player.cardEffect?.flairLabel && (
          <div className="absolute right-1 top-1 z-20 rounded-full bg-black/55 px-1.5 py-0.5 text-[0.48rem] font-black uppercase tracking-wider text-white">
            {player.cardEffect.flairLabel}
          </div>
        )}
        {player.equippedCosmetic?.label && (
          <div className="absolute bottom-1 right-1 z-20 text-sm drop-shadow">{player.equippedCosmetic.label}</div>
        )}

        <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-1">
          <div className="flex items-start justify-between">
            <div>
              <p className={`${compact ? 'text-xl' : 'text-2xl'} font-black leading-none tabular-nums`}>{player.rating}</p>
              <p className="text-[0.55rem] font-black uppercase tracking-widest">OVR</p>
              {player.currentElo !== undefined && <p className="text-[0.5rem] font-black uppercase tracking-widest opacity-80">{Math.round(player.currentElo)} ELO</p>}
            </div>
            <div className="text-right">
              <p className="text-[0.58rem] font-black uppercase tracking-widest">{tierLabel}</p>
              <p className="text-[0.55rem] font-black uppercase tracking-widest opacity-80">Side {sideLabel}</p>
              <p className="text-[0.55rem] uppercase opacity-80">{player.dominantHand === 'left' ? 'Lefty' : 'Righty'}</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#2b1d10]/25 text-lg font-black ring-1 ring-white/35">
              {player.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                getInitials(player.name)
              )}
            </div>
            <p className="max-w-full truncate text-center text-[0.68rem] font-black uppercase tracking-wide">{player.name}</p>
            <p className="text-[0.52rem] font-semibold uppercase tracking-[0.12em] opacity-80">{player.playstyle ?? 'All Court'}</p>
          </div>

          <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 border-t border-black/20 pt-1">
            {statRows.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-1 text-[0.5rem] font-black leading-tight">
                <span>{label}</span>
                <span>{player.stats[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
