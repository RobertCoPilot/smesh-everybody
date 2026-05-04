import type { PadelPosition } from '@/config/padelFormations';
import type { EloTier } from '@/types';

export type PadelCardVariant = EloTier;

export interface PadelStats {
  speed: number;
  power: number;
  control: number;
  defense: number;
  volley: number;
  serve: number;
}

export interface PadelPlayer {
  id: string;
  name: string;
  rating: number;
  position: PadelPosition;
  imageUrl?: string;
  dominantHand?: 'left' | 'right';
  preferredSide?: 'left' | 'right' | 'both';
  playstyle?: string;
  level?: string;
  stats: PadelStats;
  cardVariant?: PadelCardVariant;
  eloTier?: EloTier;
  currentElo?: number;
}

export type PlacedPadelPlayers = Partial<Record<PadelPosition, PadelPlayer>>;
