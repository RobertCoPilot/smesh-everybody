# Current Technical Implementation Notes

## Stack

- Framework: Next.js App Router (`src/app`)
- Language: TypeScript with strict mode
- UI: React client components where Zustand/browser state is used
- Styling: Tailwind CSS 4 utility classes plus project globals in `src/app/globals.css`
- State: Zustand store in `src/store/gameStore.ts`
- Data sync: Firebase/Firestore subscription in `src/components/FirestoreProvider.tsx`
- Package scripts currently available in `package.json`:
  - `npm run dev`
  - `npm run build`
  - `npm run start`
  - `npm run lint`

## Project Structure Relevant to This Feature

```txt
src/
  app/
    history/page.tsx              # History list; cards link to game detail routes
    game/
      1vs1/[id]/page.tsx          # 1v1 match detail/scoring screen
      2vs2/[id]/page.tsx          # 2v2 match detail/scoring screen
      tournament/[id]/page.tsx    # Tournament detail screen
      americano-*/[id]/page.tsx   # Americano tournament detail screens
  components/
    BottomNav.tsx                 # Fixed bottom app navigation
    CourtCard.tsx                 # Existing court visual component
    padel-builder/                # FUT-style padel lineup editor components
  config/
    padelFormations.ts            # Centralized formation/slot layout config
  store/
    gameStore.ts                  # Players, games, mutations, derived ranking helpers
  types/
    index.ts                      # Core game/player TypeScript interfaces
```

## Existing Data Flow

1. `FirestoreProvider` subscribes to `players` and `games` collections.
2. Data is pushed into the Zustand store with `_setPlayers` and `_setGames`.
3. Pages read game data with `useGameStore` helpers such as `getGame`, `getPlayer`, and `updateGame`.
4. History cards route to game detail pages like `/game/1vs1/[id]` and `/game/2vs2/[id]`.

## Padel Builder Implementation Direction

- Build this feature in React/TypeScript, not Vue, to match the current Next.js environment.
- Keep formation definitions centralized in `src/config/padelFormations.ts`.
- Keep reusable lineup UI in `src/components/padel-builder/`.
- Initial placement is derived from the opened game:
  - `1vs1` opens as `1-1` with `left` and `right2` populated.
  - `2vs2` opens as `2-2` with Team 1 on `left`/`right` and Team 2 on `left2`/`right2`.
- First version uses local UI state for lineup edits. It does not persist changed card placements back to Firestore.
- The existing scoring controls remain below the new lineup editor.

## Quality/Verification

- Use `npm run build` for type/build verification in this repo because `bun` is not available in the current environment.
- `npm run lint` currently reports pre-existing issues outside this feature. For touched files, use targeted ESLint commands as a fallback.
