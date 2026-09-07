import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../logic/useCatalog';
import { roundLabel } from '../logic/format';
import YouTubePlayer from '../components/YouTubePlayer';
import LocalVideoPlayer from '../components/LocalVideoPlayer';
import { findLocalVideo } from '../logic/localVideos';
import type { Performance } from '../db/types';

/** Una ejecución concreta de un kata: atleta + lado + clip. */
interface Execution {
  perf: Performance;
  side: 'AKA' | 'AO';
  athleteId: string;
  kata: string;
  /** Clip del atleta si está catalogado; si no, el del encuentro completo. */
  start?: number;
  end?: number;
  isSubClip: boolean;
  won: boolean;
}

/** 0 = oro (ganó la final), 1 = plata, 2 = bronce, 3 = perdió un bronce u otra ronda. */
function medalRank(e: Execution): number {
  if (e.perf.roundType === 'FINAL') return e.won ? 0 : 1;
  if (e.perf.roundType === 'BRONZE_1' || e.perf.roundType === 'BRONZE_2') return e.won ? 2 : 3;
  return 3;
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export default function KataStudy() {
  const data = useCatalog();
  const { performances, compById, categoryById, athleteById } = data;
  const [q, setQ] = useState('');
  const [fmt, setFmt] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
  const [selectedKata, setSelectedKata] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Execution | null>(null);
  const [playerKey, setPlayerKey] = useState(0);

  // vídeo local si existe (clip del bout o vídeo completo)
  const [local, setLocal] = useState<{ url: string; offset: number } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setLocal(undefined);
    (async () => {
      if (!playing?.perf.videoId) { if (alive) setLocal(null); return; }
      const clipFile = await findLocalVideo([playing.perf.id]);
      const file = clipFile ?? (await findLocalVideo([playing.perf.videoId]));
      if (!alive) return;
      if (!file) { setLocal(null); return; }
      objUrl = URL.createObjectURL(file);
      setLocal({ url: objUrl, offset: clipFile ? (playing.perf.startSeconds ?? 0) : 0 });
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [playing]);

  const executions = useMemo(() => {
    const out: Execution[] = [];
    for (const p of performances) {
      if (!p.videoId) continue;
      if ((categoryById.get(p.categoryId)?.format ?? 'INDIVIDUAL') !== fmt) continue;
      if (p.kataAka) {
        out.push({
          perf: p, side: 'AKA', athleteId: p.akaAthleteId, kata: p.kataAka,
          start: p.akaStartSeconds ?? p.startSeconds, end: p.akaEndSeconds ?? p.endSeconds,
          isSubClip: p.akaStartSeconds != null && p.akaEndSeconds != null,
          won: p.officialWinner === 'AKA',
        });
      }
      if (p.kataAo) {
        out.push({
          perf: p, side: 'AO', athleteId: p.aoAthleteId, kata: p.kataAo,
          start: p.aoStartSeconds ?? p.startSeconds, end: p.aoEndSeconds ?? p.endSeconds,
          isSubClip: p.aoStartSeconds != null && p.aoEndSeconds != null,
          won: p.officialWinner === 'AO',
        });
      }
    }
    return out;
  }, [performances, categoryById, fmt]);

  const kataStats = useMemo(() => {
    const m = new Map<string, { total: number; subClips: number }>();
    for (const e of executions) {
      const s = m.get(e.kata) ?? { total: 0, subClips: 0 };
      s.total++;
      if (e.isSubClip) s.subClips++;
      m.set(e.kata, s);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  }, [executions]);

  const filteredKatas = kataStats.filter(([k]) => !q || k.toLowerCase().includes(q.toLowerCase()));

  const list = useMemo(() => {
    if (!selectedKata) return [];
    // primero los oros (ganadores de la final: se presupone mejor kata), luego platas, bronces y el resto;
    // dentro de cada grupo, los más recientes primero
    return executions
      .filter((e) => e.kata === selectedKata)
      .sort(
        (a, b) =>
          medalRank(a) - medalRank(b) ||
          (compById.get(b.perf.competitionId)?.dateStart ?? '').localeCompare(compById.get(a.perf.competitionId)?.dateStart ?? ''),
      );
  }, [executions, selectedKata, compById]);

  if (playing) {
    const ath = athleteById.get(playing.athleteId);
    const comp = compById.get(playing.perf.competitionId);
    const cat = categoryById.get(playing.perf.categoryId);
    return (
      <>
        <h1>{playing.kata}</h1>
        {local != null && (
          <LocalVideoPlayer
            key={`local-${playerKey}`}
            src={local.url}
            startSeconds={playing.start != null ? Math.max(0, playing.start - local.offset) : undefined}
            endSeconds={playing.end != null ? playing.end - local.offset : undefined}
            controls={true}
          />
        )}
        {local === null && (
          <div className="player-wrap">
            <YouTubePlayer
              key={playerKey}
              videoId={playing.perf.videoId!}
              startSeconds={playing.start}
              endSeconds={playing.end}
              controls={true}
            />
          </div>
        )}
        {local === undefined && <div className="player-wrap" />}
        {local && <p className="muted center" style={{ margin: '6px 0 0' }}>🎞 Vídeo local · sin anuncios</p>}
        <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setPlayerKey((k) => k + 1)}>
          ↻ Recargar vídeo (si se queda en negro)
        </button>
        <div className="card perf-item" style={{ marginTop: 12 }}>
          <div className="who">
            <span style={{ color: playing.side === 'AKA' ? 'var(--aka)' : 'var(--ao)', fontWeight: 800 }}>{playing.side}</span>{' '}
            {ath?.displayName} <span className="muted">({ath?.countryCode})</span>
            {MEDAL[medalRank(playing)] ? ` ${MEDAL[medalRank(playing)]}` : ''}
          </div>
          <div className="meta">{comp?.name} · {cat?.name} · {roundLabel(playing.perf.roundType)}</div>
          {!playing.isSubClip && (
            <div className="meta">⚠️ Sin tiempos por atleta: se muestra el encuentro completo.</div>
          )}
        </div>
        <button className="btn-primary" onClick={() => setPlaying(null)}>← VOLVER A LA LISTA</button>
      </>
    );
  }

  if (selectedKata) {
    return (
      <>
        <h1>{selectedKata}</h1>
        <button className="btn-secondary" onClick={() => setSelectedKata(null)}>← Todos los katas</button>
        <h2>{list.length} ejecuciones</h2>
        {list.map((e, i) => {
          const ath = athleteById.get(e.athleteId);
          const comp = compById.get(e.perf.competitionId);
          const cat = categoryById.get(e.perf.categoryId);
          return (
            <div className="card perf-item" key={`${e.perf.id}-${e.side}-${i}`} onClick={() => setPlaying(e)} style={{ cursor: 'pointer' }}>
              <div className="who">
                <span style={{ color: e.side === 'AKA' ? 'var(--aka)' : 'var(--ao)', fontWeight: 800 }}>{e.side}</span>{' '}
                {ath?.displayName} <span className="muted">({ath?.countryCode})</span>
                {MEDAL[medalRank(e)] ? ` ${MEDAL[medalRank(e)]}` : ''}
              </div>
              <div className="meta">
                {comp?.name} · {cat?.name} · <span className="badge round">{roundLabel(e.perf.roundType)}</span>{' '}
                {e.isSubClip ? <span className="badge ready">🎬 Clip del atleta</span> : <span className="badge nodata">Encuentro completo</span>}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      <h1>Estudio de katas</h1>
      <p className="muted">
        Todas las ejecuciones de cada kata en el dataset. Los clips por atleta se marcan en{' '}
        <Link to="/kata/catalogar">Catalogar</Link>.
      </p>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className={`chip${fmt === 'INDIVIDUAL' ? ' sel' : ''}`} onClick={() => { setFmt('INDIVIDUAL'); setSelectedKata(null); }}>
          Individual
        </button>
        <button className={`chip${fmt === 'TEAM' ? ' sel' : ''}`} onClick={() => { setFmt('TEAM'); setSelectedKata(null); }}>
          Equipos
        </button>
      </div>
      <input type="text" placeholder="Buscar kata… p. ej. Ohan Dai" value={q} onChange={(e) => setQ(e.target.value)} />
      <h2>{filteredKatas.length} katas</h2>
      {filteredKatas.map(([kata, s]) => (
        <div className="card perf-item" key={kata} onClick={() => setSelectedKata(kata)} style={{ cursor: 'pointer' }}>
          <div className="who">{kata}</div>
          <div className="meta">
            {s.total} ejecuci{s.total === 1 ? 'ón' : 'ones'}
            {s.subClips > 0 && <> · <span className="badge ready">🎬 {s.subClips} con clip del atleta</span></>}
          </div>
        </div>
      ))}
    </>
  );
}
