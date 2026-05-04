import { NextResponse } from 'next/server';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firestoreCollections } from '@/lib/firestoreCollections';
import { db } from '@/lib/firebase';
import type {
  GameRecord,
  Match1vs1,
  Match2vs2,
  AmericanoTournament,
  SetScore,
  Player,
} from '@/types';

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// POST /api/garmin/games/[id]/undo
// Body: { action: "undoTiebreak"|"undoAmericano", gid?: string, mid?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, team, gid } = body as {
      action: string;
      team?: number;
      gid?: string;
      mid?: string;
    };

    const gameRef = doc(db, firestoreCollections.games, id);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameDoc.data() as GameRecord;

    // --- UNDO TIEBREAK POINT (1vs1 / 2vs2) ---
    if ((game.type === '1vs1' || game.type === '2vs2') && action === 'undoTiebreak') {
      const m = { ...game } as Match1vs1 | Match2vs2;
      const sets: SetScore[] = m.sets.map((s) => ({
        ...s,
        tiebreak: s.tiebreak ? { ...s.tiebreak } : undefined,
      }));

      const lastSet = { ...sets[sets.length - 1] };
      if (!lastSet.tiebreak) {
        return NextResponse.json({ error: 'No tiebreak active' }, { status: 400 });
      }
      lastSet.tiebreak = { ...lastSet.tiebreak };

      // Decrement the specified team's score, or guess if not provided
      if (team === 1 && lastSet.tiebreak.team1Points > 0) {
        lastSet.tiebreak.team1Points--;
      } else if (team === 2 && lastSet.tiebreak.team2Points > 0) {
        lastSet.tiebreak.team2Points--;
      } else if (lastSet.tiebreak.team1Points >= lastSet.tiebreak.team2Points && lastSet.tiebreak.team1Points > 0) {
        lastSet.tiebreak.team1Points--;
      } else if (lastSet.tiebreak.team2Points > 0) {
        lastSet.tiebreak.team2Points--;
      }

      // If tiebreak was won (7-6 or 6-7), revert games back to 6-6
      if (lastSet.team1Games === 7 || lastSet.team2Games === 7) {
        lastSet.team1Games = 6;
        lastSet.team2Games = 6;
      }

      sets[sets.length - 1] = lastSet;

      // If match was completed, revert
      if (m.status === 'completed') {
        m.status = 'in_progress';
        m.winner = null;
        // Remove any extra set that was started after this one
        if (sets.length > 1) {
          const currentLast = sets[sets.length - 1];
          if (currentLast.team1Games === 0 && currentLast.team2Games === 0 && !currentLast.tiebreak) {
            sets.pop();
          }
        }
      }

      m.sets = sets;
      await setDoc(gameRef, clean(m));

      return NextResponse.json({
        type: m.type === '1vs1' ? '1v1' : '2v2',
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

    // --- UNDO AMERICANO POINT ---
    if ((game.type === 'americano-klein' || game.type === 'americano-gross') && gid && action === 'undoAmericano') {
      const a = { ...game } as AmericanoTournament;
      const gameIdx = a.games.findIndex((g) => g.id === gid);
      if (gameIdx === -1) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      const ag = { ...a.games[gameIdx] };

      // Decrement the specified team's score, or guess if not provided
      if (team === 1 && ag.team1Score > 0) {
        ag.team1Score--;
      } else if (team === 2 && ag.team2Score > 0) {
        ag.team2Score--;
      } else if (ag.team1Score >= ag.team2Score && ag.team1Score > 0) {
        ag.team1Score--;
      } else if (ag.team2Score > 0) {
        ag.team2Score--;
      }

      // Revert status if needed
      if (ag.status === 'completed') {
        ag.status = 'in_progress';
      }
      if (ag.team1Score === 0 && ag.team2Score === 0) {
        ag.status = 'pending';
      }

      a.games = a.games.map((g, i) => (i === gameIdx ? ag : g));
      await setDoc(gameRef, clean(a));

      const playersSnap = await getDocs(collection(db, firestoreCollections.players));
      const players = new Map<string, string>();
      playersSnap.docs.forEach((d) => {
        const p = d.data() as Player;
        players.set(p.id, p.name);
      });
      const pn = (pid: string) => players.get(pid) ?? '?';

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

    return NextResponse.json({ error: 'Unknown undo action' }, { status: 400 });
  } catch (error) {
    console.error('Garmin undo API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
