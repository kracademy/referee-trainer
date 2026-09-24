import { db } from '../db/db';
import type { Athlete, Attempt, Category, Competition, Performance, ScoutAthlete, ScoutKata, Video } from '../db/types';

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  app: 'kracademy-kata-trainer';
  competitions: Competition[];
  categories: Category[];
  athletes: Athlete[];
  videos: Video[];
  performances: Performance[];
  attempts: Attempt[];
  /** Club Karate Swing (opcional: copias antiguas no lo traen). */
  scoutAthletes?: ScoutAthlete[];
  scoutKatas?: ScoutKata[];
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'kracademy-kata-trainer',
    competitions: await db.competitions.toArray(),
    categories: await db.categories.toArray(),
    athletes: await db.athletes.toArray(),
    videos: await db.videos.toArray(),
    performances: await db.performances.toArray(),
    attempts: await db.attempts.toArray(),
    scoutAthletes: await db.scoutAthletes.toArray(),
    scoutKatas: await db.scoutKatas.toArray(),
  };
}

export async function importBackup(data: BackupFile): Promise<void> {
  if (data.app !== 'kracademy-kata-trainer') throw new Error('El archivo no es un backup de esta app');
  await db.transaction('rw', [db.competitions, db.categories, db.athletes, db.videos, db.performances, db.attempts, db.scoutAthletes, db.scoutKatas], async () => {
    await db.scoutAthletes.bulkPut(data.scoutAthletes ?? []);
    await db.scoutKatas.bulkPut(data.scoutKatas ?? []);
    await db.competitions.bulkPut(data.competitions ?? []);
    await db.categories.bulkPut(data.categories ?? []);
    await db.athletes.bulkPut(data.athletes ?? []);
    await db.videos.bulkPut(data.videos ?? []);
    await db.performances.bulkPut(data.performances ?? []);
    // Los intentos llevan id autoincremental: se insertan sin id para no pisar los locales.
    const existing = await db.attempts.toArray();
    const seen = new Set(existing.map((a) => `${a.performanceId}|${a.attemptedAt}`));
    const fresh = (data.attempts ?? []).filter((a) => !seen.has(`${a.performanceId}|${a.attemptedAt}`));
    await db.attempts.bulkAdd(fresh.map(({ id: _id, ...rest }) => rest as Attempt));
  });
}

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
