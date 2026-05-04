import type { EloTier } from '@/types';

export interface EloTierDefinition {
  id: EloTier;
  label: string;
  minElo: number;
  cardVariant: EloTier;
  cardClassName: string;
  borderClassName: string;
}

export const ELO_TIERS: readonly EloTierDefinition[] = [
  {
    id: 'icon',
    label: 'Icon',
    minElo: 1600,
    cardVariant: 'icon',
    cardClassName: 'from-[#fff8d6] via-[#f5c85b] to-[#7f5b16] text-[#241705]',
    borderClassName: 'border-[#f5c85b]/70 shadow-[0_0_22px_rgba(245,200,91,0.42)]',
  },
  {
    id: 'elite',
    label: 'Elite',
    minElo: 1300,
    cardVariant: 'elite',
    cardClassName: 'from-[#201337] via-[#073a68] to-[#00d1ff] text-white',
    borderClassName: 'border-[#00d1ff]/70 shadow-[0_0_20px_rgba(0,209,255,0.35)]',
  },
  {
    id: 'gold',
    label: 'Gold',
    minElo: 1100,
    cardVariant: 'gold',
    cardClassName: 'from-[#f8dd84] via-[#c99a35] to-[#7a5218] text-[#241705]',
    borderClassName: 'border-[#c99a35]/65',
  },
  {
    id: 'silver',
    label: 'Silver',
    minElo: 900,
    cardVariant: 'silver',
    cardClassName: 'from-[#f4f7f8] via-[#aeb8c2] to-[#65707a] text-[#101820]',
    borderClassName: 'border-[#aeb8c2]/65',
  },
  {
    id: 'bronze',
    label: 'Bronze',
    minElo: Number.NEGATIVE_INFINITY,
    cardVariant: 'bronze',
    cardClassName: 'from-[#d9a06a] via-[#a76132] to-[#5a2f16] text-[#211006]',
    borderClassName: 'border-[#a76132]/65',
  },
] as const;

export function getEloTierDefinition(elo: number): EloTierDefinition {
  return ELO_TIERS.find((tier) => elo >= tier.minElo) ?? ELO_TIERS[ELO_TIERS.length - 1];
}

export function getEloTier(elo: number): EloTier {
  return getEloTierDefinition(elo).id;
}

export function getTierLabel(tier: EloTier): string {
  return ELO_TIERS.find((definition) => definition.id === tier)?.label ?? tier;
}

export function getTierCardClassName(tier: EloTier): string {
  return ELO_TIERS.find((definition) => definition.id === tier)?.cardClassName ?? ELO_TIERS[ELO_TIERS.length - 1].cardClassName;
}

export function getTierBorderClassName(tier: EloTier): string {
  return ELO_TIERS.find((definition) => definition.id === tier)?.borderClassName ?? ELO_TIERS[ELO_TIERS.length - 1].borderClassName;
}
