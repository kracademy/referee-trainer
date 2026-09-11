import { db } from '../db/db';
import type { CatalogStatus, DatasetFile, KumiteDatasetFile, Performance } from '../db/types';

const DATASET_URL = `${import.meta.env.BASE_URL}data/dataset.json`;
const KUMITE_DATASET_URL = `${import.meta.env.BASE_URL}data/kumite-dataset.json`;

export function computeStatus(p: Pick<Performance, 'videoId' | 'startSeconds' | 'endSeconds' | 'akaAthleteId'>): CatalogStatus {
  if (!p.akaAthleteId) return 'MISSING_DATA';
  if (!p.videoId) return 'VIDEO_MISSING';
  if (p.startSeconds == null || p.endSeconds == null) return 'VIDEO_CATALOGUED';
  return 'READY';
}

/**
 * Carga el dataset publicado con la app y lo fusiona en IndexedDB.
 * Los timestamps/vídeos catalogados localmente prevalecen si el dataset aún no los trae.
 */
export async function syncDataset(): Promise<void> {
  let ds: DatasetFile;
  try {
    const res = await fetch(DATASET_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    ds = (await res.json()) as DatasetFile;
  } catch {
    return; // offline y sin caché: la app sigue con lo que haya en IndexedDB
  }

  await db.transaction('rw', [db.competitions, db.categories, db.athletes, db.videos, db.performances], async () => {
    await db.competitions.bulkPut(ds.competitions);
    await db.categories.bulkPut(ds.categories);
    await db.athletes.bulkPut(ds.athletes);
    await db.videos.bulkPut(ds.videos);
    // Firmas de vídeo asignadas por el dataset (comp+cat+vídeo+tiempos → perf dueña):
    // si un vídeo local coincide con la firma de OTRA actuación hermana, es una copia
    // obsoleta (quedó pegada tras una re-extracción) y se descarta.
    const ownerBySig = new Map<string, string>();
    const clipsByGroup = new Map<string, { id: string; videoId: string; start: number; end: number }[]>();
    for (const p of ds.performances) {
      if (p.videoId && p.startSeconds != null && p.endSeconds != null) {
        ownerBySig.set(`${p.competitionId}|${p.categoryId}|${p.videoId}|${p.startSeconds}|${p.endSeconds}`, p.id);
        const g = `${p.competitionId}|${p.categoryId}`;
        (clipsByGroup.get(g) ?? clipsByGroup.set(g, []).get(g)!).push({ id: p.id, videoId: p.videoId, start: p.startSeconds, end: p.endSeconds });
      }
    }
    for (const perf of ds.performances) {
      const existing = await db.performances.get(perf.id);
      const samePair =
        existing &&
        existing.akaAthleteId === perf.akaAthleteId &&
        existing.aoAthleteId === perf.aoAthleteId;
      let localVideo = samePair && !perf.videoId ? {
        videoId: existing?.videoId,
        startSeconds: existing?.startSeconds,
        endSeconds: existing?.endSeconds,
      } : undefined;
      if (localVideo?.videoId != null && localVideo.startSeconds != null && localVideo.endSeconds != null) {
        const sig = `${perf.competitionId}|${perf.categoryId}|${localVideo.videoId}|${localVideo.startSeconds}|${localVideo.endSeconds}`;
        const owner = ownerBySig.get(sig);
        if (owner && owner !== perf.id) localVideo = undefined; // copia obsoleta de otra actuación
        else {
          // solape >80% con el clip de una hermana en el dataset → también copia obsoleta
          const { videoId: lvId, startSeconds: lvStart, endSeconds: lvEnd } = localVideo;
          for (const c of clipsByGroup.get(`${perf.competitionId}|${perf.categoryId}`) ?? []) {
            if (c.id === perf.id || c.videoId !== lvId) continue;
            const overlap = Math.min(c.end, lvEnd) - Math.max(c.start, lvStart);
            const shorter = Math.min(c.end - c.start, lvEnd - lvStart);
            if (shorter > 0 && overlap / shorter > 0.8) { localVideo = undefined; break; }
          }
        }
      }
      // Los sub-clips por atleta locales se conservan si el par no cambió y el vídeo sigue siendo el mismo
      const keepSub = samePair && (perf.videoId ?? localVideo?.videoId) === existing?.videoId;
      const merged: Performance = {
        ...perf,
        videoId: perf.videoId ?? localVideo?.videoId,
        startSeconds: perf.startSeconds ?? localVideo?.startSeconds,
        endSeconds: perf.endSeconds ?? localVideo?.endSeconds,
        akaStartSeconds: perf.akaStartSeconds ?? (keepSub ? existing?.akaStartSeconds : undefined),
        akaEndSeconds: perf.akaEndSeconds ?? (keepSub ? existing?.akaEndSeconds : undefined),
        aoStartSeconds: perf.aoStartSeconds ?? (keepSub ? existing?.aoStartSeconds : undefined),
        aoEndSeconds: perf.aoEndSeconds ?? (keepSub ? existing?.aoEndSeconds : undefined),
        notes: perf.notes ?? existing?.notes,
        closeResult: perf.closeResult ?? (samePair ? existing?.closeResult : undefined),
        userNote: perf.userNote ?? (samePair ? existing?.userNote : undefined),
        formerExam: perf.formerExam ?? (samePair ? existing?.formerExam : undefined),
        review: samePair ? existing?.review : undefined,
        reviewNote: samePair ? existing?.reviewNote : undefined,
        reviewAt: samePair ? existing?.reviewAt : undefined,
      };
      // campos que solo cura el dataset (no hay edición local): se toman tal cual
      merged.examAppearances = perf.examAppearances;
      merged.aoVideoId = perf.aoVideoId;
      merged.status = computeStatus(merged);
      await db.performances.put(merged);
    }
  });

  await syncKumiteDataset();
}

/** Fusiona el dataset de kumite publicado; los clips locales que aún no están en el dataset se conservan. */
async function syncKumiteDataset(): Promise<void> {
  let ds: KumiteDatasetFile;
  try {
    const res = await fetch(KUMITE_DATASET_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    ds = (await res.json()) as KumiteDatasetFile;
  } catch {
    return;
  }
  if (!Array.isArray(ds.clips)) return;
  await db.kumiteClips.bulkPut(ds.clips);
}
