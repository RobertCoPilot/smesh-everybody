'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import { PadelPlayerCard } from '@/components/padel-builder/PadelPlayerCard';
import { createPadelPlayer } from '@/components/padel-builder/playerFactory';
import { derivePhase2Engagement, type Phase2EngagementSummary } from '@/lib/phase2Engagement';
import { derivePhase3SocialStats } from '@/lib/phase3SocialStats';
import { useGameStore } from '@/store/gameStore';

export default function PlayersPage() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const players = useGameStore((s) => s.players);
  const games = useGameStore((s) => s.games);
  const addPlayer = useGameStore((s) => s.addPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const getPlayerWins = useGameStore((s) => s.getPlayerWins);

  const isPlayerInGames = useMemo(() => {
    if (!hydrated) return new Set<string>();
    const inGames = new Set<string>();
    for (const game of games) {
      if (game.type === '1vs1') {
        inGames.add(game.player1);
        inGames.add(game.player2);
      } else if (game.type === '2vs2') {
        game.team1.forEach((id) => inGames.add(id));
        game.team2.forEach((id) => inGames.add(id));
      } else {
        game.players.forEach((id) => inGames.add(id));
      }
    }
    return inGames;
  }, [hydrated, games]);

  const filteredPlayers = useMemo(() => {
    if (!hydrated) return [];
    const q = search.toLowerCase().trim();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [hydrated, players, search]);

  const phase2Engagement = useMemo<Map<string, Phase2EngagementSummary>>(() => {
    if (!hydrated) return new Map<string, Phase2EngagementSummary>();
    return derivePhase2Engagement(players, games);
  }, [hydrated, players, games]);

  const phase3SocialStats = useMemo(() => {
    if (!hydrated) return null;
    return derivePhase3SocialStats(players, games);
  }, [hydrated, players, games]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    setError('');

    if (!trimmed) {
      setError('Name darf nicht leer sein');
      return;
    }

    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Ein Spieler mit diesem Namen existiert bereits');
      return;
    }

    addPlayer(trimmed);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      removePlayer(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  if (!hydrated) {
    return (
      <div className="p-4 pt-6">
        <h1 className="text-3xl font-bold gradient-text mb-6">Spieler</h1>
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-[var(--league-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-6 pb-24 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold gradient-text">Spieler</h1>
        <span className="pill bg-theme-soft app-text-muted">{players.length}</span>
      </div>

      {/* Add Player */}
      <div className="mb-6 animate-fade-in-up stagger-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Neuer Spielername..."
            className="input-glass flex-1 px-4 py-3"
          />
          <button
            onClick={handleAdd}
            className="btn-primary px-5 py-3"
          >
            Hinzufügen
          </button>
        </div>
        {error && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="app-text-accent text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Search (show if more than 8 players) */}
      {players.length > 8 && (
        <div className="mb-5 animate-fade-in-up stagger-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Spieler suchen..."
            className="input-glass w-full px-4 py-3"
          />
        </div>
      )}

      {/* Player List */}
      {filteredPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 animate-fade-in-up">
          <svg className="w-16 h-16 mb-4 app-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {search ? (
            <p className="text-lg font-medium app-text-muted">Keine Spieler gefunden</p>
          ) : (
            <>
              <p className="text-lg font-medium app-text-muted">Noch keine Spieler</p>
              <p className="text-sm mt-1 app-text-faint">Füge oben deinen ersten Spieler hinzu</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in-up">
          {filteredPlayers.map((player) => {
            const stats = getPlayerWins(player.id);
            const canDelete = !isPlayerInGames.has(player.id);
            const totalWins = stats.onevoneWins + stats.twovstwoWins + stats.tournamentWins + stats.americanoWins;
            const engagement = phase2Engagement.get(player.id);
            const streak = engagement?.streaks.current;
            const streakLabel = streak?.kind === 'win' ? `W${streak.count}` : streak?.kind === 'loss' ? `L${streak.count}` : '—';
            const topAwards = engagement?.awards.earned.slice(-3).reverse() ?? [];
            const cardPlayer = createPadelPlayer(player.id, player.name, 'left', `${player.id}-profile-card`, player.currentElo);
            const archetype = phase3SocialStats?.archetypes.get(player.id);
            const bestDuo = [...(phase3SocialStats?.chemistry.values() ?? [])]
              .filter((duo) => duo.players.includes(player.id))
              .sort((a, b) => b.chemistryScore - a.chemistryScore)[0];
            const duoTitle = bestDuo ? phase3SocialStats?.duoTitles.get(bestDuo.pairKey) : null;

            return (
              <div
                key={player.id}
                className="glass-card-static rounded-2xl p-5 group"
              >
                <div className="flex items-center gap-3">
                  {/* FUT card */}
                  <div className="h-36 w-24 shrink-0">
                    <PadelPlayerCard player={cardPlayer} compact />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="app-text-primary font-medium truncate">{player.name}</p>
                    <p className="text-xs app-text-faint">
                      Dabei seit {format(new Date(player.createdAt), 'MMM d, yyyy')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="pill bg-theme-soft app-text-muted">Prime {Math.round(engagement?.prime.primeElo ?? player.peakElo ?? player.currentElo ?? 1000)}</span>
                      <span className="pill bg-theme-soft app-text-muted">{streakLabel} Streak</span>
                      <span className="pill bg-theme-soft app-text-muted">{engagement?.activity.status ?? 'unranked'} · {engagement?.activity.confidence ?? 0}%</span>
                      {archetype && <span className="pill bg-theme-soft app-text-muted">{archetype.primary}</span>}
                      {duoTitle && <span className="pill bg-theme-soft app-text-muted">{duoTitle.title}</span>}
                    </div>
                  </div>

                  {/* Delete button */}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(player.id)}
                      className={`shrink-0 p-2 rounded-xl transition-all duration-300 ${
                        deleteConfirm === player.id
                          ? 'bg-rose-500/15 app-text-accent'
                          : 'app-text-faint opacity-0 group-hover:opacity-100 max-sm:opacity-100 hover-text-accent hover-surface'
                      }`}
                      title={deleteConfirm === player.id ? 'Erneut klicken zum Bestätigen' : 'Spieler löschen'}
                    >
                      {deleteConfirm === player.id ? (
                        <span className="text-xs font-medium px-1">Sicher?</span>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Quick stats */}
                <div className="flex gap-4 mt-4 pt-4 border-t border-theme-weak">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold app-text-primary">{stats.gamesPlayed}</p>
                    <p className="text-xs app-text-subtle">Spiele</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold app-text-accent">{totalWins}</p>
                    <p className="text-xs app-text-subtle">Siege</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold app-text-primary">{engagement?.awards.earned.length ?? 0}</p>
                    <p className="text-xs app-text-subtle">Awards</p>
                  </div>
                </div>

                {topAwards.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topAwards.map((award) => (
                      <span key={award.id} className="rounded-full border border-theme-weak bg-theme-soft px-2.5 py-1 text-[0.68rem] font-semibold app-text-muted" title={award.description}>
                        🏅 {award.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
