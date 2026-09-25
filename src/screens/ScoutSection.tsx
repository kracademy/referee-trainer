import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { ScoutAthlete, ScoutFile, ScoutKata } from '../db/types';
import { exportScout, importScout } from '../logic/scout';
import { downloadJson } from '../logic/backup';
import YouTubePlayer, { type YouTubePlayerHandle } from '../components/YouTubePlayer';
import LocalVideoPlayer from '../components/LocalVideoPlayer';
import { findLocalVideo, listLocalVideos } from '../logic/localVideos';
import { extractYouTubeId, extractYouTubeStart, fmtTime, parseTime } from '../logic/format';
import { CAMERA_LABELS, CAMERA_RECTS, type Camera } from '../logic/crop';

/**
 * Club Karate Swing: scouting personal de rivales (competidores y sus katas).
 * Vive en tablas propias (scoutAthletes / scoutKatas): nunca aparece en Entrenar,
 * Biblioteca, Stats ni en el dataset público.
 */

type View =
  | { k: 'list' }
  | { k: 'athlete'; id: string }
  | { k: 'athleteForm'; id?: string }
  | { k: 'kataForm'; athleteId: string; id?: string }
  | { k: 'play'; id: string };

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function fmtDate(d?: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return day && m ? `${day}/${m}/${y}` : d;
}

/** Más reciente primero; los que no tienen fecha, al final. */
const byRecent = (a: ScoutKata, b: ScoutKata) =>
  (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt.localeCompare(a.createdAt);

function kataMeta(k: ScoutKata): string {
  return [fmtDate(k.date), k.competition, k.category, k.round].filter(Boolean).join(' · ');
}

/** "vs Rival (CAT) · 22.3 – 20.6" */
function vsLine(k: ScoutKata): string {
  const who = k.opponent ? `vs ${k.opponent}${k.opponentClub ? ` (${k.opponentClub})` : ''}` : '';
  const sc = k.score || k.opponentScore ? `${k.score ?? '—'} – ${k.opponentScore ?? '—'}` : '';
  return [who, sc].filter(Boolean).join(' · ');
}

function Judges({ js }: { js?: { v: string; ok: boolean }[] }) {
  if (!js?.length) return null;
  return (
    <span className="scout-judges">
      {js.map((j, i) => <span key={i} className={j.ok ? 'ok' : 'off'}>{j.v}</span>)}
    </span>
  );
}

const NO_KATA = 'Sin registrar';

/** Selector de cámara: vídeo completo o un recuadro del mosaico (de 4 o de 3 tatamis). */
function CameraPicker({ value, onChange }: { value?: Camera; onChange: (c?: Camera) => void }) {
  const quad: [Camera, number, number][] = [['TL', 1, 1], ['TR', 12, 1], ['BL', 1, 8], ['BR', 12, 8]];
  const tri: [Camera, number, number][] = [['T3', 7, 1], ['BL3', 1, 8], ['BR3', 13, 8]];
  const icon = (cells: [Camera, number, number][], sel: Camera) => (
    <svg width="26" height="16" viewBox="0 0 24 15" aria-hidden="true">
      {cells.map(([c, x, y]) => (
        <rect key={c} x={x} y={y} width="10" height="6" rx="1.2" fill={c === sel ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" />
      ))}
    </svg>
  );
  const btn = (cells: [Camera, number, number][], c: Camera) => (
    <button key={c} className={`chip cam${value === c ? ' sel' : ''}`} onClick={() => onChange(c)} title={CAMERA_LABELS[c]} aria-label={CAMERA_LABELS[c]}>
      {icon(cells, c)}
    </button>
  );
  return (
    <div className="cam-picker-wrap" role="group" aria-label="Cámara">
      <div className="cam-picker">
        <button className={`chip${!value ? ' sel' : ''}`} onClick={() => onChange(undefined)}>Completo</button>
        {quad.map(([c]) => btn(quad, c))}
      </div>
      <div className="cam-picker">
        <span className="cam-picker-label">3 cámaras</span>
        {tri.map(([c]) => btn(tri, c))}
      </div>
    </div>
  );
}

/** Controles propios para YouTube recortado (los nativos quedan fuera del recuadro). */
function CropBar({ player, playing, start }: { player: React.RefObject<YouTubePlayerHandle | null>; playing: boolean; start?: number }) {
  const jump = (d: number) => { const t = player.current?.getCurrentTime(); if (t != null) player.current?.seekTo(Math.max(0, t + d)); };
  return (
    <div className="crop-bar">
      <button onClick={() => player.current?.seekTo(start ?? 0)} aria-label="Al inicio del tramo">⏮</button>
      <button onClick={() => jump(-5)} aria-label="Atrás 5 segundos">−5 s</button>
      <button className="main" onClick={() => (playing ? player.current?.pause() : player.current?.play())} aria-label={playing ? 'Pausa' : 'Reproducir'}>{playing ? '⏸' : '▶︎'}</button>
      <button onClick={() => jump(5)} aria-label="Adelante 5 segundos">+5 s</button>
      <button onClick={() => jump(1)} aria-label="Adelante 1 segundo">+1 s</button>
    </div>
  );
}

/** Búsqueda en YouTube con competición, nombre y kata. */
function ytSearch(k: ScoutKata, athleteName: string): string {
  const q = [k.competition, athleteName, k.kata !== NO_KATA ? k.kata : '', k.category?.replace(/^Kata\s*/i, '')].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function ResultBadge({ r }: { r?: ScoutKata['result'] }) {
  if (r === 'WIN') return <span className="badge ready">Ganó</span>;
  if (r === 'LOSS') return <span className="badge missing">Perdió</span>;
  return null;
}

interface Props {
  /** Título + selector Individual/Equipos/Club: solo se pinta en la lista principal. */
  header: ReactNode;
  /** Katas conocidos (del catálogo) para autocompletar. */
  kataNames: string[];
}

export default function ScoutSection({ header, kataNames }: Props) {
  const athletes = useLiveQuery(() => db.scoutAthletes.toArray(), []) ?? [];
  const katas = useLiveQuery(() => db.scoutKatas.toArray(), []) ?? [];
  const [localNames, setLocalNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    listLocalVideos()
      .then((vs) => setLocalNames(new Set(vs.map((v) => v.name.replace(/\.(mp4|m4v|mov|webm)$/i, '')))))
      .catch(() => undefined);
  }, []);
  const [view, setView] = useState<View>({ k: 'list' });

  const katasBy = useMemo(() => {
    const m = new Map<string, ScoutKata[]>();
    for (const k of katas) (m.get(k.athleteId) ?? m.set(k.athleteId, []).get(k.athleteId)!).push(k);
    for (const l of m.values()) l.sort(byRecent);
    return m;
  }, [katas]);

  const allKataNames = useMemo(
    () => [...new Set([...kataNames, ...katas.map((k) => k.kata)])].sort((a, b) => a.localeCompare(b)),
    [kataNames, katas],
  );
  const competitions = useMemo(
    () => [...new Set(katas.map((k) => k.competition).filter(Boolean) as string[])].sort(),
    [katas],
  );

  if (view.k === 'athleteForm') {
    const a = view.id ? athletes.find((x) => x.id === view.id) : undefined;
    return (
      <AthleteForm
        athlete={a}
        existingIds={athletes.map((x) => x.id)}
        onDone={(id) => setView(id ? { k: 'athlete', id } : { k: 'list' })}
        onCancel={() => setView(a ? { k: 'athlete', id: a.id } : { k: 'list' })}
      />
    );
  }

  if (view.k === 'kataForm') {
    const a = athletes.find((x) => x.id === view.athleteId);
    const k = view.id ? katas.find((x) => x.id === view.id) : undefined;
    if (!a) return null;
    return (
      <KataForm
        athlete={a}
        kata={k}
        kataNames={allKataNames}
        competitions={competitions}
        existingIds={katas.map((x) => x.id)}
        onDone={(id) => setView(id ? { k: 'play', id } : { k: 'athlete', id: a.id })}
        onCancel={() => setView(k ? { k: 'play', id: k.id } : { k: 'athlete', id: a.id })}
      />
    );
  }

  if (view.k === 'play') {
    const k = katas.find((x) => x.id === view.id);
    const a = k && athletes.find((x) => x.id === k.athleteId);
    if (!k || !a) return null;
    return (
      <KataPlayer
        kata={k}
        athlete={a}
        onBack={() => setView({ k: 'athlete', id: a.id })}
        onEdit={() => setView({ k: 'kataForm', athleteId: a.id, id: k.id })}
      />
    );
  }

  if (view.k === 'athlete') {
    const a = athletes.find((x) => x.id === view.id);
    if (!a) return null;
    return (
      <AthleteDetail
        athlete={a}
        katas={katasBy.get(a.id) ?? []}
        localNames={localNames}
        onBack={() => setView({ k: 'list' })}
        onEdit={() => setView({ k: 'athleteForm', id: a.id })}
        onAddKata={() => setView({ k: 'kataForm', athleteId: a.id })}
        onPlay={(id) => setView({ k: 'play', id })}
      />
    );
  }

  return (
    <AthleteList
      header={header}
      athletes={athletes}
      katasBy={katasBy}
      onOpen={(id) => setView({ k: 'athlete', id })}
      onAdd={() => setView({ k: 'athleteForm' })}
    />
  );
}

// ─── Lista de competidores ──────────────────────────────────────────────────

function AthleteList({
  header, athletes, katasBy, onOpen, onAdd,
}: {
  header: ReactNode;
  athletes: ScoutAthlete[];
  katasBy: Map<string, ScoutKata[]>;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport() {
    const data = await exportScout();
    downloadJson(data, `club-karate-swing-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg(`Exportados ${data.athletes.length} competidores y ${data.katas.length} katas.`);
  }
  async function doImport(f: File) {
    try {
      const r = await importScout(JSON.parse(await f.text()) as ScoutFile);
      setMsg(`Importados ${r.athletes} competidores y ${r.katas} katas (${r.nuevos} nuevos).`);
    } catch (e) {
      setMsg(`No se ha podido importar: ${e instanceof Error ? e.message : e}`);
    }
  }

  const list = athletes
    .filter((a) => !q || `${a.name} ${a.club ?? ''} ${a.country ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const da = katasBy.get(a.id)?.[0]?.date ?? '';
      const dbb = katasBy.get(b.id)?.[0]?.date ?? '';
      return dbb.localeCompare(da) || a.name.localeCompare(b.name);
    });

  return (
    <>
      {header}
      <button className="btn-primary" onClick={onAdd}>+ AÑADIR COMPETIDOR</button>
      {athletes.length > 0 && (
        <input type="text" placeholder="Buscar competidor…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {athletes.length === 0 && (
        <div className="card muted">
          Añade los competidores que te interesan y sus katas. Solo se ven aquí: no salen en Entrenar ni en la Biblioteca.
        </div>
      )}
      {athletes.length > 0 && <h2>{list.length} competidor{list.length !== 1 ? 'es' : ''}</h2>}
      {list.map((a) => {
        const ks = katasBy.get(a.id) ?? [];
        const counts = new Map<string, number>();
        for (const k of ks) if (k.kata !== NO_KATA) counts.set(k.kata, (counts.get(k.kata) ?? 0) + 1);
        const rep = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
        const last = ks[0];
        return (
          <div className="card perf-item" key={a.id} onClick={() => onOpen(a.id)} style={{ cursor: 'pointer' }}>
            <div className="who">{a.name}</div>
            {(a.club || a.country) && <div className="meta">{[a.club, a.country].filter(Boolean).join(' · ')}</div>}
            <div className="meta">
              {ks.length} kata{ks.length !== 1 ? 's' : ''}
              {last ? ` · último: ${[fmtDate(last.date), last.competition].filter(Boolean).join(', ')}` : ''}
            </div>
            {rep.length > 0 && (
              <div className="scout-rep">
                {rep.map(([k, n]) => (
                  <span className="badge round" key={k}>{k}{n > 1 ? ` ×${n}` : ''}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn-secondary" style={{ flex: 1, margin: 0 }} onClick={() => fileRef.current?.click()}>Importar</button>
        <button className="btn-secondary" style={{ flex: 1, margin: 0 }} onClick={doExport} disabled={!athletes.length}>Exportar</button>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) doImport(f); }} />
      {msg && <p className="muted center">{msg}</p>}
    </>
  );
}

// ─── Ficha del competidor ───────────────────────────────────────────────────

function AthleteDetail({
  athlete, katas, localNames, onBack, onEdit, onAddKata, onPlay,
}: {
  athlete: ScoutAthlete;
  katas: ScoutKata[];
  localNames: Set<string>;
  onBack: () => void;
  onEdit: () => void;
  onAddKata: () => void;
  onPlay: (id: string) => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const k of katas) if (k.kata !== NO_KATA) counts.set(k.kata, (counts.get(k.kata) ?? 0) + 1);
  const rep = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  const list = filter ? katas.filter((k) => k.kata === filter) : katas;
  const wins = katas.filter((k) => k.result === 'WIN').length;
  const losses = katas.filter((k) => k.result === 'LOSS').length;

  return (
    <>
      <div className="mod-topbar">
        <h1 style={{ margin: 0 }}>{athlete.name}</h1>
        <button className="switch-btn" onClick={onEdit}>Editar</button>
      </div>
      {(athlete.club || athlete.country) && (
        <p className="muted" style={{ marginTop: 0 }}>{[athlete.club, athlete.country].filter(Boolean).join(' · ')}</p>
      )}
      {athlete.notes && <div className="card">📝 {athlete.notes}</div>}
      <button className="btn-secondary" onClick={onBack}>← Competidores</button>

      <h2>Repertorio</h2>
      {rep.length === 0 ? (
        <div className="card muted">Aún no hay katas de {athlete.name}.</div>
      ) : (
        <>
          <div className="scout-rep" style={{ marginBottom: 6 }}>
            {rep.map(([k, n]) => (
              <button key={k} className={`chip scout-chip${filter === k ? ' sel' : ''}`} onClick={() => setFilter(filter === k ? null : k)}>
                {k}{n > 1 ? ` ×${n}` : ''}
              </button>
            ))}
          </div>
          {(wins > 0 || losses > 0) && (
            <p className="muted" style={{ margin: '4px 0 0' }}>{wins} ganado{wins !== 1 ? 's' : ''} · {losses} perdido{losses !== 1 ? 's' : ''}</p>
          )}
        </>
      )}

      <button className="btn-primary" onClick={onAddKata}>+ AÑADIR KATA</button>

      {list.length > 0 && <h2>{filter ? filter : 'Katas'} · {list.length}</h2>}
      {list.map((k) => (
        <div className="card perf-item" key={k.id} onClick={() => onPlay(k.id)} style={{ cursor: 'pointer' }}>
          <div className="who">{k.kata} <ResultBadge r={k.result} /></div>
          {kataMeta(k) && <div className="meta">{kataMeta(k)}</div>}
          {vsLine(k) && <div className="meta">{vsLine(k)}{k.opponentKata ? ` (${k.opponentKata})` : ''}</div>}
          {k.notes && <div className="meta">📝 {k.notes}</div>}
          <div className="meta">
            {localNames.has(k.id) || (k.videoId && localNames.has(k.videoId))
              ? <span className="badge ready">🎞 Local</span>
              : k.videoId ? <span className="badge round">YouTube</span>
              : k.url ? <span className="badge round">Enlace</span>
              : <span className="badge nodata">Sin vídeo</span>}
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Alta / edición de competidor ───────────────────────────────────────────

function AthleteForm({
  athlete, existingIds, onDone, onCancel,
}: {
  athlete?: ScoutAthlete;
  existingIds: string[];
  onDone: (id?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(athlete?.name ?? '');
  const [club, setClub] = useState(athlete?.club ?? '');
  const [country, setCountry] = useState(athlete?.country ?? '');
  const [notes, setNotes] = useState(athlete?.notes ?? '');
  const [msg, setMsg] = useState('');

  async function save() {
    const n = name.trim();
    if (!n) { setMsg('Falta el nombre.'); return; }
    let id = athlete?.id;
    if (!id) {
      const base = `swing-${slug(n) || 'competidor'}`;
      id = base;
      for (let i = 2; existingIds.includes(id); i++) id = `${base}-${i}`;
    }
    await db.scoutAthletes.put({
      id, name: n,
      club: club.trim() || undefined,
      country: country.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: athlete?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onDone(id);
  }

  async function remove() {
    if (!athlete) return;
    const n = await db.scoutKatas.where('athleteId').equals(athlete.id).count();
    if (!confirm(`¿Eliminar a ${athlete.name}${n ? ` y sus ${n} kata${n !== 1 ? 's' : ''}` : ''}?`)) return;
    await db.transaction('rw', db.scoutAthletes, db.scoutKatas, async () => {
      await db.scoutKatas.where('athleteId').equals(athlete.id).delete();
      await db.scoutAthletes.delete(athlete.id);
    });
    onDone(undefined);
  }

  return (
    <>
      <h1>{athlete ? 'Editar competidor' : 'Nuevo competidor'}</h1>
      <label className="field-label">Nombre</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Osama" autoFocus />
      <label className="field-label">Club</label>
      <input type="text" value={club} onChange={(e) => setClub(e.target.value)} placeholder="Opcional" />
      <label className="field-label">Federación / país</label>
      <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Opcional" />
      <label className="field-label">Notas</label>
      <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Categoría, puntos fuertes, qué vigilar…" />
      {msg && <p style={{ color: 'var(--aka)' }}>{msg}</p>}
      <button className="btn-primary" onClick={save}>GUARDAR</button>
      <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
      {athlete && <button className="btn-secondary danger" onClick={remove}>Eliminar competidor</button>}
    </>
  );
}

// ─── Alta / edición de kata ─────────────────────────────────────────────────

function KataForm({
  athlete, kata, kataNames, competitions, existingIds, onDone, onCancel,
}: {
  athlete: ScoutAthlete;
  kata?: ScoutKata;
  kataNames: string[];
  competitions: string[];
  existingIds: string[];
  onDone: (id?: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(kata?.url ?? (kata?.videoId ? `https://www.youtube.com/watch?v=${kata.videoId}` : ''));
  const [startTxt, setStartTxt] = useState(kata?.startSeconds != null ? fmtTime(kata.startSeconds) : '');
  const [endTxt, setEndTxt] = useState(kata?.endSeconds != null ? fmtTime(kata.endSeconds) : '');
  const [name, setName] = useState(kata?.kata ?? '');
  const [competition, setCompetition] = useState(kata?.competition ?? '');
  const [date, setDate] = useState(kata?.date ?? '');
  const [round, setRound] = useState(kata?.round ?? '');
  const [result, setResult] = useState<ScoutKata['result']>(kata?.result);
  const [score, setScore] = useState(kata?.score ?? '');
  const [category, setCategory] = useState(kata?.category ?? '');
  const [opponent, setOpponent] = useState(kata?.opponent ?? '');
  const [opponentKata, setOpponentKata] = useState(kata?.opponentKata ?? '');
  const [opponentScore, setOpponentScore] = useState(kata?.opponentScore ?? '');
  const [camera, setCamera] = useState<Camera | undefined>(kata?.camera);
  const [formPlaying, setFormPlaying] = useState(false);
  const [notes, setNotes] = useState(kata?.notes ?? '');
  const [msg, setMsg] = useState('');
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const videoId = extractYouTubeId(url);
  // el vídeo arranca en el inicio ya marcado o donde diga el enlace (?t=)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playerStart = useMemo(() => parseTime(startTxt) ?? extractYouTubeStart(url), [videoId]);

  function onUrl(v: string) {
    setUrl(v);
    const t = extractYouTubeStart(v);
    if (t != null && !startTxt) setStartTxt(fmtTime(t));
  }

  function mark(setter: (v: string) => void) {
    const t = playerRef.current?.getCurrentTime();
    if (t == null) { setMsg('El vídeo aún no está listo.'); return; }
    setter(fmtTime(t));
    setMsg('');
  }

  async function save() {
    const k = name.trim();
    if (!k) { setMsg('Falta el nombre del kata.'); return; }
    const start = parseTime(startTxt);
    const end = parseTime(endTxt);
    if (startTxt.trim() && start == null) { setMsg('Inicio no válido (usa 12:34 o 1:02:03).'); return; }
    if (endTxt.trim() && end == null) { setMsg('Fin no válido (usa 12:34 o 1:02:03).'); return; }
    if (start != null && end != null && end <= start) { setMsg('El fin debe ser posterior al inicio.'); return; }
    let id = kata?.id;
    if (!id) {
      const base = `${athlete.id}-${date || new Date().toISOString().slice(0, 10)}-${slug(k)}`;
      id = base;
      for (let i = 2; existingIds.includes(id); i++) id = `${base}-${i}`;
    }
    const u = url.trim();
    await db.scoutKatas.put({
      ...kata,
      id,
      athleteId: athlete.id,
      category: category.trim() || undefined,
      opponent: opponent.trim() || undefined,
      opponentKata: opponentKata.trim() || undefined,
      opponentScore: opponentScore.trim() || undefined,
      camera,
      updatedAt: new Date().toISOString(),
      kata: k,
      videoId: videoId,
      url: u || undefined,
      startSeconds: start,
      endSeconds: end,
      competition: competition.trim() || undefined,
      date: date || undefined,
      round: round.trim() || undefined,
      result,
      score: score.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: kata?.createdAt ?? new Date().toISOString(),
    });
    onDone(id);
  }

  async function remove() {
    if (!kata) return;
    if (!confirm(`¿Eliminar ${kata.kata}${kata.competition ? ` (${kata.competition})` : ''}?`)) return;
    await db.scoutKatas.delete(kata.id);
    onDone(undefined);
  }

  return (
    <>
      <h1>{kata ? 'Editar kata' : 'Nuevo kata'}</h1>
      <p className="muted" style={{ marginTop: -6 }}>{athlete.name}</p>

      <label className="field-label">Vídeo</label>
      <input type="url" value={url} onChange={(e) => onUrl(e.target.value)} placeholder="Enlace de YouTube" />
      {videoId && (
        <div className="player-wrap" style={{ marginTop: 8 }}>
          <YouTubePlayer key={videoId} ref={playerRef} videoId={videoId} startSeconds={playerStart} autoplay={false} controls={true} crop={camera ? CAMERA_RECTS[camera] : undefined} onPlayingChange={setFormPlaying} />
        </div>
      )}
      {videoId && camera && <CropBar player={playerRef} playing={formPlaying} start={parseTime(startTxt)} />}
      {videoId && (
        <>
          <label className="field-label">Cámara</label>
          <CameraPicker value={camera} onChange={setCamera} />
        </>
      )}
      {url.trim() && !videoId && <p className="muted" style={{ margin: '6px 0 0' }}>Enlace externo: se abrirá aparte.</p>}
      {!url.trim() && (
        <p style={{ margin: '6px 0 0' }}>
          <a href={ytSearch({ ...(kata ?? { id: '', athleteId: athlete.id, createdAt: '' }), kata: name || NO_KATA, competition: competition || kata?.competition } as ScoutKata, athlete.name)} target="_blank" rel="noreferrer">Buscar en YouTube ↗</a>
        </p>
      )}

      <div className="grid2" style={{ marginTop: 10 }}>
        <div>
          <label className="field-label">Inicio</label>
          <input type="text" inputMode="numeric" value={startTxt} onChange={(e) => setStartTxt(e.target.value)} placeholder="12:34" />
          {videoId && <button className="btn-secondary scout-mark" onClick={() => mark(setStartTxt)}>Marcar inicio</button>}
        </div>
        <div>
          <label className="field-label">Fin</label>
          <input type="text" inputMode="numeric" value={endTxt} onChange={(e) => setEndTxt(e.target.value)} placeholder="15:10" />
          {videoId && <button className="btn-secondary scout-mark" onClick={() => mark(setEndTxt)}>Marcar fin</button>}
        </div>
      </div>

      <label className="field-label">Kata</label>
      <input type="text" list="scout-kata-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Suparinpei" />
      <datalist id="scout-kata-names">{kataNames.map((k) => <option key={k} value={k} />)}</datalist>

      <label className="field-label">Competición</label>
      <input type="text" list="scout-competitions" value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="p. ej. Campeonato de España Sub-21 2026" />
      <datalist id="scout-competitions">{competitions.map((c) => <option key={c} value={c} />)}</datalist>

      <label className="field-label">Categoría</label>
      <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="p. ej. Kata Junior Masc" />

      <div className="grid2">
        <div>
          <label className="field-label">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Ronda</label>
          <input type="text" value={round} onChange={(e) => setRound(e.target.value)} placeholder="Final, Ronda 2…" />
        </div>
      </div>

      <label className="field-label">Resultado</label>
      <div className="row">
        <button className={`chip${result === 'WIN' ? ' sel' : ''}`} onClick={() => setResult(result === 'WIN' ? undefined : 'WIN')}>Ganó</button>
        <button className={`chip${result === 'LOSS' ? ' sel' : ''}`} onClick={() => setResult(result === 'LOSS' ? undefined : 'LOSS')}>Perdió</button>
      </div>
      <input type="text" value={score} onChange={(e) => setScore(e.target.value)} placeholder="Su puntuación (opcional): 22.3 · 3-2" style={{ marginTop: 8 }} />

      <label className="field-label">Rival</label>
      <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Nombre (opcional)" />
      <div className="grid2" style={{ marginTop: 8 }}>
        <input type="text" list="scout-kata-names" value={opponentKata} onChange={(e) => setOpponentKata(e.target.value)} placeholder="Su kata" />
        <input type="text" value={opponentScore} onChange={(e) => setOpponentScore(e.target.value)} placeholder="Su puntuación" />
      </div>

      <label className="field-label">Notas</label>
      <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qué destacar, errores, ritmo…" />

      {msg && <p style={{ color: 'var(--aka)' }}>{msg}</p>}
      <button className="btn-primary" onClick={save}>GUARDAR</button>
      <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
      {kata && <button className="btn-secondary danger" onClick={remove}>Eliminar kata</button>}
      {kata && (kata.sourceUrl || kata.videoId) && (
        <div className="card scout-links">
          {kata.sourceUrl && <a href={kata.sourceUrl} target="_blank" rel="noreferrer">Hoja de resultados ↗</a>}
          {kata.videoId && (
            <a href={`https://www.youtube.com/watch?v=${kata.videoId}&t=${Math.floor(kata.startSeconds ?? 0)}s`} target="_blank" rel="noreferrer">Ver en YouTube ↗</a>
          )}
          {kata.videoId && <div className="muted">Vídeo local: <code>{kata.id}.mp4</code></div>}
        </div>
      )}
    </>
  );
}

// ─── Reproductor ────────────────────────────────────────────────────────────

function KataPlayer({
  kata, athlete, onBack, onEdit,
}: {
  kata: ScoutKata;
  athlete: ScoutAthlete;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [playerKey, setPlayerKey] = useState(0);
  const ytRef = useRef<YouTubePlayerHandle>(null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const crop = kata.camera ? CAMERA_RECTS[kata.camera] : undefined;
  // vídeo local: clip "<id>.mp4" (empieza en el inicio del kata) o vídeo completo "<videoId>.mp4"
  const [local, setLocal] = useState<{ url: string; offset: number } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setLocal(undefined);
    (async () => {
      const clipFile = await findLocalVideo([kata.id]);
      const file = clipFile ?? (kata.videoId ? await findLocalVideo([kata.videoId]) : null);
      if (!alive) return;
      if (!file) { setLocal(null); return; }
      objUrl = URL.createObjectURL(file);
      setLocal({ url: objUrl, offset: clipFile ? (kata.startSeconds ?? 0) : 0 });
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [kata.id, kata.videoId, kata.startSeconds]);

  const range = kata.startSeconds != null || kata.endSeconds != null
    ? `${fmtTime(kata.startSeconds ?? 0)}${kata.endSeconds != null ? ` – ${fmtTime(kata.endSeconds)}` : ''}`
    : '';

  return (
    <>
      <div className="mod-topbar">
        <h1 style={{ margin: 0 }}>{kata.kata}</h1>
        <button className="switch-btn" onClick={onEdit}>Editar</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{athlete.name}</p>

      {local != null && (
        <LocalVideoPlayer
          key={`local-${playerKey}`}
          src={local.url}
          startSeconds={kata.startSeconds != null ? Math.max(0, kata.startSeconds - local.offset) : undefined}
          endSeconds={kata.endSeconds != null ? kata.endSeconds - local.offset : undefined}
          controls={true}
          crop={crop}
        />
      )}
      {local === null && kata.videoId && (
        <div className="player-wrap">
          <YouTubePlayer key={playerKey} ref={ytRef} videoId={kata.videoId} startSeconds={kata.startSeconds} endSeconds={kata.endSeconds} controls={true} crop={crop} onPlayingChange={setYtPlaying} />
        </div>
      )}
      {local === null && kata.videoId && crop && <CropBar player={ytRef} playing={ytPlaying} start={kata.startSeconds} />}
      {local === null && !kata.videoId && kata.url && (
        <div className="card center">
          <a href={kata.url} target="_blank" rel="noreferrer">Abrir vídeo ↗</a>
          {range && <div className="muted" style={{ marginTop: 4 }}>Del {range.replace(' – ', ' al ')}</div>}
        </div>
      )}
      {local === null && !kata.videoId && !kata.url && (
        <div className="card center">
          <button className="btn-primary" style={{ margin: 0 }} onClick={onEdit}>+ AÑADIR VÍDEO</button>
          <p style={{ margin: '10px 0 0' }}><a href={ytSearch(kata, athlete.name)} target="_blank" rel="noreferrer">Buscar en YouTube ↗</a></p>
        </div>
      )}
      {local === undefined && <div className="player-wrap" />}
      {local === null && kata.videoId && (
        <button className="scout-reload" onClick={() => setPlayerKey((k) => k + 1)}>↻ Recargar vídeo</button>
      )}

      <div className="card scout-sheet">
        <div className="scout-sheet-top">
          {kata.side && <span className={`scout-side ${kata.side === 'AKA' ? 'aka' : 'ao'}`}>{kata.side}</span>}
          <ResultBadge r={kata.result} />
        </div>
        {kata.competition && <div className="scout-sheet-comp">{kata.competition}</div>}
        <div className="meta">
          {[fmtDate(kata.date), kata.place, kata.category?.replace(/^Kata\s+/i, ''), kata.round].filter(Boolean).join(' · ')}
        </div>
        {(kata.score || kata.opponent) && (
          <div className="scout-vs">
            <div className={`scout-vs-row${kata.result === 'WIN' ? ' win' : ''}`}>
              <div className="who-col">
                <div className="name">{athlete.name}</div>
                <div className="sub">{kata.kata}</div>
                <Judges js={kata.judges} />
              </div>
              <div className="total">{kata.score ?? '—'}</div>
            </div>
            {kata.opponent && (
              <div className={`scout-vs-row${kata.result === 'LOSS' ? ' win' : ''}`}>
                <div className="who-col">
                  <div className="name">{kata.opponent}{kata.opponentClub ? <span className="club"> {kata.opponentClub}</span> : null}</div>
                  {kata.opponentKata && <div className="sub">{kata.opponentKata}</div>}
                  <Judges js={kata.opponentJudges} />
                </div>
                <div className="total">{kata.opponentScore ?? '—'}</div>
              </div>
            )}
          </div>
        )}
        {kata.notes && <div className="scout-note">📝 {kata.notes}</div>}
      </div>
      <button className="btn-primary" onClick={onBack}>← {athlete.name.toUpperCase()}</button>
    </>
  );
}
