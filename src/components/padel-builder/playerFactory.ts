import type { PadelPosition } from '@/config/padelFormations';
import type { PadelCardVariant, PadelPlayer, PadelStats } from './types';

const playstyles = ['Net Rusher', 'Baseline Lock', 'Glass Master', 'Power Server', 'Control Point', 'Counter Puncher'] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function statFromSeed(seed: number, offset: number): number {
  return 62 + ((seed >> offset) % 34);
}

function cardVariantFromRating(rating: number, seed: number): PadelCardVariant {
  if (rating >= 88 || seed % 9 === 0) return 'special';
  if (rating >= 75) return 'gold';
  if (rating >= 66) return 'silver';
  return 'bronze';
}

export function createPadelPlayer(playerId: string, name: string, position: PadelPosition, cardInstanceId = playerId): PadelPlayer {
  const seed = hashString(`${playerId}-${name}`);
  const stats: PadelStats = {
    speed: statFromSeed(seed, 1),
    power: statFromSeed(seed, 3),
    control: statFromSeed(seed, 5),
    defense: statFromSeed(seed, 7),
    volley: statFromSeed(seed, 9),
    serve: statFromSeed(seed, 11),
  };
  const rating = Math.round((stats.speed + stats.power + stats.control + stats.defense + stats.volley + stats.serve) / 6);

  return {
    id: cardInstanceId,
    name,
    rating,
    position,
    dominantHand: seed % 5 === 0 ? 'left' : 'right',
    preferredSide: position === 'right' || position === 'right2' ? 'right' : 'left',
    playstyle: playstyles[seed % playstyles.length],
    level: rating >= 86 ? 'Elite' : rating >= 76 ? 'Advanced' : 'Club',
    stats,
    cardVariant: cardVariantFromRating(rating, seed),
  };
}
