# Smesh Everybody

Padel match tracker for 1v1, 2v2, tournaments and Americano rounds. The app stores match history in Firestore, derives ELO rankings from completed matches and includes FUT-style player cards / lineup previews.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the **development** Firebase web app config. Local development should normally point at `smesh-everybody-dev`.

Required public Firebase variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=smesh-everybody-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX=
```

Use an empty `NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX` for the separate dev Firebase project. Do not commit `.env.local` or backup files.

## Useful commands

```bash
npm run dev
npm run build
npx tsc --noEmit
npm run lint
```

Firestore backup helpers:

```bash
npm run db:export -- --source=dev
npm run db:validate-backup -- --file=.firebase-backups/<file>.json
npm run db:import -- --file=.firebase-backups/<file>.json --target=dev
npm run db:import -- --file=.firebase-backups/<file>.json --target=dev --write
```

Production import is blocked unless explicitly allowed by the script. Prefer backing up production first and importing only into dev.

## Deployment

Dev CI/CD is configured in `.github/workflows/dev-vercel.yml`.

Every push to `main` runs:

1. `npm ci`
2. `npx tsc --noEmit`
3. `vercel pull --environment=production`
4. Vercel build
5. Vercel deploy

The linked Vercel project must contain the dev Firebase environment variables above. See `docs/dev-cicd.md` for the required GitHub secrets.
