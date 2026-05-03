# Progress Notes

## Session summary

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

Status: **Implemented, non-destructive**

What changed:
- Added ELO types to `src/types/index.ts`.
- Added ELO logic in `src/lib/elo.ts`.
- Added optional match tracking support in types.
- Added an `ELO` tab to `src/app/rankings/page.tsx`.
- Added chronological ELO replay procedure.
- Added per-match ELO summaries via `calculateEloMatchSummaries`.
- Added ELO delta display in `src/app/history/page.tsx` for completed `1vs1` and `2vs2` matches.

Important:
- Existing match history is **not rewritten**.
- ELO is calculated live from completed historical matches.
- No migration wrote ELO fields into Firestore documents.

---

## Validation run

Passed:
```bash
npx tsc --noEmit
```

Passed targeted ESLint for touched files:
```bash
npx eslint scripts/firestore-backup-utils.mjs scripts/export-firestore.mjs scripts/import-firestore.mjs scripts/validate-firestore-backup.mjs src/lib/elo.ts src/lib/matchTracking.ts src/types/index.ts src/app/rankings/page.tsx src/app/history/page.tsx
```

Full lint still fails because of pre-existing unrelated lint errors in:
- `.pi/extensions/**`
- existing game pages under `src/app/game/**`
- some existing hydration/setState-in-effect patterns

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
