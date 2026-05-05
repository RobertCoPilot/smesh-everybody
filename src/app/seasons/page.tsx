'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  DEFAULT_SEASON_PASS_LEVELS,
  buildActiveChallenges,
  deriveChallengeProgress,
  deriveSeasonPassProgress,
  generateHallOfFame,
  generateSeasonAwards,
  generateWallOfShame,
  type SeasonWindow,
} from '@/lib/seasons';

function currentSeason(): SeasonWindow {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startsAt = new Date(Date.UTC(year, month, 1)).toISOString();
  const endsAt = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();
  return { id: `${year}-${String(month + 1).padStart(2, '0')}`, label: now.toLocaleString('de-DE', { month: 'long', year: 'numeric' }), startsAt, endsAt, closed: false };
}

export default function SeasonsPage() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const players = useGameStore((state) => state.players);
  const games = useGameStore((state) => state.games);
  const season = useMemo(() => currentSeason(), []);
  const challenges = useMemo(() => buildActiveChallenges(season), [season]);
  const challengeProgress = useMemo(() => deriveChallengeProgress(players, games, challenges), [players, games, challenges]);
  const passRows = useMemo(() => players.map((player) => deriveSeasonPassProgress(player.id, games, { season, levels: DEFAULT_SEASON_PASS_LEVELS })), [players, games, season]);
  const awards = useMemo(() => generateSeasonAwards(players, games, season), [players, games, season]);
  const fame = useMemo(() => generateHallOfFame(players, games, [season]).slice(0, 5), [players, games, season]);
  const shame = useMemo(() => generateWallOfShame(players, games, season).filter((record) => !record.hidden), [players, games, season]);
  const playerName = (id: string) => players.find((player) => player.id === id)?.name ?? 'Unbekannt';

  if (!hydrated) return null;

  return (
    <div className="p-4 pt-6 pb-24 animate-fade-in">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] app-text-accent">Wiederkehrende Inhalte</p>
        <h1 className="text-3xl font-bold gradient-text">Saisons</h1>
        <p className="mt-2 text-sm app-text-muted">{season.label} · Herausforderungen, Saisonpass, Auszeichnungen, Ruhmeshalle und sichere Spaß-Auszeichnungen.</p>
      </div>

      <section className="mb-6 glass-card-static rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Wöchentliche Herausforderungen</h2>
        <div className="space-y-3">
          {challenges.map((challenge) => {
            const rows = [...challengeProgress.values()].flat().filter((row) => row.challengeId === challenge.id);
            const completed = rows.filter((row) => row.completed).length;
            return (
              <div key={challenge.id} className="rounded-xl bg-theme-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold app-text-primary">{challenge.title}</p>
                    <p className="text-xs app-text-muted">{challenge.description}</p>
                  </div>
                  <span className="pill bg-theme-soft app-text-muted">{completed}/{players.length}</span>
                </div>
                <p className="mt-2 text-xs app-text-accent">+{challenge.xpReward} XP · +{challenge.coinReward} 🪙</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6 glass-card-static rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Saisonpass</h2>
        <div className="space-y-2">
          {passRows.sort((a, b) => b.xp - a.xp).slice(0, 8).map((row) => (
            <div key={row.playerId} className="flex items-center justify-between rounded-xl bg-theme-soft p-3 text-sm">
              <span className="font-bold app-text-primary">{playerName(row.playerId)}</span>
              <span className="app-text-muted">Level {row.level} · {row.xp} XP · {row.claimableRewards.length} abholbar</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Saison-Auszeichnungen</h2>
        <div className="grid grid-cols-1 gap-3">
          {awards.map((award) => (
            <div key={award.id} className="glass-card-static rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider app-text-accent">{award.title}</p>
              <p className="mt-1 font-bold app-text-primary">{award.subjectIds.map(playerName).join(' & ')}</p>
              <p className="text-sm app-text-muted">{award.copy}</p>
            </div>
          ))}
          {awards.length === 0 && <p className="text-sm app-text-faint">Noch nicht genug Saison-Daten.</p>}
        </div>
      </section>

      <section className="mb-6 glass-card-static rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Ruhmeshalle</h2>
        <div className="space-y-2">
          {fame.map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded-xl bg-theme-soft p-3 text-sm">
              <span className="font-bold app-text-primary">{record.label}</span>
              <span className="app-text-muted">{record.subjectIds.map(playerName).join(' & ')} · {Math.round(record.value)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card-static rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-bold app-text-primary">Wand der Lernmomente</h2>
        <p className="mb-3 text-xs app-text-muted">Spielerisch, messbar und ausblendbar. Keine toxischen Texte.</p>
        <div className="space-y-2">
          {shame.map((record) => (
            <div key={record.id} className="rounded-xl bg-theme-soft p-3 text-sm">
              <p className="font-bold app-text-primary">{record.subjectIds.map(playerName).join(' & ')}</p>
              <p className="app-text-muted">{record.copy}</p>
            </div>
          ))}
          {shame.length === 0 && <p className="text-sm app-text-faint">Noch keine würdigen Lernmomente.</p>}
        </div>
      </section>
    </div>
  );
}
