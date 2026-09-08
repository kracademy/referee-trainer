import { athleteName } from '../logic/names';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../logic/useCatalog';
import { analyzePerformance } from '../logic/stats';
import { competitionTypeLabel, roundLabel } from '../logic/format';
import { isCloseResult, officialAverage } from '../db/types';
import type { Performance } from '../db/types';
import YouTubePlayer from '../components/YouTubePlayer';
import LocalVideoPlayer from '../components/LocalVideoPlayer';
import { findLocalVideo } from '../logic/localVideos';

const ROUND_ORDER: Record<string, number> = { FINAL: 0, BRONZE_1: 1, BRONZE_2: 2, OTHER: 3 };

/**
 * Biblioteca = consulta. Todos los encuentros por campeonato; al tocar uno se ve el vídeo completo
 * (local si existe) con el resultado oficial, katas, puntuaciones y tu historial — sin formato quiz.
 */
export default function Library() {
  const { performances, compById, categoryById, athleteById, attemptsByPerf } = useCatalog();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('ALL');
  const [gender, setGender] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [open, setOpen] = useState<Performance | null>(null);
  const [playerKey, setPlayerKey] = useState(0);

  // vídeo local del encuentro abierto (clip del bout o vídeo completo)
  const [local, setLocal] = useState<{ url: string; offset: number } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setLocal(undefined);
    (async () => {
      if (!open?.videoId) { if (alive) setLocal(null); return; }
      const clipFile = await findLocalVideo([open.id]);
      const file = clipFile ?? (await findLocalVideo([open.videoId]));
      if (!alive) return;
      if (!file) { setLocal(null); return; }
      objUrl = URL.createObjectURL(file);
      setLocal({ url: objUrl, offset: clipFile ? (open.startSeconds ?? 0) : 0 });
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [open]);

  const years = useMemo(
    () => [...new Set(performances.map((p) => compById.get(p.competitionId)?.year).filter(Boolean))].sort().reverse(),
    [performances, compById],
  );

  const list = performances.filter((p) => {
    const comp = compById.get(p.competitionId);
    const cat = categoryById.get(p.categoryId);
    if (year !== 'ALL' && String(comp?.year) !== year) return false;
    if (gender !== 'ALL' && cat?.gender !== gender) return false;
    if (status === 'READY' && p.status !== 'READY') return false;
    if (status === 'MISSING' && p.status === 'READY') return false;
    if (q) {
      const aka = athleteById.get(p.akaAthleteId);
      const ao = athleteById.get(p.aoAthleteId);
      const hay = `${comp?.name} ${athleteName(aka)} ${athleteName(ao)} ${aka?.countryCode} ${ao?.countryCode} ${p.kataAka} ${p.kataAo}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const groups = useMemo(() => {
    const byComp = new Map<string, Performance[]>();
    for (const p of list) {
      (byComp.get(p.competitionId) ?? byComp.set(p.competitionId, []).get(p.competitionId)!).push(p);
    }
    return [...byComp.entries()]
      .map(([compId, perfs]) => ({
        comp: compById.get(compId),
        perfs: perfs.sort(
          (a, b) =>
            (categoryById.get(a.categoryId)?.name ?? '').localeCompare(categoryById.get(b.categoryId)?.name ?? '') ||
            (ROUND_ORDER[a.roundType] ?? 9) - (ROUND_ORDER[b.roundType] ?? 9),
        ),
      }))
      .sort((a, b) => (b.comp?.dateStart ?? `${b.comp?.year ?? 0}`).localeCompare(a.comp?.dateStart ?? `${a.comp?.year ?? 0}`));
  }, [list, compById, categoryById]);

  // ---------- detalle de un encuentro ----------
  if (open) {
    const p = open;
    const comp = compById.get(p.competitionId);
    const cat = categoryById.get(p.categoryId);
    const aka = athleteById.get(p.akaAthleteId);
    const ao = athleteById.get(p.aoAthleteId);
    const judges = p.judgesCount ?? 5;
    const avgA = officialAverage(p.officialScoreAka, judges);
    const avgO = officialAverage(p.officialScoreAo, judges);
    const t = analyzePerformance(attemptsByPerf.get(p.id) ?? []);
    const winner = p.officialWinner === 'AKA' ? aka : ao;
    return (
      <>
        <button onClick={() => setOpen(null)}>← Biblioteca</button>
        <h1 style={{ marginTop: 12, fontSize: '1.3rem' }}>{comp?.name}</h1>
        <p className="muted" style={{ marginTop: -10 }}>{cat?.name} · {roundLabel(p.roundType)}</p>

        {p.videoId ? (
          <>
            {local != null && (
              <LocalVideoPlayer
                key={`local-${playerKey}`}
                src={local.url}
                startSeconds={p.startSeconds != null ? Math.max(0, p.startSeconds - local.offset) : undefined}
                endSeconds={p.endSeconds != null ? p.endSeconds - local.offset : undefined}
                controls={true}
                autoplay={false}
              />
            )}
            {local === null && (
              <div className="player-wrap">
                <YouTubePlayer key={playerKey} videoId={p.videoId} startSeconds={p.startSeconds} endSeconds={p.endSeconds} controls={true} autoplay={false} />
              </div>
            )}
            {local === undefined && <div className="player-wrap" />}
            <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setPlayerKey((k) => k + 1)}>↻ Recargar vídeo</button>
          </>
        ) : (
          <div className="card muted center">Sin vídeo</div>
        )}

        <div className="card">
          <table className="scores">
            <thead>
              <tr><th></th><th>Atleta</th><th>Kata</th><th>Total</th><th>Media</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="side-aka">AKA</td>
                <td>{athleteName(aka)} <span className="muted">({aka?.countryCode})</span></td>
                <td>{p.kataAka ?? '—'}</td>
                <td>{p.officialScoreAka?.toFixed(2) ?? '—'}</td>
                <td>{avgA?.toFixed(2) ?? '—'}</td>
              </tr>
              <tr>
                <td className="side-ao">AO</td>
                <td>{athleteName(ao)} <span className="muted">({ao?.countryCode})</span></td>
                <td>{p.kataAo ?? '—'}</td>
                <td>{p.officialScoreAo?.toFixed(2) ?? '—'}</td>
                <td>{avgO?.toFixed(2) ?? '—'}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ margin: '12px 0 0', fontWeight: 700 }}>
            🏆 {p.officialWinner} — {athleteName(winner)} ({winner?.countryCode})
            {p.judgeVotes && <span className="muted" style={{ fontWeight: 500 }}> · votos {p.judgeVotes.aka}–{p.judgeVotes.ao}</span>}
            {isCloseResult(p) && <span className="badge" style={{ marginLeft: 6, background: '#fff3e0', color: '#b56000' }}>⚖️ Ajustado</span>}
          </p>
          {p.notes && <p className="muted" style={{ marginBottom: 0 }}>{p.notes}</p>}
          {p.userNote && <p style={{ marginBottom: 0 }}>📝 {p.userNote}</p>}
          {p.examAppearances && p.examAppearances.length > 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              🎓 Exámenes: {p.examAppearances.map((a) => `${a.exam} (#${a.order})`).join(' · ')}
            </p>
          )}
        </div>

        {t.everAttempted && (
          <div className="card muted">
            Tus intentos: {t.attempts.length} · primer intento {t.firstAttempt?.isCorrectWinner ? 'acertado ✅' : 'fallado ❌'}
            {t.learned ? ' · aprendida' : ''}
          </div>
        )}
        {p.sportDataUrl && (
          <p className="muted center"><a href={p.sportDataUrl} target="_blank" rel="noreferrer">Ver en SportData</a></p>
        )}
      </>
    );
  }

  // ---------- lista ----------
  return (
    <>
      <h1>Biblioteca</h1>
      <input type="text" placeholder="Buscar atleta, país, kata o campeonato" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="ALL">Año</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="ALL">Sexo</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">Vídeo</option>
          <option value="READY">Con vídeo</option>
          <option value="MISSING">Sin vídeo</option>
        </select>
      </div>

      <h2>{list.length} encuentros · {groups.length} campeonatos</h2>
      {groups.map(({ comp, perfs }) => (
        <div key={comp?.id ?? '?'}>
          <div className="comp-header">
            <span className="name">{comp?.name}</span>
            <span className="year">{comp?.year} · {competitionTypeLabel(comp?.competitionType ?? '')}</span>
          </div>
          {perfs.map((p) => {
            const cat = categoryById.get(p.categoryId);
            const aka = athleteById.get(p.akaAthleteId);
            const ao = athleteById.get(p.aoAthleteId);
            const t = analyzePerformance(attemptsByPerf.get(p.id) ?? []);
            return (
              <div className="card perf-item" key={p.id} onClick={() => setOpen(p)} style={{ cursor: 'pointer' }}>
                <div className="meta">
                  {cat?.name} · <span className="badge round">{roundLabel(p.roundType)}</span>
                  {p.status !== 'READY' && <> <span className="badge nodata">Sin vídeo</span></>}
                  {isCloseResult(p) && <> <span className="badge" style={{ background: '#fff3e0', color: '#b56000' }}>⚖️</span></>}
                  {p.examAppearances && p.examAppearances.length > 0 && <> <span className="badge round">🎓 {p.examAppearances.length}×</span></>}
                  {t.everAttempted && <> <span className="badge nodata">{t.firstAttempt?.isCorrectWinner ? '✅' : '❌'} {t.attempts.length}</span></>}
                </div>
                <div className="who">
                  🔴 {athleteName(aka)} <span className="muted">({aka?.countryCode})</span> vs 🔵 {athleteName(ao)}{' '}
                  <span className="muted">({ao?.countryCode})</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <Link to="/kata/catalogar">
        <button className="btn-secondary" style={{ marginTop: 18 }}>Catalogar vídeos (ordenador)</button>
      </Link>
    </>
  );
}
