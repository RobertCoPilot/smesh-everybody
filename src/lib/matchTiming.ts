export interface TimedMatchUnit {
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
}

export function markStarted<T extends TimedMatchUnit>(unit: T, now = new Date().toISOString()): T {
  if (unit.startedAt) return unit;
  return { ...unit, startedAt: now };
}

export function markCompleted<T extends TimedMatchUnit>(unit: T, now = new Date().toISOString()): T {
  const startedAt = unit.startedAt ?? now;
  const durationSeconds = Math.max(0, Math.round((new Date(now).getTime() - new Date(startedAt).getTime()) / 1000));
  return { ...unit, startedAt, completedAt: now, durationSeconds };
}
