// Seed script: Add 2nd Americano Klein from March 28th (reuse existing players)
// Run with: node scripts/seed-game2.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { prefixedCollection, requireFirebaseConfig } from './firebase-script-env.mjs';

const app = initializeApp(requireFirebaseConfig({ allowProduction: process.env.ALLOW_PRODUCTION_SEED === 'true' }));
const db = getFirestore(app);

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seed() {
  // Fetch existing players
  const snap = await getDocs(collection(db, prefixedCollection('players')));
  const existing = {};
  snap.docs.forEach((d) => { const p = d.data(); existing[p.name] = p.id; });
  console.log('Existing players:', Object.keys(existing).join(', '));

  const p = (name) => existing[name];

  const games = [
    { // Game 1: Maxim & Taulant vs Eddy & Stephan → 6:10
      id: genId(), round: 0, court: 0,
      team1: [p('Maxim'), p('Taulant')],
      team2: [p('Eddy'), p('Stephan')],
      team1Score: 6, team2Score: 10, status: 'completed',
    },
    { // Game 2: Joey & Robert vs Stephan & Maxim → 10:6
      id: genId(), round: 0, court: 1,
      team1: [p('Joey'), p('Robert')],
      team2: [p('Stephan'), p('Maxim')],
      team1Score: 10, team2Score: 6, status: 'completed',
    },
    { // Game 3: Joey & Maxim vs Eddy & Taulant → 10:7
      id: genId(), round: 1, court: 0,
      team1: [p('Joey'), p('Maxim')],
      team2: [p('Eddy'), p('Taulant')],
      team1Score: 10, team2Score: 7, status: 'completed',
    },
    { // Game 4: Stephan & Robert vs Joey & Taulant → 10:8
      id: genId(), round: 1, court: 1,
      team1: [p('Stephan'), p('Robert')],
      team2: [p('Joey'), p('Taulant')],
      team1Score: 10, team2Score: 8, status: 'completed',
    },
    { // Game 5: Robert & Taulant vs Eddy & Maxim → 4:10
      id: genId(), round: 2, court: 0,
      team1: [p('Robert'), p('Taulant')],
      team2: [p('Eddy'), p('Maxim')],
      team1Score: 4, team2Score: 10, status: 'completed',
    },
    { // Game 6: Stephan & Joey vs Maxim & Robert → 10:8
      id: genId(), round: 2, court: 1,
      team1: [p('Stephan'), p('Joey')],
      team2: [p('Maxim'), p('Robert')],
      team1Score: 10, team2Score: 8, status: 'completed',
    },
    { // Game 7: Eddy & Robert vs Stephan & Taulant → 10:4
      id: genId(), round: 3, court: 0,
      team1: [p('Eddy'), p('Robert')],
      team2: [p('Stephan'), p('Taulant')],
      team1Score: 10, team2Score: 4, status: 'completed',
    },
  ];

  const tournament = {
    id: genId(),
    type: 'americano-klein',
    date: '2025-03-28T16:00:00.000Z',
    players: [p('Maxim'), p('Robert'), p('Stephan'), p('Taulant'), p('Joey'), p('Eddy')],
    games,
    pointsToWin: 10,
    courts: 2,
    currentRound: 4,
    status: 'completed',
  };

  console.log('\nSeeding 2nd Americano Klein (March 28)...');
  await setDoc(doc(db, prefixedCollection('games'), tournament.id), tournament);
  console.log(`  ✓ Tournament ${tournament.id} with ${games.length} games`);

  // Print leaderboard
  console.log('\n--- Americano Leaderboard (Game 2) ---');
  const scores = {};
  for (const name of ['Maxim', 'Robert', 'Stephan', 'Taulant', 'Joey', 'Eddy']) scores[name] = 0;
  for (const game of games) {
    for (const pid of game.team1) {
      const name = Object.entries(existing).find(([, id]) => id === pid)?.[0];
      if (name) scores[name] += game.team1Score;
    }
    for (const pid of game.team2) {
      const name = Object.entries(existing).find(([, id]) => id === pid)?.[0];
      if (name) scores[name] += game.team2Score;
    }
  }
  Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, pts], i) => console.log(`  ${i + 1}. ${name}: ${pts} Punkte`));

  console.log('\n✅ Done!');
  process.exit(0);
}

seed().catch((err) => { console.error('Error:', err); process.exit(1); });
