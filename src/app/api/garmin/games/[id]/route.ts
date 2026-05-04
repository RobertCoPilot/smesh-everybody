import { NextResponse } from 'next/server';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
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

// GET /api/garmin/games/[id]
// Returns full game details for the Garmin watch.
// Query params: ?gid=xxx (americano game id), ?mid=xxx (tournament match id)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const gid = url.searchParams.get('gid');
    const mid = url.searchParams.get('mid');

    // Fetch game document
    const gameDoc = await getDoc(doc(db, firestoreCollections.games, id));
    if (!gameDoc.exists()) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Fetch players for name resolution
    const playersSnap = await getDocs(collection(db, firestoreCollections.players));
    const players = new Map<string, string>();
    playersSnap.docs.forEach((d) => {
      const p = d.data() as Player;
      players.set(p.id, p.name);
    });
    const pn = (pid: string) => players.get(pid) ?? '?';

    const game = gameDoc.data() as GameRecord;

    // 1vs1 match
    if (game.type === '1vs1') {
      const m = game as Match1vs1;
      return NextResponse.json({
        type: '1v1',
        t1: [pn(m.player1)],
        t2: [pn(m.player2)],
        sw: m.setsToWin,
        sets: m.sets.map((s) => ({
          g1: s.team1Games,
          g2: s.team2Games,
          tb: s.tiebreak
            ? { p1: s.tiebreak.team1Points, p2: s.tiebreak.team2Points }
            : null,
        })),
        status: m.status,
      });
    }

    // 2vs2 match
    if (game.type === '2vs2') {
      const m = game as Match2vs2;
      return NextResponse.json({
        type: '2v2',
        t1: m.team1.map(pn),
        t2: m.team2.map(pn),
        sw: m.setsToWin,
        sets: m.sets.map((s) => ({
          g1: s.team1Games,
          g2: s.team2Games,
          tb: s.tiebreak
            ? { p1: s.tiebreak.team1Points, p2: s.tiebreak.team2Points }
            : null,
        })),
        status: m.status,
      });
    }

    // Tournament match
    if (game.type === '2vs2-tournament' && mid) {
      const t = game as Tournament;
      const match = t.matches.find((m) => m.id === mid);
      if (!match || !match.team1Id || !match.team2Id) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      }
      const team1 = t.teams.find((tm) => tm.id === match.team1Id);
      const team2 = t.teams.find((tm) => tm.id === match.team2Id);
      if (!team1 || !team2) {
        return NextResponse.json({ error: 'Teams not found' }, { status: 404 });
      }

      return NextResponse.json({
        type: 'tournament',
        t1: team1.players.map(pn),
        t2: team2.players.map(pn),
        sw: match.setsToWin,
        sets: match.sets.map((s) => ({
          g1: s.team1Games,
          g2: s.team2Games,
          tb: s.tiebreak
            ? { p1: s.tiebreak.team1Points, p2: s.tiebreak.team2Points }
            : null,
        })),
        status: match.status,
      });
    }

    // Americano game
    if (
      (game.type === 'americano-klein' || game.type === 'americano-gross') &&
      gid
    ) {
      const a = game as AmericanoTournament;
      const ag = a.games.find((g) => g.id === gid);
      if (!ag) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      return NextResponse.json({
        type: 'americano',
        t1: ag.team1.map(pn),
        t2: ag.team2.map(pn),
        s1: ag.team1Score,
        s2: ag.team2Score,
        ptw: a.pointsToWin,
        status: ag.status,
      });
    }

    return NextResponse.json({ error: 'Unsupported game type' }, { status: 400 });
  } catch (error) {
    console.error('Garmin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
