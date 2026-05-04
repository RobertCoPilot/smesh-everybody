# Dev CI/CD

This repository deploys the fork/dev app from `main` through GitHub Actions using `.github/workflows/dev-vercel.yml`.

## Required GitHub secrets

Add these secrets in GitHub repository settings:

- `VERCEL_TOKEN` - Vercel access token.
- `VERCEL_ORG_ID` - Vercel team/user ID for the dev project.
- `VERCEL_PROJECT_ID` - Vercel project ID for the dev deployment target.

The workflow expects the Vercel project itself to contain the dev Firebase environment variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX` empty for the separate dev Firebase project

## Behavior

On every push to `main`, the workflow:

1. Installs dependencies with `npm ci`.
2. Runs `npx tsc --noEmit`.
3. Pulls the linked Vercel dev project settings.
4. Builds with `vercel build --prod`.
5. Deploys the prebuilt output to the dev Vercel project.

This should point at the dev Firebase project (`smesh-everybody-dev`) and must not use production Firebase credentials.
