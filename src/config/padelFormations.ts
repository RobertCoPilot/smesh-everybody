export type FormationId = '2-2' | '1-1' | '2-1' | '1-2';

export type PadelPosition = 'left' | 'right' | 'left2' | 'right2';

export type PadelSlotAnchor =
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'top-left'
  | 'top-right'
  | 'top-center';

export interface PadelFormationConfig {
  id: FormationId;
  label: string;
  activeSlots: PadelPosition[];
  slotAnchors: Record<PadelPosition, PadelSlotAnchor | null>;
}

export const PADEL_FORMATIONS: Record<FormationId, PadelFormationConfig> = {
  '2-2': {
    id: '2-2',
    label: '2-2',
    activeSlots: ['left', 'right', 'left2', 'right2'],
    slotAnchors: {
      left: 'bottom-left',
      right: 'bottom-right',
      left2: 'top-left',
      right2: 'top-right',
    },
  },
  '1-1': {
    id: '1-1',
    label: '1-1',
    activeSlots: ['left', 'right2'],
    slotAnchors: {
      left: 'bottom-center',
      right: null,
      left2: null,
      right2: 'top-center',
    },
  },
  '2-1': {
    id: '2-1',
    label: '2-1',
    activeSlots: ['left', 'right', 'right2'],
    slotAnchors: {
      left: 'bottom-left',
      right: 'bottom-right',
      left2: null,
      right2: 'top-center',
    },
  },
  '1-2': {
    id: '1-2',
    label: '1-2',
    activeSlots: ['left', 'left2', 'right2'],
    slotAnchors: {
      left: 'bottom-center',
      right: null,
      left2: 'top-left',
      right2: 'top-right',
    },
  },
};

export const FORMATION_IDS = Object.keys(PADEL_FORMATIONS) as FormationId[];
