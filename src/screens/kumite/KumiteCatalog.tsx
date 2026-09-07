import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { KumiteCall, KumiteClip, KumiteSide, KumiteSituation } from '../../db/types';
import { KUMITE_CALL_LABELS, KUMITE_QUIZ_TEMPLATES, KUMITE_SITUATION_LABELS } from '../../db/types';
import YouTubePlayer, { type YouTubePlayerHandle } from '../../components/YouTubePlayer';
import { extractYouTubeId, fmtTime, parseTime } from '../../logic/format';
import { downloadJson } from '../../logic/backup';

const SITUATIONS = Object.keys(KUMITE_SITUATION_LABELS) as KumiteSituation[];
const CALLS = Object.keys(KUMITE_CALL_LABELS) as KumiteCall[];

export default function KumiteCatalog() {
  const clips = useLiveQuery(() => db.kumiteClips.toArray(), []) ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState<string | undefined>();
  const [iniTxt, setIniTxt] = useState('');
  const [finTxt, setFinTxt] = useState('');
  const [revTxt, setRevTxt] = useState('');
  const [title, setTitle] = useState('');
  const [compName, setCompName] = useState('');
  const [akaName, setAkaName] = useState('');
  const [aoName, setAoName] = useState('');
  const [situations, setSituations] = useState<KumiteSituation[]>([]);
  const [side, setSide] = useState<KumiteSide>('NONE');
  const [call, setCall] = useState<KumiteCall>('NO_ACTION');
  const [detail, setDetail] = useState('');
  const [explanation, setExplanation] = useState('');
  const [polemic, setPolemic] = useState(false);
  const [polemicNote, setPolemicNote] = useState('');
  const [quizAo, setQuizAo] = useState<{ text: string; correct: boolean }[]>([]);
  const [quizAka, setQuizAka] = useState<{ text: string; correct: boolean }[]>([]);
  const [timeTxt, setTimeTxt] = useState('');
  const [atoshi, setAtoshi] = useState(false);
  const [msg, setMsg] = useState('');
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const editorOpen = creating || editingId != null;

  function resetForm(c?: KumiteClip) {
    setVideoId(c?.videoId);
    setUrlInput(c?.videoId ? `https://www.youtube.com/watch?v=${c.videoId}` : '');
    setIniTxt(c ? fmtTime(c.startSeconds) : '');
    setFinTxt(c ? fmtTime(c.endSeconds) : '');
    setRevTxt(c?.revealEndSeconds != null ? fmtTime(c.revealEndSeconds) : '');
    setTitle(c?.title ?? '');
    setCompName(c?.competitionName ?? '');
    setAkaName(c?.akaName ?? '');
    setAoName(c?.aoName ?? '');
    setSituations(c?.situations ?? []);
    setSide(c?.decisionSide ?? 'NONE');
    setCall(c?.decisionCall ?? 'NO_ACTION');
    setDetail(c?.decisionDetail ?? '');
    setExplanation(c?.explanation ?? '');
    setPolemic(c?.polemic ?? false);
    setPolemicNote(c?.polemicNote ?? '');
    setQuizAo(c?.quizAo ?? []);
    setQuizAka(c?.quizAka ?? []);
    setTimeTxt(c?.timeRemaining ?? '');
    setAtoshi(c?.atoShibaraku ?? false);
    setMsg('');
  }

  function openNew() {
    setEditingId(null);
    setCreating(true);
    // conservar el vídeo cargado para encadenar clips del mismo combate
    const keepVideo = videoId;
    resetForm();
    if (keepVideo) {
      setVideoId(keepVideo);
      setUrlInput(`https://www.youtube.com/watch?v=${keepVideo}`);
    }
  }

  function openEdit(c: KumiteClip) {
    setCreating(false);
    setEditingId(c.id);
    resetForm(c);
  }

  function applyUrl() {
    const id = extractYouTubeId(urlInput);
    if (!id) { setMsg('URL de YouTube no reconocida.'); return; }
    setVideoId(id);
    setUrlInput(`https://www.youtube.com/watch?v=${id}`);
    setMsg('');
  }

  function mark(setter: (v: string) => void, pauseAfter = false) {
    const t = playerRef.current?.getCurrentTime();
    if (t == null) { setMsg('El reproductor aún no está listo.'); return; }
    setter(fmtTime(t));
    if (pauseAfter) playerRef.current?.pause();
    setMsg('');
  }

  function toggleSituation(s: KumiteSituation) {
    const adding = !situations.includes(s);
    setSituations((prev) => (adding ? [...prev, s] : prev.filter((x) => x !== s)));
    // al marcar la primera situación con el quiz vacío, precarga sus respuestas en las dos columnas
    if (adding && quizAo.length === 0 && quizAka.length === 0) preloadQuiz([s]);
  }

  /** Precarga el quiz desde las plantillas de las situaciones (unión sin duplicados, "Nada" al final). */
  function preloadQuiz(sits: KumiteSituation[]) {
    const texts: string[] = [];
    for (const s of sits) for (const t of KUMITE_QUIZ_TEMPLATES[s] ?? []) {
      if (t !== 'Nada' && !texts.includes(t)) texts.push(t);
    }
    texts.push('Nada');
    const opts = texts.map((text) => ({ text, correct: false }));
    setQuizAo(opts);
    setQuizAka(opts.map((o) => ({ ...o })));
  }

  async function save() {
    const ini = parseTime(iniTxt);
    const fin = parseTime(finTxt);
    const rev = parseTime(revTxt);
    if (!videoId) { setMsg('Falta el vídeo.'); return; }
    if (ini == null || fin == null || fin <= ini) { setMsg('Revisa inicio/fin del clip.'); return; }
    if (situations.length === 0) { setMsg('Marca al menos una situación.'); return; }
    if (call !== 'NO_ACTION' && call !== 'WAKARETE' && call !== 'TSUZUKETE' && side === 'NONE') {
      setMsg('Indica a quién afecta la decisión (AKA/AO).');
      return;
    }
    const clean = (l: { text: string; correct: boolean }[]) => l.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    const qAo = clean(quizAo);
    const qAka = clean(quizAka);
    const hasQuiz = qAo.length > 0 || qAka.length > 0;
    if (hasQuiz && (qAo.length < 2 || qAka.length < 2 || !qAo.some((o) => o.correct) || !qAka.some((o) => o.correct))) {
      setMsg('El quiz necesita al menos 2 respuestas por columna y alguna correcta (✓) en AO y en AKA (marca "Nada" si a ese lado no le da nada).');
      return;
    }
    const clip: KumiteClip = {
      id: editingId ?? `k-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`,
      videoId,
      startSeconds: ini,
      endSeconds: fin,
      ...(rev != null && rev > fin ? { revealEndSeconds: rev } : {}),
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(compName.trim() ? { competitionName: compName.trim() } : {}),
      ...(akaName.trim() ? { akaName: akaName.trim() } : {}),
      ...(aoName.trim() ? { aoName: aoName.trim() } : {}),
      situations,
      decisionSide: side,
      decisionCall: call,
      ...(detail.trim() ? { decisionDetail: detail.trim() } : {}),
      ...(explanation.trim() ? { explanation: explanation.trim() } : {}),
      ...(polemic ? { polemic: true } : {}),
      ...(polemic && polemicNote.trim() ? { polemicNote: polemicNote.trim() } : {}),
      ...(hasQuiz ? { quizAo: qAo, quizAka: qAka } : {}),
      ...(timeTxt.trim() ? { timeRemaining: timeTxt.trim() } : {}),
      ...(atoshi ? { atoShibaraku: true } : {}),
      createdAt: new Date().toISOString(),
    };
    await db.kumiteClips.put(clip);
    setMsg(`✅ Clip guardado (${fmtTime(ini)} → ${fmtTime(fin)}).`);
    if (creating) openNew();
    else setEditingId(clip.id);
  }

  async function removeClip() {
    if (!editingId) return;
    await db.kumiteClips.delete(editingId);
    setEditingId(null);
    setCreating(false);
  }

  async function exportClips() {
    const all = await db.kumiteClips.toArray();
    downloadJson(
      { schemaVersion: 1, exportedAt: new Date().toISOString(), clips: all },
      `kumite-catalogo-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  if (editorOpen) {
    return (
      <>
        <button onClick={() => { setCreating(false); setEditingId(null); }}>← Volver a la lista</button>
        <h1 style={{ marginTop: 12, fontSize: '1.4rem' }}>{editingId ? 'Editar clip' : 'Nuevo clip de kumite'}</h1>

        <label>URL de YouTube</label>
        <div className="row">
          <input type="url" placeholder="https://www.youtube.com/watch?v=…" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          <button onClick={applyUrl}>Cargar</button>
        </div>

        {videoId && (
          <>
            <div className="player-wrap" style={{ marginTop: 12 }}>
              <YouTubePlayer ref={playerRef} videoId={videoId} autoplay={false} onError={() => setMsg('⚠️ Este vídeo no permite reproducción embebida.')} />
            </div>
            <p className="muted">
              El clip debe acabar justo cuando el árbitro para (YAME), <b>antes</b> de ver la decisión. "Fin señalización"
              (opcional) marca hasta dónde seguir para ver lo que da de verdad.
            </p>
            <div className="row">
              <button className="btn-secondary" style={{ margin: 0 }} onClick={() => mark(setIniTxt)}>🚩 INICIO</button>
              <button className="btn-secondary" style={{ margin: 0 }} onClick={() => mark(setFinTxt, true)}>🏁 FIN (YAME)</button>
              <button className="btn-secondary" style={{ margin: 0 }} onClick={() => mark(setRevTxt, true)}>📢 FIN SEÑALIZACIÓN</button>
            </div>
            <div className="row">
              <input type="text" placeholder="Inicio" value={iniTxt} onChange={(e) => setIniTxt(e.target.value)} />
              <input type="text" placeholder="Fin (yame)" value={finTxt} onChange={(e) => setFinTxt(e.target.value)} />
              <input type="text" placeholder="Fin señaliz. (opc.)" value={revTxt} onChange={(e) => setRevTxt(e.target.value)} />
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ margin: '0 0 6px' }}>Situaciones (una o varias)</label>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {SITUATIONS.map((s) => (
                  <button key={s} className={`chip${situations.includes(s) ? ' sel' : ''}`} onClick={() => toggleSituation(s)}>
                    {KUMITE_SITUATION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ margin: '0 0 6px' }}>Decisión real del árbitro central</label>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className={`chip${side === 'AKA' ? ' sel' : ''}`} style={{ color: side === 'AKA' ? undefined : 'var(--aka)' }} onClick={() => setSide('AKA')}>AKA</button>
                <button className={`chip${side === 'AO' ? ' sel' : ''}`} style={{ color: side === 'AO' ? undefined : 'var(--ao)' }} onClick={() => setSide('AO')}>AO</button>
                <button className={`chip${side === 'NONE' ? ' sel' : ''}`} onClick={() => setSide('NONE')}>Nadie</button>
              </div>
              <select value={call} onChange={(e) => setCall(e.target.value as KumiteCall)}>
                {CALLS.map((c) => (
                  <option key={c} value={c}>{KUMITE_CALL_LABELS[c]}</option>
                ))}
              </select>
              <input type="text" placeholder="Detalle (opc.), p. ej. 2º Chui por agarre" value={detail} onChange={(e) => setDetail(e.target.value)} style={{ marginTop: 8 }} />
              <input type="text" placeholder="Explicación didáctica (se muestra tras decidir)" value={explanation} onChange={(e) => setExplanation(e.target.value)} style={{ marginTop: 8 }} />
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ margin: '0 0 6px' }}>⏱ Marcador (opcional)</label>
              <div className="row" style={{ alignItems: 'center' }}>
                <input type="text" placeholder="Tiempo restante, p. ej. 0:14" value={timeTxt} onChange={(e) => setTimeTxt(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer', flex: '0 0 auto' }}>
                  <input type="checkbox" checked={atoshi} onChange={(e) => setAtoshi(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  Últimos 15 s (Ato Shibaraku)
                </label>
              </div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ margin: '0 0 6px' }}>
                🃏 Quiz: respuestas en orden fijo, "Nada" la última. Marca con ✓ la(s) correcta(s) de CADA columna
                (si a un lado no le da nada, su correcta es "Nada").
              </label>
              <button className="btn-secondary" style={{ margin: '0 0 10px' }} onClick={() => preloadQuiz(situations)} disabled={situations.length === 0}>
                ⚡ Precargar respuestas según la situación
              </button>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                {([
                  { side: 'AO', list: quizAo, set: setQuizAo, color: 'var(--ao)' },
                  { side: 'AKA', list: quizAka, set: setQuizAka, color: 'var(--aka)' },
                ] as const).map(({ side: colSide, list, set, color }) => (
                  <div key={colSide} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>
                      {colSide === 'AO' ? '🔵 AO' : '🔴 AKA'}
                    </div>
                    {list.map((o, i) => (
                      <div className="row" key={i} style={{ marginBottom: 6, alignItems: 'center', gap: 4 }}>
                        <button
                          className={`chip${o.correct ? ' sel' : ''}`}
                          style={{ flex: '0 0 auto' }}
                          onClick={() => set(list.map((x, j) => (j === i ? { ...x, correct: !x.correct } : x)))}
                          title="Marcar como correcta"
                        >
                          {o.correct ? '✓' : '·'}
                        </button>
                        <input
                          type="text"
                          value={o.text}
                          placeholder={`Respuesta ${i + 1}`}
                          onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                        />
                        <button style={{ flex: '0 0 auto', padding: '8px 8px' }} onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                    <button className="btn-secondary" style={{ margin: 0, width: '100%' }} onClick={() => set([...list, { text: '', correct: false }])}>
                      ➕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={polemic} onChange={(e) => setPolemic(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                🔥 Situación polémica (va a su propio apartado, no al entrenamiento normal)
              </label>
              {polemic && (
                <input type="text" placeholder="Por qué es polémica" value={polemicNote} onChange={(e) => setPolemicNote(e.target.value)} style={{ marginTop: 10 }} />
              )}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ margin: '0 0 6px' }}>Contexto (opcional)</label>
              <input type="text" placeholder="Título corto, p. ej. Agarre y ura mawashi" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input type="text" placeholder="Campeonato" value={compName} onChange={(e) => setCompName(e.target.value)} style={{ marginTop: 8 }} />
              <div className="row" style={{ marginTop: 8 }}>
                <input type="text" placeholder="AKA (opc.)" value={akaName} onChange={(e) => setAkaName(e.target.value)} />
                <input type="text" placeholder="AO (opc.)" value={aoName} onChange={(e) => setAoName(e.target.value)} />
              </div>
            </div>

            <button className="btn-primary" onClick={save}>GUARDAR CLIP</button>
            {creating && <p className="muted center">Al guardar se abre otro clip nuevo con el mismo vídeo cargado.</p>}
            {editingId && <button className="btn-secondary" onClick={removeClip}>🗑 Borrar este clip</button>}
          </>
        )}
        {msg && <div className="card" role="status">{msg}</div>}
      </>
    );
  }

  const sorted = [...clips].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <h1>Catalogar kumite</h1>
      <p className="muted">Corta cada acción hasta el YAME, etiqueta la situación y registra la decisión del central.</p>
      <div className="row">
        <button className="btn-primary" style={{ flex: 1 }} onClick={openNew}>➕ NUEVO CLIP</button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={exportClips} disabled={clips.length === 0}>
          ⬇️ Exportar ({clips.length})
        </button>
      </div>
      <Link to="/kumite/biblioteca"><button className="btn-secondary">← Biblioteca</button></Link>

      <h2>{clips.length} clips</h2>
      {sorted.map((c) => (
        <div className="card perf-item" key={c.id}>
          <div className="who">
            {c.title || KUMITE_CALL_LABELS[c.decisionCall]}
            {c.polemic && <span className="badge missing" style={{ marginLeft: 6 }}>🔥 Polémica</span>}
          </div>
          <div className="meta">
            {c.decisionSide !== 'NONE' ? `${c.decisionSide} · ` : ''}{KUMITE_CALL_LABELS[c.decisionCall]}
            {c.decisionDetail ? ` — ${c.decisionDetail}` : ''} · {fmtTime(c.startSeconds)}→{fmtTime(c.endSeconds)}
          </div>
          <div className="meta">
            {c.situations.map((s) => (
              <span key={s} className="badge round" style={{ marginRight: 4 }}>{KUMITE_SITUATION_LABELS[s]}</span>
            ))}
          </div>
          <button onClick={() => openEdit(c)}>Editar</button>
        </div>
      ))}
    </>
  );
}
