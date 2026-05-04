import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Create .env.local from .env.example and point it at a development Firebase project.`);
  }
  return value;
}

// Keep these as direct process.env.NEXT_PUBLIC_* reads. Next.js only inlines
// direct public env references in client bundles; dynamic process.env[name]
// lookups are intentionally not supported in browser code.
const firebaseConfig: FirebaseOptions = {
  apiKey: requirePublicEnv('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: requirePublicEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: requirePublicEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: requirePublicEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requirePublicEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: requirePublicEnv('NEXT_PUBLIC_FIREBASE_APP_ID', process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
