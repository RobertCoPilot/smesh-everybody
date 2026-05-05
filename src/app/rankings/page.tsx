'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { calculateEloLeaderboard, getTierLabel } from '@/lib/elo';
import { derivePhase2Engagement } from '@/lib/phase2Engagement';
import { useGameStore } from '@/store/gameStore';

type CategoryKey = 'overall' | 'elo' | 'americano' | 'normal';

interface OverallRow {
  playerId: string;
  name: string;
  gamesPlayed: number;
  gamesWon: number;
  gameWinPct: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  tournamentWinPct: number;
}

interface AmericanoRow {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  tournamentsPlayed: number;
  tournamentWins: number;
  points: number;
  avgPoints: number;
}

interface EloRow {
  playerId: string;
  name: string;
  currentElo: number;
  peakElo: number;
  primeElo: number;
  confidence: number;
  currentStreak: number;
  matchesPlayed: number;
  weightedMatchesPlayed: number;
  experience: number;
  wins: number;
  winPct: number;
}

interface NormalRow {
  playerId: string;
  name: string;
  onevonePlayed: number;
  onevoneWins: number;
  twovstwoPlayed: number;
  twovstwoWins: number;
  tournamentsPlayed: number;
  tournamentWins: number;
}

type SortKey<T> = keyof Omit<T, 'playerId' | 'name'>;

const CATEGORY_TABS: { key: CategoryKey; label: string }[] = [
  { key: 'overall', label: 'Gesamt' },
  { key: 'elo', label: 'ELO' },
  { key: 'americano', label: 'Americano' },
  { key: 'normal', label: 'Normal' },
];

// Column definitions — ORDER here = ORDER in table (left to right)
const OVERALL_COLS: { key: SortKey<OverallRow>; label: string; short: string }[] = [
  { key: 'gamesPlayed', label: 'Spiele gesp.', short: 'Sp' },
  { key: 'gamesWon', label: 'Spiele gew.', short: 'SG' },
  { key: 'gameWinPct', label: 'Spiel Sieg-%', short: 'S%' },
  { key: 'tournamentsPlayed', label: 'Turniere gesp.', short: 'T' },
  { key: 'tournamentsWon', label: 'Turniere gew.', short: 'TG' },
  { key: 'tournamentWinPct', label: 'Turnier Sieg-%', short: 'T%' },
];

const AMERICANO_COLS: { key: SortKey<AmericanoRow>; label: string; short: string }[] = [
  { key: 'gamesPlayed', label: 'Spiele', short: 'Sp' },
  { key: 'wins', label: 'Siege', short: 'S' },
  { key: 'tournamentsPlayed', label: 'Turniere', short: 'T' },
  { key: 'tournamentWins', label: 'Turnier Siege', short: 'TS' },
  { key: 'points', label: 'Punkte', short: 'Pkt' },
  { key: 'avgPoints', label: 'Durchschnitt', short: '⌀' },
];

const ELO_COLS: { key: SortKey<EloRow>; label: string; short: string }[] = [
  { key: 'currentElo', label: 'Aktuelles ELO', short: 'ELO' },
  { key: 'peakElo', label: 'Peak ELO', short: 'Peak' },
  { key: 'primeElo', label: 'Prime ELO', short: 'Prime' },
  { key: 'confidence', label: 'Aktivität', short: 'Akt' },
  { key: 'currentStreak', label: 'Streak', short: 'Str' },
  { key: 'matchesPlayed', label: 'ELO Events', short: 'Sp' },
  { key: 'weightedMatchesPlayed', label: 'Gewichtete Matches', short: 'WSp' },
  { key: 'experience', label: 'Erfahrung', short: 'XP' },
  { key: 'wins', label: 'Siege', short: 'S' },
  { key: 'winPct', label: 'Sieg-%', short: 'S%' },
];

const NORMAL_COLS: { key: SortKey<NormalRow>; label: string; short: string }[] = [
  { key: 'onevonePlayed', label: '1vs1 Spiele', short: '1P' },
  { key: 'onevoneWins', label: '1vs1 Siege', short: '1S' },
  { key: 'twovstwoPlayed', label: '2vs2 Spiele', short: '2P' },
  { key: 'twovstwoWins', label: '2vs2 Siege', short: '2S' },
  { key: 'tournamentsPlayed', label: 'Turniere', short: 'T' },
  { key: 'tournamentWins', label: 'Turnier Siege', short: 'TS' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

function formatPct(pct: number): string {
  if (pct === 0) return '0%';
  return `${Math.round(pct)}%`;
}

function formatAvg(avg: number): string {
  if (avg === 0) return '0';
  return avg.toFixed(1);
}

function sortRows<T>(rows: T[], key: keyof T): T[] {
  return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number));
}

export default function RankingsPage() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [category, setCategory] = useState<CategoryKey>('overall');
  const [overallSort, setOverallSort] = useState<SortKey<OverallRow>>('gameWinPct');
  const [americanoSort, setAmericanoSort] = useState<SortKey<AmericanoRow>>('points');
  const [eloSort, setEloSort] = useState<SortKey<EloRow>>('currentElo');
  const [normalSort, setNormalSort] = useState<SortKey<NormalRow>>('twovstwoWins');

  const players = useGameStore((s) => s.players);
  const games = useGameStore((s) => s.games);
  const getPlayerWins = useGameStore((s) => s.getPlayerWins);

  const allStats = useMemo(() => {
    if (!hydrated) return [];
    return players.map((p) => ({ player: p, stats: getPlayerWins(p.id) }));
  }, [hydrated, players, getPlayerWins]);

  const overallRows = useMemo<OverallRow[]>(() => {
    return allStats.map(({ player, stats }) => {
      const tournamentsPlayed = stats.tournamentsPlayed + stats.americanoTournamentsPlayed;
      const gamesPlayed = stats.gamesPlayed;
      const tournamentsWon = stats.tournamentWins + stats.americanoTournamentWins;
      const gamesWon = stats.onevoneWins + stats.twovstwoWins + stats.americanoWins;
      return {
        playerId: player.id,
        name: player.name,
        gamesPlayed,
        gamesWon,
        gameWinPct: gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0,
        tournamentsPlayed,
        tournamentsWon,
        tournamentWinPct: tournamentsPlayed > 0 ? (tournamentsWon / tournamentsPlayed) * 100 : 0,
      };
    });
  }, [allStats]);

  const americanoRows = useMemo<AmericanoRow[]>(() => {
    return allStats.map(({ player, stats }) => ({
      playerId: player.id,
      name: player.name,
      gamesPlayed: stats.americanoGamesPlayed,
      wins: stats.americanoWins,
      tournamentsPlayed: stats.americanoTournamentsPlayed,
      tournamentWins: stats.americanoTournamentWins,
      points: stats.americanoPoints,
      avgPoints:
        stats.americanoGamesPlayed > 0
          ? Math.round((stats.americanoNormalizedPoints / stats.americanoGamesPlayed) * 100) / 100
          : 0,
    }));
  }, [allStats]);

  const normalRows = useMemo<NormalRow[]>(() => {
    return allStats.map(({ player, stats }) => ({
      playerId: player.id,
      name: player.name,
      onevonePlayed: stats.onevonePlayed,
      onevoneWins: stats.onevoneWins,
      twovstwoPlayed: stats.twovstwoPlayed,
      twovstwoWins: stats.twovstwoWins,
      tournamentsPlayed: stats.tournamentsPlayed,
      tournamentWins: stats.tournamentWins,
    }));
  }, [allStats]);

  const eloRows = useMemo<EloRow[]>(() => {
    const engagement = derivePhase2Engagement(players, games);
    return calculateEloLeaderboard(players, games).map((row) => {
      const phase2 = engagement.get(row.playerId);
      const streak = phase2?.streaks.current;
      const streakPrefix = streak?.kind === 'win' ? 'W' : streak?.kind === 'loss' ? 'L' : '—';
      const activityLabel = phase2?.activity.status === 'rusty' ? 'Rusty' : phase2?.activity.status === 'inactive' ? 'Inactive' : 'Active';
      return {
        playerId: row.playerId,
        name: `${row.name} · ${getTierLabel(row.tier)} · ${activityLabel} · ${streakPrefix}${streak?.count ?? 0}`,
        currentElo: row.currentElo,
        peakElo: row.peakElo,
        primeElo: phase2?.prime.primeElo ?? row.peakElo,
        confidence: phase2?.activity.confidence ?? 0,
        currentStreak: streak?.kind === 'loss' ? -(streak.count) : streak?.count ?? 0,
        matchesPlayed: row.matchesPlayed,
        weightedMatchesPlayed: row.weightedMatchesPlayed,
        experience: row.experience,
        wins: row.wins,
        winPct: row.winPct,
      };
    });
  }, [players, games]);

  const sortedOverall = useMemo(() => sortRows(overallRows, overallSort), [overallRows, overallSort]);
  const sortedAmericano = useMemo(() => sortRows(americanoRows, americanoSort), [americanoRows, americanoSort]);
  const sortedElo = useMemo(() => sortRows(eloRows, eloSort), [eloRows, eloSort]);
  const sortedNormal = useMemo(() => sortRows(normalRows, normalSort), [normalRows, normalSort]);

  if (!hydrated) {
    return (
      <div className="p-4 pt-6">
        <h1 className="text-3xl font-bold gradient-text mb-6">Ranglisten</h1>
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-[var(--league-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-6 pb-24 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-5">Ranglisten</h1>

      {/* Category tabs */}
      <div className="glass-card-static flex gap-1 rounded-2xl p-1 mb-5">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCategory(tab.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
              category === tab.key
                ? 'tab-option-active'
                : 'tab-option'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {category === 'overall' && (
        <div className="animate-fade-in-up">
          <SortPills cols={OVERALL_COLS} activeKey={overallSort} setKey={setOverallSort} />
          <RankTable<OverallRow>
            rows={sortedOverall}
            cols={OVERALL_COLS}
            activeKey={overallSort}
            formatValue={(key, val) =>
              key === 'gameWinPct' || key === 'tournamentWinPct' ? formatPct(val) : String(val)
            }
          />
        </div>
      )}

      {category === 'elo' && (
        <div className="animate-fade-in-up">
          <div className="glass-card-static rounded-2xl p-3 mb-4">
            <p className="text-xs app-text-muted leading-relaxed">
              ELO und XP werden live aus allen abgeschlossenen Formaten berechnet. Volle 2vs2-Matches zählen stärker als kurze Americano-Spiele; Dauer, Score-Differenz, Score-Volumen und Gegnerstärke fließen in das Gewicht ein.
            </p>
          </div>
          <SortPills cols={ELO_COLS} activeKey={eloSort} setKey={setEloSort} />
          <RankTable<EloRow>
            rows={sortedElo}
            cols={ELO_COLS}
            activeKey={eloSort}
            formatValue={(key, val) => (key === 'winPct' ? formatPct(val) : String(Math.round(val)))}
          />
        </div>
      )}

      {category === 'americano' && (
        <div className="animate-fade-in-up">
          <SortPills cols={AMERICANO_COLS} activeKey={americanoSort} setKey={setAmericanoSort} />
          <RankTable<AmericanoRow>
            rows={sortedAmericano}
            cols={AMERICANO_COLS}
            activeKey={americanoSort}
            formatValue={(key, val) => (key === 'avgPoints' ? formatAvg(val) : String(val))}
          />
        </div>
      )}

      {category === 'normal' && (
        <div className="animate-fade-in-up">
          <SortPills cols={NORMAL_COLS} activeKey={normalSort} setKey={setNormalSort} />
          <RankTable<NormalRow>
            rows={sortedNormal}
            cols={NORMAL_COLS}
            activeKey={normalSort}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Sort pill bar ─── */
function SortPills<T>({
  cols,
  activeKey,
  setKey,
}: {
  cols: { key: SortKey<T>; label: string }[];
  activeKey: SortKey<T>;
  setKey: (k: SortKey<T>) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
      {cols.map((col) => (
        <button
          key={String(col.key)}
          onClick={() => setKey(col.key)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
            activeKey === col.key
              ? 'sort-pill-active'
              : 'glass-card-static sort-pill-idle'
          }`}
        >
          {col.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Ranking table (HTML table for perfect column alignment) ─── */
function RankTable<T extends { playerId: string; name: string }>({
  rows,
  cols,
  activeKey,
  formatValue,
}: {
  rows: T[];
  cols: { key: SortKey<T>; short: string }[];
  activeKey: SortKey<T>;
  formatValue?: (key: SortKey<T>, val: number) => string;
}) {
  const ranks: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (i === 0 || (rows[i][activeKey] as number) !== (rows[i - 1][activeKey] as number)) {
      ranks.push(i + 1);
    } else {
      ranks.push(ranks[i - 1]);
    }
  }

  return (
    <div className="glass-card-static rounded-2xl overflow-x-auto">
      <table className="w-full text-left border-collapse" style={{ minWidth: '340px' }}>
        <thead>
          <tr className="border-b table-divider">
            <th className="px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider app-text-faint w-8 text-center">
              #
            </th>
            <th className="py-2.5 text-[10px] font-semibold uppercase tracking-wider app-text-faint">
              Spieler
            </th>
            {cols.map((col) => (
              <th
                key={String(col.key)}
                className={`px-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-center w-10 ${
                  activeKey === col.key ? 'app-text-accent' : 'app-text-faint'
                }`}
              >
                {col.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rank = ranks[i];
            const isTop3 = rank <= 3;
            const medalColor = isTop3 ? MEDAL_COLORS[rank - 1] : undefined;
            const rowBg =
              rank === 1
                ? 'table-row-gold'
                : rank === 2
                ? 'table-row-silver'
                : rank === 3
                ? 'table-row-bronze'
                : '';

            return (
              <tr key={row.playerId} className={`border-t table-divider ${rowBg}`}>
                <td className="px-2.5 py-2.5 text-center">
                  <span
                    className="text-xs font-bold app-text-faint"
                    style={medalColor ? { color: medalColor } : undefined}
                  >
                    {rank}
                  </span>
                </td>
                <td className="py-2.5 pr-2 max-w-0">
                  <span className="text-sm font-medium app-text-primary truncate block">
                    {row.name}
                  </span>
                </td>
                {cols.map((col) => {
                  const val = row[col.key] as number;
                  const isActive = activeKey === col.key;
                  const display = formatValue ? formatValue(col.key, val) : String(val);
                  return (
                    <td key={String(col.key)} className="px-1.5 py-2.5 text-center">
                      <span
                        className={`text-xs tabular-nums ${
                          isActive ? 'font-bold app-text-accent' : 'app-text-muted'
                        }`}
                      >
                        {display}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + 2} className="px-4 py-8 text-center app-text-faint text-sm">
                Noch keine Spieler
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
