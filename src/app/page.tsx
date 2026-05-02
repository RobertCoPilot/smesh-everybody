'use client';

import Link from 'next/link';
import { useGameStore } from '@/store/gameStore';
import type { AmericanoTournament, GameRecord, Tournament } from '@/types';
import { getAmericanoLeaderboard } from '@/lib/americano';

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

function getGameTypeBadge(type: GameRecord['type']) {
  const config: Record<GameRecord['type'], { label: string; color: string }> = {
    '1vs1': { label: '1vs1', color: 'bg-emerald-500/15 app-text-accent' },
    '2vs2': { label: '2vs2', color: 'bg-indigo-500/15 app-text-accent' },
    '2vs2-tournament': { label: 'Turnier', color: 'bg-blue-500/15 app-text-accent' },
    'americano-klein': { label: 'Americano Klein', color: 'bg-amber-500/15 app-text-accent' },
    'americano-gross': { label: 'Americano Groß', color: 'bg-rose-500/15 app-text-accent' },
  };
  const { label, color } = config[type];
  return (
    <span className={`pill ${color}`}>
      {label}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPlayerNames(game: GameRecord, getPlayer: (id: string) => { name: string } | undefined): string {
  let playerIds: string[] = [];

  if (game.type === '1vs1') {
    playerIds = [game.player1, game.player2];
  } else if (game.type === '2vs2') {
    playerIds = [...game.team1, ...game.team2];
  } else {
    playerIds = game.players;
  }

  return [...new Set(playerIds)]
    .map((id) => getPlayer(id)?.name ?? 'Unbekannt')
    .join(', ');
}

function getGameWinner(game: GameRecord, getPlayer: (id: string) => { name: string } | undefined): string | null {
  if (game.status !== 'completed') return null;

  if (game.type === '1vs1') {
    if (game.winner === 1) return getPlayer(game.player1)?.name ?? null;
    if (game.winner === 2) return getPlayer(game.player2)?.name ?? null;
    return null;
  }

  if (game.type === '2vs2') {
    if (game.winner === 1) {
      const names = [...new Set(game.team1)].map((id) => getPlayer(id)?.name ?? '?');
      return names.join(' & ');
    }
    if (game.winner === 2) {
      const names = [...new Set(game.team2)].map((id) => getPlayer(id)?.name ?? '?');
      return names.join(' & ');
    }
    return null;
  }

  if (game.type === '2vs2-tournament') {
    const t = game as Tournament;
    const winnerTeam = t.winner ? t.teams.find((team) => team.id === t.winner) : null;
    if (winnerTeam) {
      return winnerTeam.players.map((id) => getPlayer(id)?.name ?? '?').join(' & ');
    }
    return null;
  }

  if (game.type === 'americano-klein' || game.type === 'americano-gross') {
    const a = game as AmericanoTournament;
    const lb = getAmericanoLeaderboard(a.games, a.players);
    if (lb.length > 0) {
      return getPlayer(lb[0].playerId)?.name ?? null;
    }
    return null;
  }

  return null;
}

export default function Home() {
  const players = useGameStore((s) => s.players);
  const games = useGameStore((s) => s.games);
  const getPlayer = useGameStore((s) => s.getPlayer);

  const activeGames = games.filter((g) => g.status === 'in_progress');
  const completedGames = games
    .filter((g) => g.status === 'completed')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const recentActivity = games.length > 0
    ? formatDate(
        games
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      )
    : 'Noch keine Spiele';

  return (
    <div className="px-5 pt-8 pb-10 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-5 py-10 animate-fade-in">
        <div className="mx-auto w-24 space-y-1">
          <div className="league-blocks" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="league-blocks opacity-70" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-5xl leading-none sm:text-6xl">
            <span className="gradient-text">Smesh</span>
            <br />
            <span className="gradient-text-accent">Everybody</span>
          </h1>
          <p className="mx-auto max-w-xs text-sm uppercase tracking-[0.22em] text-[rgba(31,31,31,0.48)]">
            Padel Matches · Turniere · Americano
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up stagger-1">
        <div className="glass-card-static rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold gradient-text-accent">{games.length}</div>
          <div className="text-xs text-[rgba(255,255,255,0.4)] mt-1.5 font-medium uppercase tracking-wider">Spiele</div>
        </div>
        <div className="glass-card-static rounded-2xl p-4 text-center animate-fade-in-up stagger-2">
          <div className="text-3xl font-bold gradient-text-accent">{players.length}</div>
          <div className="text-xs text-[rgba(255,255,255,0.4)] mt-1.5 font-medium uppercase tracking-wider">Spieler</div>
        </div>
        <div className="glass-card-static rounded-2xl p-4 text-center animate-fade-in-up stagger-3">
          <div className="text-3xl font-bold gradient-text-accent">{activeGames.length}</div>
          <div className="text-xs text-[rgba(255,255,255,0.4)] mt-1.5 font-medium uppercase tracking-wider">Aktiv</div>
        </div>
      </div>

      {/* Start New Game CTA */}
      <div className="animate-fade-in-up stagger-2">
        <Link
          href="/new-game"
          className="btn-primary flex items-center justify-center gap-2.5 w-full py-4 text-base animate-pulse-glow"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Neues Spiel starten
        </Link>
      </div>

      {/* Active Games */}
      {activeGames.length > 0 && (
        <section className="space-y-4 animate-fade-in-up stagger-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[var(--league-accent)] animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
            <h2 className="text-lg font-semibold text-[rgba(255,255,255,0.9)]">Aktive Spiele</h2>
          </div>
          <div className="space-y-3">
            {activeGames.map((game, i) => (
              <Link
                key={game.id}
                href={getGameLink(game)}
                className={`block glass-card rounded-2xl p-5 animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--league-accent)] animate-pulse" />
                    {getGameTypeBadge(game.type)}
                  </div>
                  <span className="text-xs text-[rgba(255,255,255,0.25)]">{formatDate(game.date)}</span>
                </div>
                <p className="text-sm text-[rgba(255,255,255,0.6)] truncate">
                  {getPlayerNames(game, getPlayer)}
                </p>
                <div className="flex items-center gap-1.5 mt-3 app-text-accent text-xs font-medium">
                  <span>Fortsetzen</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Completed Games */}
      {completedGames.length > 0 && (
        <section className="space-y-4 animate-fade-in-up stagger-4">
          <h2 className="text-lg font-semibold text-[rgba(255,255,255,0.9)]">Letzte Spiele</h2>
          <div className="space-y-3">
            {completedGames.map((game, i) => (
              <Link
                key={game.id}
                href={getGameLink(game)}
                className={`block glass-card rounded-2xl p-5 animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  {getGameTypeBadge(game.type)}
                  <span className="text-xs text-[rgba(255,255,255,0.25)]">{formatDate(game.date)}</span>
                </div>
                <p className="text-sm text-[rgba(255,255,255,0.6)] truncate">
                  {getPlayerNames(game, getPlayer)}
                </p>
                {(() => {
                  const winner = getGameWinner(game, getPlayer);
                  return winner ? (
                    <p className="text-sm app-text-accent font-semibold mt-2">
                      🏆 {winner}
                    </p>
                  ) : null;
                })()}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {games.length === 0 && (
        <div className="text-center py-16 space-y-4 animate-fade-in-up stagger-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl glass-card-static">
            <svg className="w-9 h-9 text-[rgba(255,255,255,0.15)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-[rgba(255,255,255,0.4)] text-sm">Noch keine Spiele. Starte dein erstes Match!</p>
        </div>
      )}

      {/* Recent Activity Footer */}
      {games.length > 0 && (
        <div className="text-center text-xs text-[rgba(255,255,255,0.25)] pt-4 animate-fade-in stagger-5">
          Letzte Aktivität: {recentActivity}
        </div>
      )}
    </div>
  );
}
