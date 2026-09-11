import type { Attempt, Performance } from '../db/types';

export interface PerformanceTraining {
  attempts: Attempt[]; // ordenados por fecha ascendente
  firstAttempt?: Attempt;
  lastAttempt?: Attempt;
  everAttempted: boolean;
  failedFirst: boolean;
  /** Acertada N veces seguidas al final → aprendida (regla configurable). */
  learned: boolean;
}

export const LEARNED_STREAK = 2;

export function analyzePerformance(attempts: Attempt[]): PerformanceTraining {
  const sorted = [...attempts].sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let tail = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].isCorrectWinner; i--) tail++;
  return {
    attempts: sorted,
    firstAttempt: first,
    lastAttempt: last,
    everAttempted: sorted.length > 0,
    failedFirst: !!first && !first.isCorrectWinner,
    learned: tail >= LEARNED_STREAK,
  };
}

export function groupByPerformance(attempts: Attempt[]): Map<string, Attempt[]> {
  const map = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = map.get(a.performanceId) ?? [];
    list.push(a);
    map.set(a.performanceId, list);
  }
  return map;
}

export function accuracy(attempts: Attempt[]): number | undefined {
  if (!attempts.length) return undefined;
  return Math.round((attempts.filter((a) => a.isCorrectWinner).length / attempts.length) * 100);
}

/** Racha actual: intentos correctos consecutivos contando desde el último. */
export function currentStreak(attempts: Attempt[]): number {
  const sorted = [...attempts].sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
  let n = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].isCorrectWinner; i--) n++;
  return n;
}

export function lastNDays(attempts: Attempt[], days: number): Attempt[] {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  return attempts.filter((a) => a.attemptedAt >= cutoff);
}

export function monthlyEvolution(attempts: Attempt[]): { month: string; pct: number; n: number }[] {
  const byMonth = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const m = a.attemptedAt.slice(0, 7); // YYYY-MM
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(a);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => ({ month, pct: accuracy(list) ?? 0, n: list.length }));
}

/** Performances marcadas por el usuario para repasar, las más recientes primero. */
export function markedForReview(performances: Performance[]): Performance[] {
  return performances.filter((p) => p.review).sort((a, b) => (b.reviewAt ?? '').localeCompare(a.reviewAt ?? ''));
}

/** Performances con primer intento fallado y aún no aprendidas, para "Mis errores". */
export function pendingErrors(performances: Performance[], attemptsByPerf: Map<string, Attempt[]>): Performance[] {
  return performances
    .filter((p) => {
      const t = analyzePerformance(attemptsByPerf.get(p.id) ?? []);
      return t.failedFirst && !t.learned;
    })
    .sort((a, b) => {
      const la = attemptsByPerf.get(a.id)?.at(-1)?.attemptedAt ?? '';
      const lb = attemptsByPerf.get(b.id)?.at(-1)?.attemptedAt ?? '';
      return lb.localeCompare(la);
    });
}
