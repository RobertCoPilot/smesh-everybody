'use client';

import { useEffect, useState } from 'react';

type DesignTheme = 'clay' | 'electric';

const STORAGE_KEY = 'smesh-design-theme';

export default function DesignThemeToggle() {
  const [theme, setTheme] = useState<DesignTheme>(() => {
    if (typeof window === 'undefined') return 'clay';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'electric') return 'electric';
    return 'clay';
  });

  useEffect(() => {
    document.documentElement.dataset.designTheme = theme;
  }, [theme]);

  const handleToggle = () => {
    const nextTheme: DesignTheme = theme === 'clay' ? 'electric' : 'clay';
    setTheme(nextTheme);
    document.documentElement.dataset.designTheme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="design-theme-toggle fixed bottom-[5.75rem] right-4 z-50 flex items-center gap-2 border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] shadow-2xl transition active:scale-95"
      aria-label={`Switch to ${theme === 'clay' ? 'Electric League' : 'Clay League'} design palette`}
    >
      <span aria-hidden="true">{theme === 'clay' ? '⚡' : '◐'}</span>
      <span>{theme === 'clay' ? 'Electric' : 'Clay'}</span>
    </button>
  );
}
