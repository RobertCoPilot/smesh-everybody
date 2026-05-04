// Seed script: Add historical Americano Klein game from March 28th
// Run with: node scripts/seed-game1.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { prefixedCollection, requireFirebaseConfig } from './firebase-script-env.mjs';

const app = initializeApp(requireFirebaseConfig({ allowProduction: process.env.ALLOW_PRODUCTION_SEED === 'true' }));
const db = getFirestore(app);

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Players
const PLAYERS = {
  Maxim:   { id: genId(), name: 'Maxim',   createdAt: '2025-03-28T10:00:00.000Z' },
  Robert:  { id: genId(), name: 'Robert',  createdAt: '2025-03-28T10:00:00.000Z' },
  Stephan: { id: genId(), name: 'Stephan', createdAt: '2025-03-28T10:00:00.000Z' },
  Taulant: { id: genId(), name: 'Taulant', createdAt: '2025-03-28T10:00:00.000Z' },
  Joey:    { id: genId(), name: 'Joey',    createdAt: '2025-03-28T10:00:00.000Z' },
  Eddy:    { id: genId(), name: 'Eddy',    createdAt: '2025-03-28T10:00:00.000Z' },
};

const p = (name) => PLAYERS[name].id;

// 7 games from the Americano Klein
const games = [
  { // Game 1: Stephan & Taulant vs Eddy & Joey → 6:10
    id: genId(), round: 0, court: 0,
    team1: [p('Stephan'), p('Taulant')],
    team2: [p('Eddy'), p('Joey')],
    team1Score: 6, team2Score: 10, status: 'completed',
  },
  { // Game 2: Maxim & Robert vs Joey & Taulant → 10:8
    id: genId(), round: 0, court: 1,
    team1: [p('Maxim'), p('Robert')],
    team2: [p('Joey'), p('Taulant')],
    team1Score: 10, team2Score: 8, status: 'completed',
  },
  { // Game 3: Maxim & Taulant vs Eddy & Stephan → 5:10
    id: genId(), round: 1, court: 0,
    team1: [p('Maxim'), p('Taulant')],
    team2: [p('Eddy'), p('Stephan')],
    team1Score: 5, team2Score: 10, status: 'completed',
  },
  { // Game 4: Joey & Robert vs Stephan & Maxim → 5:10
    id: genId(), round: 1, court: 1,
    team1: [p('Joey'), p('Robert')],
    team2: [p('Stephan'), p('Maxim')],
    team1Score: 5, team2Score: 10, status: 'completed',
  },
  { // Game 5: Stephan & Robert vs Eddy & Taulant → 4:10
    id: genId(), round: 2, court: 0,
    team1: [p('Stephan'), p('Robert')],
    team2: [p('Eddy'), p('Taulant')],
    team1Score: 4, team2Score: 10, status: 'completed',
  },
  { // Game 6: Joey & Maxim vs Robert & Taulant → 10:6
    id: genId(), round: 2, court: 1,
    team1: [p('Joey'), p('Maxim')],
    team2: [p('Robert'), p('Taulant')],
    team1Score: 10, team2Score: 6, status: 'completed',
  },
  { // Game 7: Robert & Eddy vs Stephan & Joey → 10:2
    id: genId(), round: 3, court: 0,
    team1: [p('Robert'), p('Eddy')],
    team2: [p('Stephan'), p('Joey')],
    team1Score: 10, team2Score: 2, status: 'completed',
  },
];

const tournament = {
  id: genId(),
  type: 'americano-klein',
  date: '2025-03-28T14:00:00.000Z',
  players: Object.values(PLAYERS).map((pl) => pl.id),
  games,
  pointsToWin: 10,
  courts: 2,
  currentRound: 4,
  status: 'completed',
};

async function seed() {
  console.log('Seeding players...');
  for (const player of Object.values(PLAYERS)) {
    await setDoc(doc(db, prefixedCollection('players'), player.id), player);
    console.log(`  ✓ ${player.name} (${player.id})`);
  }

  console.log('\nSeeding Americano Klein tournament (March 28)...');
  await setDoc(doc(db, prefixedCollection('games'), tournament.id), tournament);
  console.log(`  ✓ Tournament ${tournament.id} with ${games.length} games`);

  // Print leaderboard
  console.log('\n--- Americano Leaderboard ---');
  const scores = {};
  for (const pl of Object.values(PLAYERS)) scores[pl.name] = 0;
  for (const game of games) {
    for (const pid of game.team1) {
      const name = Object.values(PLAYERS).find((pl) => pl.id === pid)?.name;
      if (name) scores[name] += game.team1Score;
    }
    for (const pid of game.team2) {
      const name = Object.values(PLAYERS).find((pl) => pl.id === pid)?.name;
      if (name) scores[name] += game.team2Score;
    }
  }
  Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, pts], i) => console.log(`  ${i + 1}. ${name}: ${pts} Punkte`));

  console.log('\n✅ Done! Data is now in Firestore.');
  process.exit(0);
}

seed().catch((err) => { console.error('Error:', err); process.exit(1); });
