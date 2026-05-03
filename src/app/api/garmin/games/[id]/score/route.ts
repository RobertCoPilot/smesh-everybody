import { NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { firestoreCollections } from '@/lib/firestoreCollections';
import { db } from '@/lib/firebase';
import type {
  GameRecord,
  Match1vs1,
  Match2vs2,
  Tournament,
  AmericanoTournament,
  SetScore,
  Player,
} from '@/types';
import {
  isSetComplete,
  needsTiebreak,
  canAddGame,
  getMatchWinner,
} from '@/lib/scoring';

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// POST /api/garmin/games/[id]/score
// Body: { action: "game"|"tiebreak"|"point", team: 1|2, gid?: string, mid?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, team, gid, mid } = body as {
      action: string;
      team: number;
      gid?: string;
      mid?: string;
    };

    if (!action || (team !== 1 && team !== 2)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const gameRef = doc(db, firestoreCollections.games, id);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameDoc.data() as GameRecord;

    // Fetch players for name resolution
    const playersSnap = await getDocs(collection(db, firestoreCollections.players));
    const players = new Map<string, string>();
    playersSnap.docs.forEach((d) => {
      const p = d.data() as Player;
      players.set(p.id, p.name);
    });
    const pn = (pid: string) => players.get(pid) ?? '?';

    // --- MATCH SCORING (1vs1 / 2vs2) ---
    if ((game.type === '1vs1' || game.type === '2vs2') && (action === 'game' || action === 'tiebreak')) {
      const m = { ...game } as Match1vs1 | Match2vs2;
      if (m.status === 'completed') {
        return NextResponse.json({ error: 'Match already completed' }, { status: 400 });
      }

      const sets: SetScore[] = m.sets.map((s) => ({
        ...s,
        tiebreak: s.tiebreak ? { ...s.tiebreak } : undefined,
      }));
      const lastSet = { ...sets[sets.length - 1] };
      if (lastSet.tiebreak) {
        lastSet.tiebreak = { ...lastSet.tiebreak };
      }

      if (action === 'game') {
        if (isSetComplete(lastSet) || !canAddGame(lastSet, team as 1 | 2)) {
          return NextResponse.json({ error: 'Cannot add game' }, { status: 400 });
        }
        if (team === 1) lastSet.team1Games++;
        else lastSet.team2Games++;

        sets[sets.length - 1] = lastSet;
        m.sets = sets;

        if (isSetComplete(lastSet)) {
          const matchWinner = getMatchWinner(sets, m.setsToWin);
          if (matchWinner) {
            m.winner = matchWinner;
            m.status = 'completed';
          } else {
            m.sets = [...sets, { team1Games: 0, team2Games: 0 }];
          }
        }
      }

      if (action === 'tiebreak') {
        if (!needsTiebreak(lastSet)) {
          // Initialize tiebreak if at 6-6
          if (lastSet.team1Games === 6 && lastSet.team2Games === 6 && !lastSet.tiebreak) {
            lastSet.tiebreak = { team1Points: 0, team2Points: 0 };
          } else {
            return NextResponse.json({ error: 'Not in tiebreak' }, { status: 400 });
          }
        }

        if (!lastSet.tiebreak) {
          lastSet.tiebreak = { team1Points: 0, team2Points: 0 };
        }

        if (team === 1) lastSet.tiebreak.team1Points++;
        else lastSet.tiebreak.team2Points++;

        const { team1Points, team2Points } = lastSet.tiebreak;
        const tiebreakWon =
          (team1Points >= 7 && team1Points - team2Points >= 2) ||
          (team2Points >= 7 && team2Points - team1Points >= 2);

        if (tiebreakWon) {
          if (team1Points > team2Points) {
            lastSet.team1Games = 7;
            lastSet.team2Games = 6;
          } else {
            lastSet.team1Games = 6;
            lastSet.team2Games = 7;
          }
        }

        sets[sets.length - 1] = lastSet;
        m.sets = sets;

        if (isSetComplete(lastSet)) {
          const matchWinner = getMatchWinner(sets, m.setsToWin);
          if (matchWinner) {
            m.winner = matchWinner;
            m.status = 'completed';
          } else {
            m.sets = [...sets, { team1Games: 0, team2Games: 0 }];
          }
        }
      }

      await setDoc(gameRef, clean(m));
      return buildMatchResponse(m, pn);
    }

    // --- TOURNAMENT MATCH SCORING ---
    if (game.type === '2vs2-tournament' && mid && (action === 'game' || action === 'tiebreak')) {
      const t = { ...game } as Tournament;
      const matchIdx = t.matches.findIndex((m) => m.id === mid);
      if (matchIdx === -1) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      }

      const match = { ...t.matches[matchIdx] };
      if (match.status === 'completed') {
        return NextResponse.json({ error: 'Match already completed' }, { status: 400 });
      }

      // Auto-transition pending → in_progress on first score
      if (match.status === 'pending') {
        match.status = 'in_progress';
      }

      const sets: SetScore[] = match.sets.map((s) => ({
        ...s,
        tiebreak: s.tiebreak ? { ...s.tiebreak } : undefined,
      }));

      // If no sets yet, initialize
      if (sets.length === 0) {
        sets.push({ team1Games: 0, team2Games: 0 });
      }

      const lastSet = { ...sets[sets.length - 1] };
      if (lastSet.tiebreak) {
        lastSet.tiebreak = { ...lastSet.tiebreak };
      }

      if (action === 'game') {
        if (isSetComplete(lastSet) || !canAddGame(lastSet, team as 1 | 2)) {
          return NextResponse.json({ error: 'Cannot add game' }, { status: 400 });
        }
        if (team === 1) lastSet.team1Games++;
        else lastSet.team2Games++;

        sets[sets.length - 1] = lastSet;
        match.sets = sets;

        if (isSetComplete(lastSet)) {
          const matchWinner = getMatchWinner(sets, match.setsToWin);
          if (matchWinner) {
            match.winnerId = matchWinner === 1 ? match.team1Id : match.team2Id;
            match.status = 'completed';
          } else {
            match.sets = [...sets, { team1Games: 0, team2Games: 0 }];
          }
        }
      }

      if (action === 'tiebreak') {
        if (!needsTiebreak(lastSet) && !(lastSet.team1Games === 6 && lastSet.team2Games === 6)) {
          return NextResponse.json({ error: 'Not in tiebreak' }, { status: 400 });
        }

        if (!lastSet.tiebreak) {
          lastSet.tiebreak = { team1Points: 0, team2Points: 0 };
        }

        if (team === 1) lastSet.tiebreak.team1Points++;
        else lastSet.tiebreak.team2Points++;

        const { team1Points, team2Points } = lastSet.tiebreak;
        const tiebreakWon =
          (team1Points >= 7 && team1Points - team2Points >= 2) ||
          (team2Points >= 7 && team2Points - team1Points >= 2);

        if (tiebreakWon) {
          if (team1Points > team2Points) {
            lastSet.team1Games = 7;
            lastSet.team2Games = 6;
          } else {
            lastSet.team1Games = 6;
            lastSet.team2Games = 7;
          }
        }

        sets[sets.length - 1] = lastSet;
        match.sets = sets;

        if (isSetComplete(lastSet)) {
          const matchWinner = getMatchWinner(sets, match.setsToWin);
          if (matchWinner) {
            match.winnerId = matchWinner === 1 ? match.team1Id : match.team2Id;
            match.status = 'completed';
          } else {
            match.sets = [...sets, { team1Games: 0, team2Games: 0 }];
          }
        }
      }

      // Update match in tournament and propagate winner if needed
      match.status = match.status || 'in_progress';
      t.matches = t.matches.map((m, i) => (i === matchIdx ? match : m));

      // If match completed, propagate winner to next round
      if (match.status === 'completed' && match.winnerId) {
        propagateWinnerInBracket(t, match);
      }

      // Check if tournament is complete (final match done)
      const totalRounds = Math.ceil(Math.log2(t.teams.length));
      const finalMatches = t.matches.filter((m) => m.round === totalRounds - 1);
      if (finalMatches.length === 1 && finalMatches[0].status === 'completed') {
        t.status = 'completed';
        t.winner = finalMatches[0].winnerId;
      }

      await setDoc(gameRef, clean(t));

      // Return match details
      const team1 = t.teams.find((tm) => tm.id === match.team1Id);
      const team2 = t.teams.find((tm) => tm.id === match.team2Id);

      return NextResponse.json({
        type: 'tournament',
        t1: team1 ? team1.players.map(pn) : [],
        t2: team2 ? team2.players.map(pn) : [],
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

    // --- AMERICANO SCORING ---
    if ((game.type === 'americano-klein' || game.type === 'americano-gross') && gid && action === 'point') {
      const a = { ...game } as AmericanoTournament;
      const gameIdx = a.games.findIndex((g) => g.id === gid);
      if (gameIdx === -1) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      const ag = { ...a.games[gameIdx] };
      if (ag.status === 'completed') {
        return NextResponse.json({ error: 'Game already completed' }, { status: 400 });
      }

      if (team === 1) ag.team1Score++;
      else ag.team2Score++;

      // Mark in_progress on first score
      if (ag.status === 'pending') {
        ag.status = 'in_progress';
      }

      // Auto-complete if reached pointsToWin
      if (ag.team1Score >= a.pointsToWin || ag.team2Score >= a.pointsToWin) {
        ag.status = 'completed';
      }

      a.games = a.games.map((g, i) => (i === gameIdx ? ag : g));

      // Auto-advance round: if all games in current round are completed, advance
      const currentRoundGames = a.games.filter((g) => g.round === a.currentRound);
      if (currentRoundGames.every((g) => g.status === 'completed')) {
        const maxRound = Math.max(...a.games.map((g) => g.round));
        if (a.currentRound < maxRound) {
          a.currentRound = a.currentRound + 1;
        } else {
          // All rounds completed – mark tournament as completed
          a.status = 'completed';
        }
      }

      await setDoc(gameRef, clean(a));

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

    return NextResponse.json({ error: 'Unknown action or game type' }, { status: 400 });
  } catch (error) {
    console.error('Garmin score API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: build match response (for 1vs1/2vs2) with resolved player names
function buildMatchResponse(m: Match1vs1 | Match2vs2, pn: (id: string) => string) {
  const isMatch1v1 = m.type === '1vs1';
  let t1Names: string[], t2Names: string[];

  if (isMatch1v1) {
    const m1 = m as Match1vs1;
    t1Names = [pn(m1.player1)];
    t2Names = [pn(m1.player2)];
  } else {
    const m2 = m as Match2vs2;
    t1Names = m2.team1.map(pn);
    t2Names = m2.team2.map(pn);
  }

  return NextResponse.json({
    type: isMatch1v1 ? '1v1' : '2v2',
    t1: t1Names,
    t2: t2Names,
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

// Helper: propagate tournament winner to next round bracket
function propagateWinnerInBracket(t: Tournament, completedMatch: { id: string; round: number; position: number; winnerId: string | null }) {
  if (!completedMatch.winnerId) return;

  const nextRoundMatches = t.matches.filter((m) => m.round === completedMatch.round + 1);
  const nextMatchIndex = Math.floor(completedMatch.position / 2);
  const nextMatch = nextRoundMatches[nextMatchIndex];
  if (!nextMatch) return;

  if (completedMatch.position % 2 === 0) {
    if (!nextMatch.team1Id) {
      nextMatch.team1Id = completedMatch.winnerId;
    } else {
      nextMatch.team2Id = completedMatch.winnerId;
    }
  } else {
    if (!nextMatch.team2Id) {
      nextMatch.team2Id = completedMatch.winnerId;
    } else {
      nextMatch.team1Id = completedMatch.winnerId;
    }
  }
}
