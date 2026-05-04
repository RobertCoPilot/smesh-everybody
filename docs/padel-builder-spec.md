# Padel FUT Builder Specification

This feature recreates the FIFA/FUT builder feeling as a padel team builder instead of a soccer squad builder. The match detail screen becomes a padel court lineup editor where users place player cards onto valid padel formations.

## Formations

Supported formations:

- `2-2`
- `1-1`
- `2-1`
- `1-2`

Allowed internal positions:

- `left`
- `right`
- `left2`
- `right2`

Formation slot rules:

- `2-2`: `left`, `right`, `left2`, `right2`
- `1-1`: `left`, `right2`
- `2-1`: `left`, `right`, `right2`
- `1-2`: `left`, `left2`, `right2`

Fixed court meanings:

- `left` = Team 1 bottom-left
- `right` = Team 1 bottom-right
- `left2` = Team 2 top-left
- `right2` = Team 2 top-right

For one-player rows, the rendered card should be centered while keeping the internal slot name unchanged.

Examples:

```txt
2-2

Opponent / Team 2 side
[left2]       [right2]

──────── net ────────

Team 1 side
[left]        [right]
```

```txt
1-1

[right2 or opponent]

──────── net ────────

[left or user]
```

## Visual Direction

The football pitch becomes a padel court:

- Dark blue court background
- White court boundary lines
- Net line in the center
- Subtle glass/cage feeling around the court
- Cards floating above court positions
- Selected card has red corner brackets
- Formation label in the bottom-left

The layout supports 2 to 4 cards depending on formation.

## Card Design

Cards should stay close to the FUT style:

- Gold/silver/special card shell
- Large OVR rating
- Player name
- Main side/position
- Portrait/avatar
- Stats grid
- Badges/icons
- Chemistry/connection indicator

Padel-specific labels:

- OVR rating
- Side: L / R
- Playstyle
- Handedness
- Level
- Stats:
  - `SPD` = Speed
  - `PWR` = Power
  - `CTL` = Control
  - `DEF` = Defense
  - `VOL` = Volley
  - `SVA` = Serve

## Interaction Plan

First version:

- Click empty slot to select slot
- Click player from list to assign to selected slot
- Click placed card to select/edit
- Click remove to clear slot
- Formation switch removes invalid slots

Later version:

- Drag player card into slot
- Card hover preview
- Chemistry lines
- Player comparison drawer
- Save/share lineup

## Data Model

```ts
type FormationId = '2-2' | '1-1' | '2-1' | '1-2'

type PadelPosition = 'left' | 'right' | 'left2' | 'right2'

type PadelPlayer = {
  id: string
  name: string
  rating: number
  position: PadelPosition
  imageUrl: string
  dominantHand?: 'left' | 'right'
  preferredSide?: 'left' | 'right' | 'both'
  playstyle?: string
  stats: {
    speed: number
    power: number
    control: number
    defense: number
    volley: number
    serve: number
  }
  cardVariant?: 'gold' | 'silver' | 'bronze' | 'special'
}
```

## Implementation Order

1. Build static `PadelCourt` with court lines and `2-2` card positions
2. Build `PadelPlayerCard` as standalone component
3. Add formation config and dynamic slot rendering
4. Add selected slot visuals
5. Add player assignment data model
6. Add `FormationSelector`
7. Add responsive scaling
8. Add optional chemistry lines
