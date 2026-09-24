import { db } from '../db/db';
import type { ScoutAthlete, ScoutFile, ScoutKata } from '../db/types';

const clean = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;

/** Fusiona dos versiones del mismo registro: los vacíos se rellenan y, si ambos tienen valor, gana la más reciente. */
function merge<T extends { createdAt: string; updatedAt?: string }>(existing: T, incoming: T): T {
  const stamp = (x: T) => x.updatedAt ?? x.createdAt;
  const [older, newer] = stamp(incoming) > stamp(existing) ? [existing, incoming] : [incoming, existing];
  return { ...clean(older), ...clean(newer) } as T;
}

export async function exportScout(): Promise<ScoutFile> {
  return {
    app: 'kracademy-club-swing',
    exportedAt: new Date().toISOString(),
    athletes: await db.scoutAthletes.toArray(),
    katas: await db.scoutKatas.toArray(),
  };
}

export async function importScout(data: ScoutFile): Promise<{ athletes: number; katas: number; nuevos: number }> {
  if (data?.app !== 'kracademy-club-swing') throw new Error('El archivo no es de Club Karate Swing');
  let nuevos = 0;
  await db.transaction('rw', db.scoutAthletes, db.scoutKatas, async () => {
    for (const a of data.athletes ?? []) {
      const ex = await db.scoutAthletes.get(a.id);
      await db.scoutAthletes.put(ex ? merge<ScoutAthlete>(ex, a) : a);
    }
    for (const k of data.katas ?? []) {
      const ex = await db.scoutKatas.get(k.id);
      if (!ex) nuevos++;
      await db.scoutKatas.put(ex ? merge<ScoutKata>(ex, k) : k);
    }
  });
  return { athletes: data.athletes?.length ?? 0, katas: data.katas?.length ?? 0, nuevos };
}
