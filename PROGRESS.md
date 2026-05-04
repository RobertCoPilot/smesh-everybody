# Progress Notes

## Session summary

### 0. 2026-05-04 new-machine Firebase backup + dev setup

Status: **Backup complete; separate dev Firebase project connected and imported**

What changed:
- Installed dependencies with `npm ci` on the new machine.
- Exported and validated a fresh production Firestore backup:
  - `.firebase-backups/firestore-production-2026-05-04T15-46-09-716Z.json`
  - Contains `10` players and `13` games.
- `gh` is not installed on this machine, so GitHub issues were read through the GitHub REST API.
- Added Firebase dev-project scaffolding/config:
  - `.env.example`
  - `.firebaserc` pointing at `smesh-everybody-dev`
  - `firebase.json`
  - `firestore.rules`
  - `firestore.indexes.json`
  - `storage.rules`
- Moved app Firebase config to required `NEXT_PUBLIC_FIREBASE_*` env variables; no production Firebase credentials remain hardcoded in `src/lib/firebase.ts`.
- Made Firestore collection names env-prefixable via `NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX`.
- Updated backup/import/seed scripts to load env via `@next/env` and refuse seed runs against production unless `ALLOW_PRODUCTION_SEED=true` is explicit.

Dev Firebase import completed:
```bash
npm run db:import -- --file=.firebase-backups/firestore-production-2026-05-04T15-46-09-716Z.json --target=dev
npm run db:import -- --file=.firebase-backups/firestore-production-2026-05-04T15-46-09-716Z.json --target=dev --write
```

Result:
- `players -> players`: 10 documents
- `games -> games`: 13 documents
- Confirmed with fresh dev export: `.firebase-backups/firestore-dev-2026-05-04T16-09-30-830Z.json`

---

### 1. Production Firestore safety

Status: **Partially complete / safe for current dev work**

What changed:
- Created a local JSON backup of the real production Firestore data:
  - `.firebase-backups/firestore-production-2026-05-02T19-15-32-696Z.json`
  - Contains `10` players and `13` games.
- Added `.firebase-backups/` to `.gitignore` so backups are not committed.
- Created dev Firestore collections inside the same Firebase project:
  - `dev_players`
  - `dev_games`
- Copied production data into those dev collections.
- Updated app reads/writes to use dev collections through:
  - `src/lib/firestoreCollections.ts`
- Production collection names are commented and preserved there:
  - `players`
  - `games`
- Updated seed scripts to write to dev collections instead of production collections.

Important caveat:
- This is **not yet a separate Firebase project**. It is isolated dev collections inside the same Firebase project.
- The safer final setup is still: create a separate Firebase project and move config into `.env.local`.

Issue ticket added:
- `docs/issues/002-isolate-firebase-production-from-development.md`

---

### 2. Firestore backup/import/export scripts

Status: **Complete for script-based backups**

Added:
- `scripts/firestore-backup-utils.mjs`
- `scripts/export-firestore.mjs`
- `scripts/import-firestore.mjs`
- `scripts/validate-firestore-backup.mjs`

Added package scripts:
- `npm run db:export -- --source=dev`
- `npm run db:export -- --source=production`
- `npm run db:validate-backup -- --file=.firebase-backups/FILE.json`
- `npm run db:import -- --file=.firebase-backups/FILE.json --target=dev`

Safety behavior:
- Imports are dry-run by default.
- Real import requires `--write`.
- Production import is blocked unless `--allow-production` is explicitly passed.
- Imports preserve original Firestore document IDs, so re-importing the same backup is idempotent and does not create duplicate documents.
- Validation checks:
  - Duplicate document IDs
  - Duplicate normalized player names
  - Duplicate document content hashes

Tested successfully:
- Existing production backup validation passed.
- Dev import dry-run passed.
- Dev export worked and produced:
  - `.firebase-backups/firestore-dev-2026-05-02T19-36-31-057Z.json`

Recommended usage:
```bash
npm run db:export -- --source=dev
npm run db:validate-backup -- --file=.firebase-backups/<backup-file>.json
npm run db:import -- --file=.firebase-backups/<backup-file>.json --target=dev
npm run db:import -- --file=.firebase-backups/<backup-file>.json --target=dev --write
```

Avoid production import unless absolutely necessary:
```bash
npm run db:import -- --file=.firebase-backups/<backup-file>.json --target=production --allow-production --write
```

---

### 3. ELO Phase 1 + Phase 2

Status: **Implemented, non-destructive; Phase 1 tier/card follow-up added 2026-05-04**

What changed:
- Added ELO types to `src/types/index.ts`.
- Added ELO logic in `src/lib/elo.ts`.
- Added optional match tracking support in types.
- Added an `ELO` tab to `src/app/rankings/page.tsx`.
- Added chronological ELO replay procedure.
- Added per-match ELO summaries via `calculateEloMatchSummaries`.
- Added ELO delta display in `src/app/history/page.tsx` for completed `1vs1` and `2vs2` matches.
- Added centralized ELO tier definitions in `src/lib/eloTiers.ts`.
- Updated FUT-style padel cards to use Bronze/Silver/Gold/Elite/Icon tier colors from the shared helper.
- Updated card generation to derive OVR/card tier from ELO instead of random-only card variants.
- Wired match completion through `finalizeMatchTracking` in `src/store/gameStore.ts` so newly completed `1vs1`/`2vs2` matches persist immutable `matchTracking` metadata with teams, score, MVP, ELO deltas and chemistry deltas.
- ELO deltas for new matches are calculated from historical replay before the current match, so the old match history remains the source of truth and is not rewritten.
- New players now receive default ELO fields (`currentElo`, `peakElo`, `allTimeBestElo`, `eloTier`) without migrating existing players.
- History now prefers persisted match ELO deltas when available and falls back to live replay for older games.
- `PadelBuilder` now exposes an `onLineupChange` export callback, supports tap assignment and drag/drop from the player pool onto slots, and 1vs1/2vs2 setup previews use real ELO-tiered player cards.
- Store players are enriched in-memory with replayed ELO after Firestore snapshots load, so existing player documents are not migrated but rankings/cards can immediately reflect current historical ELO.
- Players page now renders compact FUT-style cards from shared ELO tier styling.

Important:
- Existing match history is **not rewritten**.
- ELO is calculated live from completed historical matches.
- No migration wrote ELO fields into existing Firestore documents.
- Existing imported historical games are still untouched; persisted `matchTracking` is added only when a match is newly completed/updated through the app.

---

### 4. Theme/CSS cleanup

Status: **In progress / first pass complete**

What changed:
- Added reusable semantic CSS component classes in `src/styles/components.css` for page shells, section/card text, stats labels, choice buttons, dark panels, builder pool, court footer/score controls and court HUD overlays.
- Added electric-theme overrides for the new semantic classes in `src/styles/themes.css`.
- Replaced several hardcoded white-on-light text patterns on Home, New Game, builder, court cards, history modal and tournament scoring buttons.
- Removed layout-level hardcoded clay background/text classes so theme variables own the page background/text.

Important:
- Some highly specific gameplay buttons/toasts still use inline Tailwind/gradients intentionally.
- Existing tournament pages still have pre-existing React Compiler lint noise unrelated to this CSS pass.

---

## Validation run

Passed:
```bash
npx tsc --noEmit
```

Passed backup validation:
```bash
npm run db:validate-backup -- --file=.firebase-backups/firestore-production-2026-05-04T15-46-09-716Z.json
npm run db:validate-backup -- --file=.firebase-backups/firestore-dev-2026-05-04T16-09-30-830Z.json
```

Passed production build:
```bash
npm run build
```

Passed CSS/theme targeted validation:
```bash
npx eslint src/app/page.tsx src/app/new-game/page.tsx src/app/layout.tsx src/components/CourtCard.tsx src/components/padel-builder/PadelBuilder.tsx src/components/padel-builder/PadelCourt.tsx src/components/padel-builder/FormationSelector.tsx src/app/history/page.tsx src/app/game/1vs1/setup/page.tsx src/app/game/2vs2/setup/page.tsx
```

Smoke-tested existing dev server on port 3000:
- `/`
- `/new-game`
- `/players`
- `/rankings`
- `/history`
- `/game/1vs1/setup`
- `/game/2vs2/setup`

Passed targeted Phase 1 validation:
```bash
npx tsc --noEmit
npx eslint src/store/gameStore.ts src/lib/elo.ts src/lib/matchTracking.ts src/app/history/page.tsx src/app/players/page.tsx src/components/padel-builder/PadelBuilder.tsx src/components/padel-builder/PadelCourt.tsx src/components/padel-builder/PadelSlot.tsx src/app/game/1vs1/setup/page.tsx src/app/game/2vs2/setup/page.tsx
```

Passed targeted ESLint for touched/new files that do not include pre-existing page-level React Compiler lint noise:
```bash
npx eslint scripts/firestore-backup-utils.mjs scripts/firebase-script-env.mjs scripts/export-firestore.mjs scripts/import-firestore.mjs scripts/validate-firestore-backup.mjs scripts/seed-game1.mjs scripts/seed-game2.mjs scripts/seed-game3.mjs src/lib/elo.ts src/lib/eloTiers.ts src/lib/firebase.ts src/lib/firestoreCollections.ts src/components/padel-builder/types.ts src/components/padel-builder/playerFactory.ts src/components/padel-builder/PadelPlayerCard.tsx src/app/rankings/page.tsx
```

Full lint still fails because of pre-existing unrelated lint errors in:
- `.pi/extensions/**`
- existing game pages under `src/app/game/**`
- some existing hydration/setState-in-effect and React Compiler manual memoization patterns

`bun` is not installed in this environment, so commands were run with `npm`/`npx`.

---

## Best way to resume next session

1. Start by checking the current diff:
```bash
git status --short
git diff --stat
```

2. Re-run quick validation:
```bash
npx tsc --noEmit
npx eslint scripts/firestore-backup-utils.mjs scripts/export-firestore.mjs scripts/import-firestore.mjs scripts/validate-firestore-backup.mjs src/lib/elo.ts src/lib/matchTracking.ts src/types/index.ts src/app/rankings/page.tsx src/app/history/page.tsx
```

3. Manually test in the app:
```bash
npm run dev
```
Then check:
- Rankings page → ELO tab
- History page → completed `1vs1` / `2vs2` ELO delta lines
- Add/delete/update dev data and confirm it affects only `dev_players` / `dev_games`

4. Next recommended tasks:
- Create an actual separate Firebase dev project.
- Move Firebase config from hardcoded values to `.env.local` / environment variables.
- Add `.env.example` with placeholder Firebase keys.
- Add seed-script hard guards so they refuse production without explicit override.
- Optionally add a script to copy production backup into the separate dev Firebase project.
- Decide whether ELO should remain live-calculated only or eventually be persisted as a migration.

5. Before merging:
- Review all changed files carefully.
- Ensure no backup JSON files are staged.
- Ensure `.firebase-backups/` remains ignored.
- If possible, fix or exclude unrelated `.pi/extensions` lint noise so full lint becomes meaningful.
