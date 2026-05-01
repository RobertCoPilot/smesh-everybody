'use client';

import Link from 'next/link';

interface GameMode {
  title: string;
  description: string;
  href: string;
  accentColor: string;
  glowColor: string;
  iconBg: string;
  ringAccent: string;
  icon: React.ReactNode;
}

const gameModes: GameMode[] = [
  {
    title: '1vs1',
    description: 'Einzelmatch',
    href: '/game/1vs1/setup',
    accentColor: 'text-emerald-400',
    glowColor: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]',
    iconBg: 'bg-emerald-500/10',
    ringAccent: 'ring-emerald-500/40',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    title: '2vs2',
    description: 'Klassisches 2 vs 2 Match',
    href: '/game/2vs2/setup',
    accentColor: 'text-indigo-400',
    glowColor: 'shadow-[0_0_20px_rgba(129,140,248,0.15)]',
    iconBg: 'bg-indigo-500/10',
    ringAccent: 'ring-indigo-500/40',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    title: '2vs2 Tournament',
    description: 'Turnier Bracket',
    href: '/game/tournament/setup',
    accentColor: 'text-blue-400',
    glowColor: 'shadow-[0_0_20px_rgba(96,165,250,0.15)]',
    iconBg: 'bg-blue-500/10',
    ringAccent: 'ring-blue-500/40',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 0 1-2.019 1.114c-.662.23-1.37.356-2.101.38V21M12 11.342a6.04 6.04 0 0 1-2.019-1.114" />
      </svg>
    ),
  },
  {
    title: 'Americano Klein',
    description: 'Spiele einmal mit jedem',
    href: '/game/americano-klein/setup',
    accentColor: 'text-amber-400',
    glowColor: 'shadow-[0_0_20px_rgba(251,191,36,0.12)]',
    iconBg: 'bg-amber-500/10',
    ringAccent: 'ring-amber-500/40',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
      </svg>
    ),
  },
  {
    title: 'Americano Groß',
    description: 'Alle möglichen Kombinationen',
    href: '/game/americano-gross/setup',
    accentColor: 'text-rose-400',
    glowColor: 'shadow-[0_0_20px_rgba(251,113,133,0.12)]',
    iconBg: 'bg-rose-500/10',
    ringAccent: 'ring-rose-500/40',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
];

export default function NewGamePage() {
  return (
    <div className="px-5 pt-8 pb-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-in">
        <Link
          href="/"
          className="flex items-center justify-center w-11 h-11 rounded-full glass-card-static transition-all duration-300 hover:border-[rgba(255,255,255,0.15)]"
        >
          <svg className="w-5 h-5 text-[rgba(255,255,255,0.6)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Neues Spiel</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)] mt-0.5">Wähle einen Spielmodus</p>
        </div>
      </div>

      {/* Game Mode Cards */}
      <div className="grid grid-cols-2 gap-4">
        {gameModes.map((mode, i) => (
          <Link
            key={mode.title}
            href={mode.href}
            className={`group relative flex flex-col items-center text-center gap-4 p-6 glass-card ring-1 ${mode.ringAccent} animate-fade-in-up stagger-${i + 1} active:scale-[0.97]`}
          >
            {/* Icon with glow circle */}
            <div className={`relative flex items-center justify-center w-14 h-14 rounded-2xl ${mode.iconBg} ${mode.accentColor} transition-all duration-300 group-hover:${mode.glowColor}`}>
              <div className={`absolute inset-0 rounded-2xl ${mode.iconBg} blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-300`} />
              <div className="relative">
                {mode.icon}
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-semibold text-sm text-[rgba(255,255,255,0.9)] leading-tight">{mode.title}</h3>
              <p className="text-xs text-[rgba(255,255,255,0.4)] leading-snug">{mode.description}</p>
            </div>

            {/* Subtle arrow indicator */}
            <div className="text-[rgba(255,255,255,0.15)] group-hover:text-[rgba(255,255,255,0.4)] transition-colors duration-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
