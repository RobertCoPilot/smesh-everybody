import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Production Firebase project config. Kept for reference only; do not delete.
// This fork/local development must not point directly at the production data.
// const productionFirebaseConfig = {
//   apiKey: "AIzaSyAWmLZys9lbH5IYOTjZFHbyt0NTdpjKfHA",
//   authDomain: "smesh-everybody.firebaseapp.com",
//   projectId: "smesh-everybody",
//   storageBucket: "smesh-everybody.firebasestorage.app",
//   messagingSenderId: "767791181149",
//   appId: "1:767791181149:web:9834d6ad1263162b824cb4",
// };

// Development Firebase config. Currently uses isolated dev_* collections that were
// copied from production, so app changes cannot touch the production collections.
const firebaseConfig = {
  apiKey: "AIzaSyAWmLZys9lbH5IYOTjZFHbyt0NTdpjKfHA",
  authDomain: "smesh-everybody.firebaseapp.com",
  projectId: "smesh-everybody",
  storageBucket: "smesh-everybody.firebasestorage.app",
  messagingSenderId: "767791181149",
  appId: "1:767791181149:web:9834d6ad1263162b824cb4",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
