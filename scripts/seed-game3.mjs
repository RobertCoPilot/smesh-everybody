// Seed script: Add Americano Groß from April 3rd (reuse existing players, add Sergej)
// Run with: node scripts/seed-game3.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAWmLZys9lbH5IYOTjZFHbyt0NTdpjKfHA",
  authDomain: "smesh-everybody.firebaseapp.com",
  projectId: "smesh-everybody",
  storageBucket: "smesh-everybody.firebasestorage.app",
  messagingSenderId: "767791181149",
  appId: "1:767791181149:web:9834d6ad1263162b824cb4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seed() {
  // Fetch existing players
  const snap = await getDocs(collection(db, 'dev_players'));
  const existing = {};
  snap.docs.forEach((d) => { const p = d.data(); existing[p.name] = p.id; });
  console.log('Existing players:', Object.keys(existing).join(', '));

  // Add Sergej if not exists
  if (!existing['Sergej']) {
    const sergej = { id: genId(), name: 'Sergej', createdAt: '2025-04-03T10:00:00.000Z' };
    await setDoc(doc(db, 'dev_players', sergej.id), sergej);
    existing['Sergej'] = sergej.id;
    console.log(`  + Added new player: Sergej (${sergej.id})`);
  }

  const p = (name) => existing[name];

  const games = [
    { id: genId(), round: 0, court: 0,
      team1: [p('Joey'), p('Sergej')], team2: [p('Eddy'), p('Stephan')],
      team1Score: 4, team2Score: 10, status: 'completed' },
    { id: genId(), round: 0, court: 1,
      team1: [p('Maxim'), p('Robert')], team2: [p('Stephan'), p('Joey')],
      team1Score: 8, team2Score: 10, status: 'completed' },
    { id: genId(), round: 1, court: 0,
      team1: [p('Joey'), p('Robert')], team2: [p('Eddy'), p('Sergej')],
      team1Score: 7, team2Score: 10, status: 'completed' },
    { id: genId(), round: 1, court: 1,
      team1: [p('Stephan'), p('Maxim')], team2: [p('Robert'), p('Sergej')],
      team1Score: 10, team2Score: 8, status: 'completed' },
    { id: genId(), round: 2, court: 0,
      team1: [p('Maxim'), p('Sergej')], team2: [p('Eddy'), p('Joey')],
      team1Score: 1, team2Score: 10, status: 'completed' },
    { id: genId(), round: 2, court: 1,
      team1: [p('Stephan'), p('Robert')], team2: [p('Joey'), p('Maxim')],
      team1Score: 8, team2Score: 10, status: 'completed' },
    { id: genId(), round: 3, court: 0,
      team1: [p('Eddy'), p('Maxim')], team2: [p('Stephan'), p('Sergej')],
      team1Score: 10, team2Score: 2, status: 'completed' },
    { id: genId(), round: 3, court: 1,
      team1: [p('Joey'), p('Sergej')], team2: [p('Stephan'), p('Robert')],
      team1Score: 10, team2Score: 7, status: 'completed' },
    { id: genId(), round: 4, court: 0,
      team1: [p('Eddy'), p('Maxim')], team2: [p('Robert'), p('Sergej')],
      team1Score: 10, team2Score: 7, status: 'completed' },
    { id: genId(), round: 4, court: 1,
      team1: [p('Maxim'), p('Sergej')], team2: [p('Stephan'), p('Joey')],
      team1Score: 6, team2Score: 10, status: 'completed' },
    { id: genId(), round: 5, court: 0,
      team1: [p('Eddy'), p('Robert')], team2: [p('Joey'), p('Maxim')],
      team1Score: 10, team2Score: 4, status: 'completed' },
    { id: genId(), round: 5, court: 1,
      team1: [p('Eddy'), p('Joey')], team2: [p('Stephan'), p('Sergej')],
      team1Score: 10, team2Score: 0, status: 'completed' },
    { id: genId(), round: 6, court: 0,
      team1: [p('Maxim'), p('Robert')], team2: [p('Eddy'), p('Sergej')],
      team1Score: 8, team2Score: 10, status: 'completed' },
    { id: genId(), round: 6, court: 1,
      team1: [p('Eddy'), p('Stephan')], team2: [p('Joey'), p('Robert')],
      team1Score: 10, team2Score: 9, status: 'completed' },
    { id: genId(), round: 7, court: 0,
      team1: [p('Maxim'), p('Sergej')], team2: [p('Eddy'), p('Robert')],
      team1Score: 3, team2Score: 10, status: 'completed' },
    { id: genId(), round: 7, court: 1,
      team1: [p('Stephan'), p('Joey')], team2: [p('Eddy'), p('Maxim')],
      team1Score: 8, team2Score: 10, status: 'completed' },
    { id: genId(), round: 8, court: 0,
      team1: [p('Joey'), p('Maxim')], team2: [p('Robert'), p('Sergej')],
      team1Score: 4, team2Score: 10, status: 'completed' },
    { id: genId(), round: 8, court: 1,
      team1: [p('Eddy'), p('Stephan')], team2: [p('Joey'), p('Sergej')],
      team1Score: 6, team2Score: 10, status: 'completed' },
    { id: genId(), round: 9, court: 0,
      team1: [p('Stephan'), p('Sergej')], team2: [p('Maxim'), p('Robert')],
      team1Score: 6, team2Score: 10, status: 'completed' },
    { id: genId(), round: 9, court: 1,
      team1: [p('Eddy'), p('Joey')], team2: [p('Stephan'), p('Maxim')],
      team1Score: 10, team2Score: 8, status: 'completed' },
  ];

  const tournament = {
    id: genId(),
    type: 'americano-gross',
    date: '2025-04-03T14:00:00.000Z',
    players: [p('Joey'), p('Sergej'), p('Eddy'), p('Stephan'), p('Maxim'), p('Robert')],
    games,
    pointsToWin: 10,
    courts: 2,
    currentRound: 10,
    status: 'completed',
  };

  console.log('\nSeeding Americano Groß (April 3)...');
  await setDoc(doc(db, 'dev_games', tournament.id), tournament);
  console.log(`  ✓ Tournament ${tournament.id} with ${games.length} games`);

  // Print leaderboard
  console.log('\n--- Americano Leaderboard (Game 3 - Groß) ---');
  const scores = {};
  for (const name of ['Joey', 'Sergej', 'Eddy', 'Stephan', 'Maxim', 'Robert']) scores[name] = 0;
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
