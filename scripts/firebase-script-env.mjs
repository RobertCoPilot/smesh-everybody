import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

export function requireFirebaseConfig({ allowProduction = false } = {}) {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing Firebase env values: ${missing.join(', ')}. Copy .env.example to .env.local and fill dev project credentials.`);
  }

  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'smesh-everybody' && !allowProduction) {
    throw new Error('Refusing to run seed script against production project smesh-everybody. Set ALLOW_PRODUCTION_SEED=true only if you really intend this.');
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function prefixedCollection(name) {
  return `${process.env.FIRESTORE_DEV_COLLECTION_PREFIX || process.env.NEXT_PUBLIC_FIRESTORE_COLLECTION_PREFIX || ''}${name}`;
}
