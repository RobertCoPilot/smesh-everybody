import type { PadelPosition } from '@/config/padelFormations';

export type PadelCardVariant = 'gold' | 'silver' | 'bronze' | 'special';

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
}

export type PlacedPadelPlayers = Partial<Record<PadelPosition, PadelPlayer>>;
