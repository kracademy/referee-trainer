import { useEffect, useMemo, useRef, useState } from 'react';
import { db, LOCAL_USER_ID } from '../db/db';
import type { OfficialResultType, Performance, Winner } from '../db/types';
import { isCloseResult, officialAverage } from '../db/types';
import YouTubePlayer, { type YouTubePlayerHandle } from './YouTubePlayer';
import LocalVideoPlayer from './LocalVideoPlayer';
import { findLocalVideo } from '../logic/localVideos';
import type { CatalogData } from '../logic/useCatalog';
import { roundLabel } from '../logic/format';

/** Fuente local resuelta: object URL + desfase de tiempos (clip cortado vs vídeo completo). */
type LocalSrc = { url: string; offset: number } | null | undefined; // undefined = resolviendo

type Phase = 'playing' | 'interlude' | 'playingAo' | 'decision' | 'reveal';

interface Props {
  queue: Performance[];
  data: CatalogData;
  onExit: () => void;
}

const SPECIALS: { value: OfficialResultType; label: string }[] = [
  { value: 'AKA_DISQUALIFIED', label: 'AKA desc.' },
  { value: 'AO_DISQUALIFIED', label: 'AO desc.' },
  { value: 'BOTH_DISQUALIFIED', label: 'Ambos desc.' },
];

/** Acepta coma o punto decimal. */
const num = (s: string): number | undefined => {
  const v = parseFloat(s.replace(',', '.'));
  return isNaN(v) ? undefined : v;
};

export default function TrainingSession({ queue, data, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  const [selected, setSelected] = useState<Winner | null>(null);
  const [special, setSpecial] = useState<OfficialResultType | ''>('');
  const [scoreAka, setScoreAka] = useState('');
  const [scoreAo, setScoreAo] = useState('');
  const [wasCorrect, setWasCorrect] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const perf = queue[index];
  const comp = perf ? data.compById.get(perf.competitionId) : undefined;
  const cat = perf ? data.categoryById.get(perf.categoryId) : undefined;
  const aka = perf ? data.athleteById.get(perf.akaAthleteId) : undefined;
  const ao = perf ? data.athleteById.get(perf.aoAthleteId) : undefined;

  const judges = perf?.judgesCount ?? 5;
  const avgAka = useMemo(() => officialAverage(perf?.officialScoreAka, judges), [perf, judges]);
  const avgAo = useMemo(() => officialAverage(perf?.officialScoreAo, judges), [perf, judges]);

  /** Modo separado: la actuación tiene sub-clips de AKA y AO catalogados. */
  const split =
    perf?.akaStartSeconds != null && perf?.akaEndSeconds != null &&
    perf?.aoStartSeconds != null && perf?.aoEndSeconds != null;
  // En modo separado: clip de AKA hasta el interludio; clip de AO desde entonces
  // (decision/reveal mantienen el clip de AO para no re-montar el reproductor).
  const onAkaClip = phase === 'playing' || phase === 'interlude';
  const clipStart = !split ? perf?.startSeconds : onAkaClip ? perf?.akaStartSeconds : perf?.aoStartSeconds;
  const clipEnd = !split ? perf?.endSeconds : onAkaClip ? perf?.akaEndSeconds : perf?.aoEndSeconds;
  // en exámenes, la actuación de AO puede venir de otro vídeo
  const clipVideo = (!onAkaClip && perf?.aoVideoId) || perf?.videoId;

  // Al pasar a valorar (fin de AKA, decisión, resultado) el vídeo se PARA, sea local o de YouTube
  useEffect(() => {
    if (phase === 'interlude' || phase === 'decision' || phase === 'reveal') playerRef.current?.pause();
  }, [phase]);

  // Vídeo local (sin anuncios): <performanceId>.mp4 = clip cortado; <videoId>.mp4 = vídeo completo
  const [local, setLocal] = useState<LocalSrc>(undefined);
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setLocal(undefined);
    (async () => {
      if (!perf?.id || !clipVideo) { if (alive) setLocal(null); return; }
      const clipFile = await findLocalVideo([perf.id]);
      const file = clipFile ?? (await findLocalVideo([clipVideo]));
      if (!alive) return;
      if (!file) { setLocal(null); return; }
      objUrl = URL.createObjectURL(file);
      setLocal({ url: objUrl, offset: clipFile ? (perf.startSeconds ?? 0) : 0 });
    })();
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perf?.id, clipVideo]);

  if (!perf) {
    return (
      <div className="card center">
        <p>🎉 No quedan más actuaciones en esta sesión.</p>
        <button className="btn-primary" onClick={onExit}>VOLVER</button>
      </div>
    );
  }

  async function confirmDecision() {
    if (!selected || !perf) return;
    const prior = await db.attempts.where('performanceId').equals(perf.id).count();
    const correct = selected === perf.officialWinner;
    const uAka = num(scoreAka);
    const uAo = num(scoreAo);
    await db.attempts.add({
      performanceId: perf.id,
      userId: LOCAL_USER_ID,
      attemptedAt: new Date().toISOString(),
      selectedWinner: selected,
      selectedResultType: special || (selected === 'AKA' ? 'AKA_WINS' : 'AO_WINS'),
      userScoreAka: uAka,
      userScoreAo: uAo,
      isCorrectWinner: correct,
      scoreDeviationAka: uAka != null && avgAka != null ? Math.round((uAka - avgAka) * 100) / 100 : undefined,
      scoreDeviationAo: uAo != null && avgAo != null ? Math.round((uAo - avgAo) * 100) / 100 : undefined,
      isFirstAttempt: prior === 0,
      completed: true,
    });
    setWasCorrect(correct);
    setPhase('reveal');
  }

  function next() {
    setIndex((i) => i + 1);
    setPhase('playing');
    setSelected(null);
    setSpecial('');
    setScoreAka('');
    setScoreAo('');
    setVideoError(false);
    setPlaying(false);
    setFullscreen(false);
  }

  /** Play/pausa propio según el estado REAL del reproductor (también arranca si el autoplay fue bloqueado). */
  function togglePause() {
    if (playing) playerRef.current?.pause();
    else playerRef.current?.play();
  }

  function changeRate(r: number) {
    setRate(r);
    playerRef.current?.setRate(r);
  }

  const winnerAthlete = perf.officialWinner === 'AKA' ? aka : ao;
  const winnerName = winnerAthlete ? `${winnerAthlete.displayName} (${winnerAthlete.countryCode})` : '';
  const hasScores = perf.officialScoreAka != null || perf.officialScoreAo != null;

  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>
        Actuación {index + 1} / {queue.length}
        <button style={{ float: 'right', padding: '4px 10px', fontSize: '0.75rem' }} onClick={onExit}>Salir</button>
      </div>

      {!perf.videoId && phase !== 'reveal' && (
        <div className="card center" style={{ padding: '18px 14px' }}>
          🧠 <b>Sin vídeo</b> — decide de memoria con la información de abajo.
          {phase === 'playing' && (
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setPhase('decision')}>DECIDIR</button>
          )}
        </div>
      )}

      {perf.videoId && (
      <div className={`player-wrap${fullscreen ? ' fs' : ''}`}>
        {!videoError && local != null && (
          <LocalVideoPlayer
            key={`local-${playerKey}`}
            ref={playerRef}
            src={local.url}
            startSeconds={clipStart != null ? Math.max(0, clipStart - local.offset) : undefined}
            endSeconds={clipEnd != null ? clipEnd - local.offset : undefined}
            controls={false}
            playbackRate={rate}
            onPlayingChange={setPlaying}
            onEnded={() => {
              setFullscreen(false);
              if (phase === 'playing') setPhase(split ? 'interlude' : 'decision');
              else if (phase === 'playingAo') setPhase('decision');
            }}
            onError={() => setLocal(null)}
          />
        )}
        {!videoError && local === null && (
          <YouTubePlayer
            key={playerKey}
            ref={playerRef}
            videoId={clipVideo!}
            startSeconds={clipStart}
            endSeconds={clipEnd}
            controls={false}
            playbackRate={rate}
            onPlayingChange={setPlaying}
            onEnded={() => {
              setFullscreen(false);
              if (phase === 'playing') setPhase(split ? 'interlude' : 'decision');
              else if (phase === 'playingAo') setPhase('decision');
            }}
            onError={() => setVideoError(true)}
          />
        )}
        {videoError && (
          <div className="player-overlay">
            <p>⚠️ Vídeo no disponible o no embebible.</p>
            <a href={`https://www.youtube.com/watch?v=${perf.videoId}&t=${Math.floor(perf.startSeconds ?? 0)}s`} target="_blank" rel="noreferrer">
              Abrir en YouTube
            </a>
            <button onClick={() => { setVideoError(false); setPlayerKey((k) => k + 1); }}>↻ Reintentar</button>
            <button onClick={() => setPhase('decision')}>Ya lo he visto → decidir</button>
          </div>
        )}
        {(phase === 'playing' || phase === 'playingAo') && !videoError && (
          <button className="fs-btn" onClick={() => setFullscreen(!fullscreen)} aria-label="Pantalla completa">
            {fullscreen ? '✕' : '⤢'}
          </button>
        )}
        {fullscreen && (phase === 'playing' || phase === 'playingAo') && (
          <div className="fs-controls">
            <button onClick={togglePause}>{playing ? '⏸' : '▶︎'}</button>
            <button onClick={() => { setFullscreen(false); setPhase(phase === 'playing' && split ? 'interlude' : 'decision'); }}>
              {phase === 'playing' && split ? 'FIN DE AKA' : 'FINALIZAR'}
            </button>
          </div>
        )}
        {phase !== 'playing' && phase !== 'playingAo' && !videoError && (
          <div className="player-overlay">
            {phase === 'interlude' && <p style={{ fontSize: '1.2rem', fontWeight: 800 }}><span style={{ color: '#ff6b62' }}>AKA</span> ha terminado</p>}
            {phase === 'decision' && <p style={{ fontSize: '1.3rem', fontWeight: 800 }}>¿Quién gana?</p>}
            {phase === 'reveal' && <p style={{ fontSize: '1.1rem' }}>{wasCorrect ? '✅' : '❌'} Resultado abajo</p>}
          </div>
        )}
      </div>
      )}

      {phase !== 'reveal' && (
        <div className="card perf-item" style={{ marginTop: 12 }}>
          <div className="meta">{comp?.name} · {cat?.name} · {roundLabel(perf.roundType)}</div>
          {perf.examAppearances && perf.examAppearances.length > 0 && (
            <div className="meta">
              🎓 Salió en {perf.examAppearances.length} examen{perf.examAppearances.length !== 1 ? 'es' : ''}:{' '}
              {perf.examAppearances.map((a) => `${a.exam} (#${a.order})`).join(' · ')}
            </div>
          )}
          <div className="who" style={split && phase === 'playingAo' ? { opacity: 0.45 } : undefined}>
            <span style={{ color: 'var(--aka)', fontWeight: 800 }}>{split && phase === 'playing' ? '▶ ' : ''}AKA</span> {aka?.displayName}{' '}
            <span className="muted">({aka?.countryCode})</span>
            {perf.kataAka && <span className="muted"> — {perf.kataAka}</span>}
          </div>
          <div className="who" style={split && (phase === 'playing' || phase === 'interlude') ? { opacity: 0.45 } : undefined}>
            <span style={{ color: 'var(--ao)', fontWeight: 800 }}>{split && phase === 'playingAo' ? '▶ ' : ''}AO</span> {ao?.displayName}{' '}
            <span className="muted">({ao?.countryCode})</span>
            {perf.kataAo && <span className="muted"> — {perf.kataAo}</span>}
          </div>
        </div>
      )}

      {(phase === 'playing' || phase === 'playingAo') && perf.videoId && (
        <>
          <div className="row">
            <button className="btn-secondary" style={{ flex: '0 0 30%' }} onClick={togglePause}>
              {playing ? '⏸ Pausa' : '▶︎ Reproducir'}
            </button>
            <button
              className="btn-primary"
              style={{ flex: 1, margin: '10px 0' }}
              onClick={() => setPhase(phase === 'playing' && split ? 'interlude' : 'decision')}
            >
              {phase === 'playing' && split ? 'FIN DE AKA' : 'FINALIZAR ACTUACIÓN'}
            </button>
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Velocidad</span>
            {[1, 1.5, 2].map((r) => (
              <button key={r} className={`chip${rate === r ? ' sel' : ''}`} onClick={() => changeRate(r)}>
                x{r}
              </button>
            ))}
            <button className="chip" onClick={() => setPlayerKey((k) => k + 1)} title="Recargar vídeo">
              ↻
            </button>
            {local && <span className="badge ready">🎞 Local</span>}
          </div>
        </>
      )}

      {phase === 'interlude' && (
        <>
          <div className="card">
            <label style={{ margin: '0 0 6px' }}>
              Puntuación de <span style={{ color: 'var(--aka)', fontWeight: 800 }}>AKA</span> (opcional, media por juez 5.0–10.0)
            </label>
            <input type="text" inputMode="decimal" placeholder="p. ej. 8.6" value={scoreAka} onChange={(e) => setScoreAka(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            onClick={() => setPhase('playingAo')}
          >
            🔵 VER ACTUACIÓN DE AO
          </button>
        </>
      )}

      {phase === 'decision' && (
        <>
          <div className="row" style={{ margin: '14px 0' }}>
            <button className={`btn-aka${selected === 'AKA' ? ' sel' : ''}`} onClick={() => setSelected('AKA')}>
              🔴 AKA
            </button>
            <button className={`btn-ao${selected === 'AO' ? ' sel' : ''}`} onClick={() => setSelected('AO')}>
              🔵 AO
            </button>
          </div>

          <div className="card">
            <label style={{ margin: '0 0 6px' }}>Puntuación (opcional, media por juez 5.0–10.0)</label>
            <div className="row">
              <div style={{ flex: 1 }}>
                <input type="text" inputMode="decimal" placeholder="AKA · p. ej. 8.6" value={scoreAka} onChange={(e) => setScoreAka(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <input type="text" inputMode="decimal" placeholder="AO · p. ej. 9.2" value={scoreAo} onChange={(e) => setScoreAo(e.target.value)} />
              </div>
            </div>
            <label style={{ margin: '14px 0 6px' }}>Resultado especial (opcional)</label>
            <div className="row">
              {SPECIALS.map((s) => (
                <button
                  key={s.value}
                  className={`chip${special === s.value ? ' sel' : ''}`}
                  onClick={() => setSpecial(special === s.value ? '' : s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" disabled={!selected} onClick={confirmDecision}>
            CONFIRMAR
          </button>
        </>
      )}

      {phase === 'reveal' && (
        <>
          <div className={`reveal-banner ${wasCorrect ? 'ok' : 'bad'}`}>
            {wasCorrect ? '✅ ¡CORRECTO!' : '❌ FALLASTE'}
            <div className="sub">
              Oficial: 🏆 {perf.officialWinner} — {winnerName} · Tu decisión: {selected}
            </div>
          </div>

          {perf.judgeVotes && (
            <div className="votes-big">
              <span style={{ color: 'var(--aka)' }}>AKA</span>
              <b>{perf.judgeVotes.aka} – {perf.judgeVotes.ao}</b>
              <span style={{ color: 'var(--ao)' }}>AO</span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>votos de los jueces</span>
            </div>
          )}

          {isCloseResult(perf) && (
            <div className="card" style={{ borderLeft: '4px solid #ff9500', padding: '10px 14px' }}>
              ⚖️ <b>Resultado ajustado</b>{perf.judgeVotes ? ` (${perf.judgeVotes.aka}–${perf.judgeVotes.ao})` : ''} — no te ralles si votaste distinto: aquí también dudaron los jueces.
            </div>
          )}

          <div className="card">
            <div className="muted">
              {comp?.name} ({comp?.year}) · {cat?.name} · {roundLabel(perf.roundType)}
            </div>
            <table className="scores" style={{ marginTop: 8 }}>
              <thead>
                <tr><th></th><th>Atleta</th><th>Kata</th><th>Total</th><th>Media</th><th>Tú</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="side-aka">AKA</td>
                  <td>{aka?.displayName} <span className="muted">({aka?.countryCode})</span></td>
                  <td>{perf.kataAka ?? '—'}{perf.kataAkaNumber ? <span className="muted"> #{perf.kataAkaNumber}</span> : null}</td>
                  <td>{perf.officialScoreAka?.toFixed(2) ?? '—'}</td>
                  <td>{avgAka?.toFixed(2) ?? '—'}</td>
                  <td>{scoreAka || '—'}</td>
                </tr>
                <tr>
                  <td className="side-ao">AO</td>
                  <td>{ao?.displayName} <span className="muted">({ao?.countryCode})</span></td>
                  <td>{perf.kataAo ?? '—'}{perf.kataAoNumber ? <span className="muted"> #{perf.kataAoNumber}</span> : null}</td>
                  <td>{perf.officialScoreAo?.toFixed(2) ?? '—'}</td>
                  <td>{avgAo?.toFixed(2) ?? '—'}</td>
                  <td>{scoreAo || '—'}</td>
                </tr>
              </tbody>
            </table>
            {perf.notes && <p className="muted" style={{ marginBottom: 0 }}>ℹ️ {perf.notes}</p>}
            {perf.userNote && <p style={{ marginBottom: 0 }}>📝 {perf.userNote}</p>}
            <p className="muted center" style={{ marginBottom: 0 }}>
              {hasScores && <>Media por juez = total / {judges}</>}
              {perf.sportDataUrl && (
                <> · <a href={perf.sportDataUrl} target="_blank" rel="noreferrer">SportData</a></>
              )}
              {perf.videoId && (
                <> · <a href={`https://www.youtube.com/watch?v=${perf.videoId}&t=${Math.floor(perf.startSeconds ?? 0)}s`} target="_blank" rel="noreferrer">YouTube</a></>
              )}
            </p>
          </div>

          <button className="btn-primary" onClick={next}>SIGUIENTE</button>
        </>
      )}
    </>
  );
}
