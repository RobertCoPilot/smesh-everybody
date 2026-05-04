import type { PadelPosition } from '@/config/padelFormations';
import { DEFAULT_ELO } from '@/lib/elo';
import { getEloTierDefinition } from '@/lib/eloTiers';
import type { PadelPlayer, PadelStats } from './types';

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

function ratingFromElo(elo: number): number {
  return Math.max(55, Math.min(99, Math.round(55 + ((elo - 700) / 1000) * 44)));
}

export function createPadelPlayer(playerId: string, name: string, position: PadelPosition, cardInstanceId = playerId, currentElo = DEFAULT_ELO): PadelPlayer {
  const seed = hashString(`${playerId}-${name}`);
  const stats: PadelStats = {
    speed: statFromSeed(seed, 1),
    power: statFromSeed(seed, 3),
    control: statFromSeed(seed, 5),
    defense: statFromSeed(seed, 7),
    volley: statFromSeed(seed, 9),
    serve: statFromSeed(seed, 11),
  };
  const tier = getEloTierDefinition(currentElo);
  const rating = ratingFromElo(currentElo);

  return {
    id: cardInstanceId,
    name,
    rating,
    position,
    dominantHand: seed % 5 === 0 ? 'left' : 'right',
    preferredSide: position === 'right' || position === 'right2' ? 'right' : 'left',
    playstyle: playstyles[seed % playstyles.length],
    level: tier.label,
    stats,
    currentElo,
    eloTier: tier.id,
    cardVariant: tier.cardVariant,
  };
}
