# Issue: Isolate Firebase production data from fork/local development

## Problem

Running the forked repository locally can read from and write to the real production Firebase project because Firebase config is hardcoded in `src/lib/firebase.ts` and in the seed scripts under `scripts/`.

Code changes are local, but data changes are not: adding players, deleting matches, scoring games, or running seed scripts can mutate the live production Firestore collections.

## Current risk

- The fork points at `smesh-everybody.firebaseapp.com`.
- Firestore collections such as `players` and `games` are production data.
- Local testing can immediately impact production users.

## Desired fix

1. Create a separate Firebase development project, for example `smesh-everybody-dev`.
2. Move Firebase config out of source code and into environment variables:

```ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
```

3. Add a local `.env.local` with development Firebase keys.
4. Keep `.env.local` ignored by git.
5. Update seed scripts so they refuse to run against production unless an explicit production override is provided.
6. Document backup/restore steps for Firestore before any migration.

## Acceptance criteria

- Local development uses dev Firebase credentials by default.
- Production config is not hardcoded in app code or seed scripts.
- Seed scripts cannot accidentally write to production.
- Existing production data remains untouched.
- A backup exists before any data migration or collection rename.
