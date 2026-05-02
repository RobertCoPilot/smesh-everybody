'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useGameStore } from '@/store/gameStore';
import type { GameRecord, Match2vs2, Match1vs1, Tournament, AmericanoTournament } from '@/types';
import { formatSetScore, getSetsScore } from '@/lib/scoring';
import { getAmericanoLeaderboard } from '@/lib/americano';

type FilterType = 'all' | '1vs1' | '2vs2' | '2vs2-tournament' | 'americano-klein' | 'americano-gross';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: '1vs1', label: '1vs1' },
  { key: '2vs2', label: '2vs2' },
  { key: '2vs2-tournament', label: 'Turnier' },
  { key: 'americano-klein', label: 'Americano Klein' },
  { key: 'americano-gross', label: 'Americano Groß' },
];

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  '1vs1': { bg: 'bg-emerald-500/10', text: 'app-text-accent', label: '1vs1' },
  '2vs2': { bg: 'bg-indigo-500/10', text: 'app-text-accent', label: '2vs2' },
  '2vs2-tournament': { bg: 'bg-accent-soft', text: 'app-text-accent', label: 'Turnier' },
  'americano-klein': { bg: 'bg-amber-500/10', text: 'app-text-accent', label: 'Americano Klein' },
  'americano-gross': { bg: 'bg-rose-500/10', text: 'app-text-accent', label: 'Americano Groß' },
};

function getGameLink(game: GameRecord): string {
  switch (game.type) {
    case '1vs1':
      return `/game/1vs1/${game.id}`;
    case '2vs2':
      return `/game/2vs2/${game.id}`;
    case '2vs2-tournament':
      return `/game/tournament/${game.id}`;
    case 'americano-klein':
      return `/game/americano-klein/${game.id}`;
    case 'americano-gross':
      return `/game/americano-gross/${game.id}`;
  }
}

function Match1vs1Card({ game }: { game: Match1vs1 }) {
  const getPlayer = useGameStore((s) => s.getPlayer);
  const p1 = getPlayer(game.player1)?.name ?? '?';
  const p2 = getPlayer(game.player2)?.name ?? '?';
  const [team1Sets, team2Sets] = getSetsScore(game.sets);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`flex-1 text-sm ${game.winner === 1 ? 'app-text-accent font-semibold' : 'app-text-secondary'}`}>
          {game.winner === 1 ? '🏆 ' : ''}{p1}
        </div>
        <span className="text-sm font-mono font-bold app-text-primary mx-3">
          {team1Sets} - {team2Sets}
        </span>
        <div className={`flex-1 text-sm text-right ${game.winner === 2 ? 'app-text-accent font-semibold' : 'app-text-secondary'}`}>
          {game.winner === 2 ? '🏆 ' : ''}{p2}
        </div>
      </div>
      {game.sets.length > 0 && (
        <div className="flex justify-center gap-2 text-xs app-text-subtle">
          {game.sets.map((set, i) => (
            <span key={i}>{formatSetScore(set)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Match2vs2Card({ game }: { game: Match2vs2 }) {
  const getPlayer = useGameStore((s) => s.getPlayer);
  const team1Names = [...new Set(game.team1)].map((id) => getPlayer(id)?.name ?? '?').join(' & ');
  const team2Names = [...new Set(game.team2)].map((id) => getPlayer(id)?.name ?? '?').join(' & ');
  const [team1Sets, team2Sets] = getSetsScore(game.sets);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`flex-1 text-sm ${game.winner === 1 ? 'app-text-accent font-semibold' : 'app-text-secondary'}`}>
          {team1Names}
        </div>
        <span className="text-sm font-mono font-bold app-text-primary mx-3">
          {team1Sets} - {team2Sets}
        </span>
        <div className={`flex-1 text-sm text-right ${game.winner === 2 ? 'app-text-accent font-semibold' : 'app-text-secondary'}`}>
          {team2Names}
        </div>
      </div>
      {game.sets.length > 0 && (
        <div className="flex justify-center gap-2 text-xs app-text-subtle">
          {game.sets.map((set, i) => (
            <span key={i}>{formatSetScore(set)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentCard({ game }: { game: Tournament }) {
  const getPlayer = useGameStore((s) => s.getPlayer);
  const completedMatches = game.matches.filter((m) => m.status === 'completed').length;
  const winnerTeam = game.winner ? game.teams.find((t) => t.id === game.winner) : null;
  const winnerNames = winnerTeam
    ? winnerTeam.players.map((id) => getPlayer(id)?.name ?? '?').join(' & ')
    : null;

  return (
    <div className="mt-4 space-y-1.5">
      <div className="flex justify-between text-sm app-text-muted">
        <span>{game.teams.length} Teams</span>
        <span>{completedMatches} / {game.matches.length} Spiele</span>
      </div>
      {winnerNames && (
        <div className="text-sm app-text-accent font-semibold">
          🏆 {winnerNames}
        </div>
      )}
    </div>
  );
}

function AmericanoCard({ game }: { game: AmericanoTournament }) {
  const getPlayer = useGameStore((s) => s.getPlayer);
  const completedGames = game.games.filter((g) => g.status === 'completed').length;

  // Determine winner from leaderboard
  const winnerName = (() => {
    if (game.status !== 'completed') return null;
    const lb = getAmericanoLeaderboard(game.games, game.players);
    if (lb.length === 0) return null;
    return getPlayer(lb[0].playerId)?.name ?? null;
  })();

  return (
    <div className="mt-4 space-y-1.5">
      <div className="flex justify-between text-sm app-text-muted">
        <span>{game.players.length} Spieler</span>
        <span>{completedGames} / {game.games.length} Spiele</span>
      </div>
      {winnerName ? (
        <div className="text-sm app-text-accent font-semibold">
          🏆 {winnerName}
        </div>
      ) : game.status === 'completed' ? (
        <div className="text-sm app-text-accent font-semibold">
          ✅ Abgeschlossen
        </div>
      ) : null}
    </div>
  );
}

export default function HistoryPage() {
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { games, getPlayer, removeGame } = useGameStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="p-4 pt-6">
        <h1 className="text-3xl font-bold gradient-text mb-6">Spielverlauf</h1>
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-[var(--league-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const filtered = games
    .filter((g) => filter === 'all' || g.type === filter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-4 pt-6 pb-24 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">Spielverlauf</h1>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              filter === f.key
                ? 'bg-[var(--league-accent)] text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                : 'glass-card-static app-text-muted hover-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Games list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 animate-fade-in-up">
          <svg className="w-16 h-16 mb-4 app-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium app-text-muted">Noch keine Spiele</p>
          <p className="text-sm mt-1 app-text-faint">Starte ein neues Spiel, um es hier zu sehen</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in-up">
          {filtered.map((game) => {
            const style = TYPE_STYLES[game.type];
            return (
              <div key={game.id} className="relative">
                <Link href={getGameLink(game)}>
                <div className="glass-card rounded-2xl p-5 active:scale-[0.98]">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <span className={`pill ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`pill ${
                          game.status === 'completed'
                            ? 'bg-accent-soft app-text-accent'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {game.status === 'completed' ? 'Abgeschlossen' : 'Aktiv'}
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <p className="text-xs app-text-subtle mt-2">
                    {format(new Date(game.date), 'MMM d, yyyy')}
                  </p>

                  {/* Game-type specific content */}
                  {game.type === '1vs1' && <Match1vs1Card game={game} />}
                  {game.type === '2vs2' && <Match2vs2Card game={game} />}
                  {game.type === '2vs2-tournament' && <TournamentCard game={game} />}
                  {(game.type === 'americano-klein' || game.type === 'americano-gross') && (
                    <AmericanoCard game={game} />
                  )}
                </div>
                </Link>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteId(game.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg app-text-subtle hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1f1f1f]/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-semibold text-white">Spiel wirklich löschen?</h2>
            <p className="text-sm app-text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl glass-card-static text-sm font-medium app-text-secondary hover-text-primary transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  removeGame(deleteId);
                  setDeleteId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-sm font-medium text-white hover:bg-red-500 transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
