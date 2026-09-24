import Dexie, { type EntityTable } from 'dexie';
import type { Athlete, Attempt, Category, Competition, KumiteAttempt, KumiteClip, Performance, ScoutAthlete, ScoutKata, Video } from './types';

export const LOCAL_USER_ID = 'local-user';

export class KataTrainerDB extends Dexie {
  competitions!: EntityTable<Competition, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  athletes!: EntityTable<Athlete, 'id'>;
  videos!: EntityTable<Video, 'id'>;
  performances!: EntityTable<Performance, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  kumiteClips!: EntityTable<KumiteClip, 'id'>;
  kumiteAttempts!: EntityTable<KumiteAttempt, 'id'>;
  scoutAthletes!: EntityTable<ScoutAthlete, 'id'>;
  scoutKatas!: EntityTable<ScoutKata, 'id'>;

  constructor() {
    super('kata-trainer');
    this.version(1).stores({
      competitions: 'id, year, competitionType, tier',
      categories: 'id, gender, ageGroup',
      athletes: 'id, countryCode, displayName',
      videos: 'id, availabilityStatus',
      performances:
        'id, competitionId, categoryId, roundType, status, akaAthleteId, aoAthleteId, videoId',
      attempts:
        '++id, performanceId, userId, attemptedAt, isCorrectWinner, isFirstAttempt, [performanceId+userId]',
    });
    this.version(2).stores({
      kumiteClips: 'id, videoId, decisionCall, createdAt',
      kumiteAttempts: '++id, clipId, attemptedAt, isCorrect',
    });
    // Club Karate Swing (scouting personal, solo local)
    this.version(3).stores({
      scoutAthletes: 'id, name',
      scoutKatas: 'id, athleteId, date',
    });
  }
}

export const db = new KataTrainerDB();

/** Pide almacenamiento persistente (mitiga la purga de IndexedDB en iOS). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignorar: no soportado
  }
  return false;
}
