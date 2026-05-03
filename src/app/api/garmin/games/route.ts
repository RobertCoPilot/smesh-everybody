import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { firestoreCollections } from '@/lib/firestoreCollections';
import { db } from '@/lib/firebase';
import type {
  GameRecord,
  Match1vs1,
  Match2vs2,
  Tournament,
  AmericanoTournament,
  Player,
} from '@/types';
import { getSetsScore } from '@/lib/scoring';

// GET /api/garmin/games
// Returns a flat list of all active scoreable items for the Garmin watch.
// Each item has: id, t (type), n (names), i (info), g (gameId), m (matchId)
export async function GET() {
  try {
    // Fetch players and games in parallel
    const [playersSnap, gamesSnap] = await Promise.all([
      getDocs(collection(db, firestoreCollections.players)),
      getDocs(collection(db, firestoreCollections.games)),
    ]);

    const players = new Map<string, string>();
    playersSnap.docs.forEach((d) => {
      const p = d.data() as Player;
      players.set(p.id, p.name);
    });

    const pn = (id: string) => players.get(id) ?? '?';

    const items: Record<string, unknown>[] = [];

    for (const doc of gamesSnap.docs) {
      const game = doc.data() as GameRecord;

      if (game.type === '1vs1') {
        const m = game as Match1vs1;
        if (m.status !== 'in_progress') continue;

        const [s1, s2] = getSetsScore(m.sets);
        const lastSet = m.sets[m.sets.length - 1];
        const g1 = lastSet?.team1Games ?? 0;
        const g2 = lastSet?.team2Games ?? 0;

        items.push({
          id: m.id,
          t: '1v',
          n: `${pn(m.player1)} vs ${pn(m.player2)}`,
          i: `S${s1}-${s2} G${g1}-${g2}`,
        });
      }

      if (game.type === '2vs2') {
        const m = game as Match2vs2;
        if (m.status !== 'in_progress') continue;

        const [s1, s2] = getSetsScore(m.sets);
        const lastSet = m.sets[m.sets.length - 1];
        const g1 = lastSet?.team1Games ?? 0;
        const g2 = lastSet?.team2Games ?? 0;

        items.push({
          id: m.id,
          t: '2v',
          n: `${pn(m.team1[0])} & ${pn(m.team1[1])} vs ${pn(m.team2[0])} & ${pn(m.team2[1])}`,
          i: `S${s1}-${s2} G${g1}-${g2}`,
        });
      }

      if (game.type === '2vs2-tournament') {
        const t = game as Tournament;
        if (t.status === 'completed') continue;

        // Show in-progress and pending (with both teams) matches from the tournament
        for (const match of t.matches) {
          if (match.status === 'completed') continue;
          if (!match.team1Id || !match.team2Id) continue;

          const team1 = t.teams.find((tm) => tm.id === match.team1Id);
          const team2 = t.teams.find((tm) => tm.id === match.team2Id);
          if (!team1 || !team2) continue;

          const [s1, s2] = getSetsScore(match.sets);
          const lastSet = match.sets[match.sets.length - 1];
          const g1 = lastSet?.team1Games ?? 0;
          const g2 = lastSet?.team2Games ?? 0;

          items.push({
            id: t.id,
            t: 'tr',
            m: match.id,
            n: `${pn(team1.players[0])} & ${pn(team1.players[1])} vs ${pn(team2.players[0])} & ${pn(team2.players[1])}`,
            i: `S${s1}-${s2} G${g1}-${g2}`,
          });
        }
      }

      if (game.type === 'americano-klein' || game.type === 'americano-gross') {
        const a = game as AmericanoTournament;
        if (a.status === 'completed') continue;

        // Show active games from the current round
        for (const ag of a.games) {
          if (ag.status === 'completed') continue;
          if (ag.round !== a.currentRound) continue;

          items.push({
            id: a.id,
            t: 'am',
            g: ag.id,
            n: `${pn(ag.team1[0])} & ${pn(ag.team1[1])} vs ${pn(ag.team2[0])} & ${pn(ag.team2[1])}`,
            i: `${ag.team1Score}-${ag.team2Score}/${a.pointsToWin}`,
          });
        }
      }
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('Garmin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
