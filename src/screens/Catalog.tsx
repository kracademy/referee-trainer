import { athleteName } from '../logic/names';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import { useCatalog } from '../logic/useCatalog';
import { computeStatus } from '../data/dataset';
import YouTubePlayer, { type YouTubePlayerHandle } from '../components/YouTubePlayer';
import { extractYouTubeId, fmtTime, parseTime, roundLabel } from '../logic/format';
import { downloadJson } from '../logic/backup';
import { listLocalVideos } from '../logic/localVideos';
import type { CatalogExport, Performance } from '../db/types';

const ROUND_ORDER: Record<string, number> = { FINAL: 2, BRONZE_1: 0, BRONZE_2: 1, OTHER: 3 };

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function Catalog() {
  const data = useCatalog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState<string | undefined>();
  const [startTxt, setStartTxt] = useState('');
  const [endTxt, setEndTxt] = useState('');
  const [offAka, setOffAka] = useState('');
  const [offAo, setOffAo] = useState('');
  const [offJudges, setOffJudges] = useState('5');
  const [akaIni, setAkaIni] = useState('');
  const [akaFin, setAkaFin] = useState('');
  const [aoIni, setAoIni] = useState('');
  const [aoFin, setAoFin] = useState('');
  const [ajustado, setAjustado] = useState(false);
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState('');
  const [showDone, setShowDone] = useState(true);
  // vídeos locales importados (por nombre base), para marcar qué encuentros ya tienen archivo
  const [localNames, setLocalNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    listLocalVideos()
      .then((l) => setLocalNames(new Set(l.map((v) => v.name.replace(/\.(mp4|m4v|mov|webm)$/i, '')))))
      .catch(() => setLocalNames(new Set()));
  }, [selectedId]);
  const hasLocal = (p: Performance) => localNames.has(p.id) || (p.videoId != null && localNames.has(p.videoId));
  const playerRef = useRef<YouTubePlayerHandle>(null);

  // formulario "añadir encuentro" (exámenes EKF/WKF u otros bouts fuera del dataset)
  const [adding, setAdding] = useState(false);
  const [nComp, setNComp] = useState('');
  const [nYear, setNYear] = useState('');
  const [nCat, setNCat] = useState('senior-female-kata');
  const [nAkaName, setNAkaName] = useState('');
  const [nAkaCc, setNAkaCc] = useState('');
  const [nAoName, setNAoName] = useState('');
  const [nAoCc, setNAoCc] = useState('');
  const [nKataA, setNKataA] = useState('');
  const [nKataO, setNKataO] = useState('');
  const [nRound, setNRound] = useState('FINAL');
  const [nWinner, setNWinner] = useState<'AKA' | 'AO' | ''>('');
  const [nTotA, setNTotA] = useState('');
  const [nTotO, setNTotO] = useState('');
  const [nJudges, setNJudges] = useState('5');

  async function saveNew() {
    const year = parseInt(nYear, 10);
    if (!nComp.trim() || isNaN(year)) { setMsg('Falta el campeonato o el año.'); return; }
    if (!nAkaName.trim() || !nAoName.trim() || nAkaCc.trim().length !== 3 || nAoCc.trim().length !== 3) {
      setMsg('Faltan los atletas (nombre + código de país de 3 letras).');
      return;
    }
    if (!nWinner) { setMsg('Marca el ganador oficial.'); return; }
    const compId = `custom-${slug(nComp)}-${year}`;
    await db.competitions.put({
      id: compId,
      name: nComp.trim(),
      year,
      dateStart: `${year}-01-01`,
      competitionType: 'OTHER',
      tier: 3,
      source: 'añadido por el usuario',
    });
    const mkAthlete = async (name: string, cc: string) => {
      const id = `custom-${slug(name)}-${slug(cc)}`;
      await db.athletes.put({ id, displayName: name.trim().toUpperCase(), country: cc.trim().toUpperCase(), countryCode: cc.trim().toUpperCase() });
      return id;
    };
    const akaId = await mkAthlete(nAkaName, nAkaCc);
    const aoId = await mkAthlete(nAoName, nAoCc);
    const perfId = `${compId}_${nCat}_${nRound.toLowerCase()}-${Date.now().toString(36)}`;
    const tA = parseFloat(nTotA.replace(',', '.'));
    const tO = parseFloat(nTotO.replace(',', '.'));
    const newPerf: Performance = {
      id: perfId,
      competitionId: compId,
      categoryId: nCat,
      roundType: nRound as Performance['roundType'],
      akaAthleteId: akaId,
      aoAthleteId: aoId,
      ...(nKataA.trim() ? { kataAka: nKataA.trim() } : {}),
      ...(nKataO.trim() ? { kataAo: nKataO.trim() } : {}),
      officialWinner: nWinner,
      officialResultType: nWinner === 'AKA' ? 'AKA_WINS' : 'AO_WINS',
      ...(!isNaN(tA) && !isNaN(tO) ? { officialScoreAka: tA, officialScoreAo: tO, judgesCount: +nJudges || 5 } : {}),
      formerExam: true,
      status: 'VIDEO_MISSING',
    };
    newPerf.status = computeStatus(newPerf);
    await db.performances.put(newPerf);
    setAdding(false);
    setNComp(''); setNYear(''); setNAkaName(''); setNAkaCc(''); setNAoName(''); setNAoCc('');
    setNKataA(''); setNKataO(''); setNWinner(''); setNTotA(''); setNTotO('');
    open(perfId); // directamente al editor para asignarle vídeo y tiempos
  }

  const perf = selectedId ? data.performances.find((p) => p.id === selectedId) : null;

  /** Competiciones en orden cronológico (año y, dentro del año, orden de SportData). */
  const groups = useMemo(() => {
    const byComp = new Map<string, Performance[]>();
    for (const p of data.performances) {
      (byComp.get(p.competitionId) ?? byComp.set(p.competitionId, []).get(p.competitionId)!).push(p);
    }
    return [...byComp.entries()]
      .map(([compId, perfs]) => ({
        comp: data.compById.get(compId),
        perfs: perfs.sort(
          (a, b) =>
            (data.categoryById.get(a.categoryId)?.name ?? '').localeCompare(data.categoryById.get(b.categoryId)?.name ?? '') ||
            (ROUND_ORDER[a.roundType] ?? 9) - (ROUND_ORDER[b.roundType] ?? 9),
        ),
        pending: perfs.filter((p) => p.status !== 'READY').length,
      }))
      .sort(
        (a, b) =>
          // más recientes primero, por fecha real del campeonato
          (b.comp?.dateStart ?? `${b.comp?.year ?? 0}`).localeCompare(a.comp?.dateStart ?? `${a.comp?.year ?? 0}`),
      );
  }, [data.performances, data.compById, data.categoryById]);

  const doneCount = data.performances.filter((p) => p.status === 'READY').length;
  const pendingCount = data.performances.length - doneCount;
  const readyNoLocal = data.performances.filter((p) => p.status === 'READY' && !hasLocal(p)).length;

  function open(id: string) {
    const p = data.performances.find((x) => x.id === id);
    setSelectedId(id);
    setVideoId(p?.videoId);
    setUrlInput(p?.videoId ? `https://www.youtube.com/watch?v=${p.videoId}` : '');
    setStartTxt(p?.startSeconds != null ? fmtTime(p.startSeconds) : '');
    setEndTxt(p?.endSeconds != null ? fmtTime(p.endSeconds) : '');
    setOffAka(p?.officialScoreAka != null ? String(p.officialScoreAka) : '');
    setOffAo(p?.officialScoreAo != null ? String(p.officialScoreAo) : '');
    setOffJudges(String(p?.judgesCount ?? 5));
    setAkaIni(p?.akaStartSeconds != null ? fmtTime(p.akaStartSeconds) : '');
    setAkaFin(p?.akaEndSeconds != null ? fmtTime(p.akaEndSeconds) : '');
    setAoIni(p?.aoStartSeconds != null ? fmtTime(p.aoStartSeconds) : '');
    setAoFin(p?.aoEndSeconds != null ? fmtTime(p.aoEndSeconds) : '');
    setAjustado(p?.closeResult ?? false);
    setNota(p?.userNote ?? '');
    setMsg('');
  }

  function applyUrl(raw?: string) {
    const id = extractYouTubeId(raw ?? urlInput);
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

  async function save() {
    if (!perf) return;
    const start = parseTime(startTxt);
    const end = parseTime(endTxt);
    if (!videoId) { setMsg('Falta el vídeo.'); return; }
    if (start == null || end == null || end <= start) { setMsg('Revisa los timestamps (el fin debe ser posterior al inicio).'); return; }
    await db.videos.put({
      id: videoId,
      platform: 'YOUTUBE',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      availabilityStatus: 'AVAILABLE',
      lastChecked: new Date().toISOString(),
    });
    const updated = { ...perf, videoId, startSeconds: start, endSeconds: end };
    // puntuaciones oficiales vistas en el vídeo (opcional)
    const nAka = parseFloat(offAka.replace(',', '.'));
    const nAo = parseFloat(offAo.replace(',', '.'));
    if (!isNaN(nAka) && !isNaN(nAo)) {
      updated.officialScoreAka = nAka;
      updated.officialScoreAo = nAo;
      updated.judgesCount = +offJudges || 5;
    }
    // sub-clips por atleta (opcional, ambos tiempos del atleta o ninguno)
    const aIni = parseTime(akaIni), aFin = parseTime(akaFin);
    const oIni = parseTime(aoIni), oFin = parseTime(aoFin);
    if (aIni != null && aFin != null && aFin > aIni) { updated.akaStartSeconds = aIni; updated.akaEndSeconds = aFin; }
    else { delete updated.akaStartSeconds; delete updated.akaEndSeconds; }
    if (oIni != null && oFin != null && oFin > oIni) { updated.aoStartSeconds = oIni; updated.aoEndSeconds = oFin; }
    else { delete updated.aoStartSeconds; delete updated.aoEndSeconds; }
    // resultado ajustado + nota del usuario (se muestran en el reveal, tras decidir)
    if (ajustado) updated.closeResult = true; else delete updated.closeResult;
    const n = nota.trim();
    if (n) updated.userNote = n; else delete updated.userNote;
    updated.status = computeStatus(updated);
    await db.performances.put(updated);
    setMsg(`✅ Guardado (${fmtTime(start)} → ${fmtTime(end)}, duración ${fmtTime(end - start)}).`);
  }

  async function exportCatalog() {
    const hasVideo = (p: Performance) => p.videoId && p.startSeconds != null && p.endSeconds != null;
    const entries = (await db.performances.toArray())
      .filter((p) => hasVideo(p) || p.formerExam || p.closeResult || p.userNote)
      .map((p) => ({
        performanceId: p.id,
        ...(hasVideo(p) ? { videoId: p.videoId!, startSeconds: p.startSeconds!, endSeconds: p.endSeconds! } : {}),
        ...(p.officialScoreAka != null ? { officialScoreAka: p.officialScoreAka, officialScoreAo: p.officialScoreAo, judgesCount: p.judgesCount } : {}),
        ...(p.akaStartSeconds != null ? { akaStartSeconds: p.akaStartSeconds, akaEndSeconds: p.akaEndSeconds } : {}),
        ...(p.aoStartSeconds != null ? { aoStartSeconds: p.aoStartSeconds, aoEndSeconds: p.aoEndSeconds } : {}),
        ...(p.closeResult ? { closeResult: true } : {}),
        ...(p.userNote ? { note: p.userNote } : {}),
        ...(p.formerExam ? { formerExam: true } : {}),
      }));
    const out: CatalogExport = { schemaVersion: 1, exportedAt: new Date().toISOString(), entries };
    // encuentros creados a mano: viajan completos para incorporarlos al dataset
    const customPerfs = (await db.performances.toArray()).filter((p) => p.competitionId.startsWith('custom-'));
    if (customPerfs.length) {
      out.custom = {
        competitions: (await db.competitions.toArray()).filter((c) => c.id.startsWith('custom-')),
        athletes: (await db.athletes.toArray()).filter((a) => a.id.startsWith('custom-')),
        performances: customPerfs,
      };
    }
    downloadJson(out, `kata-trainer-catalogo-${new Date().toISOString().slice(0, 10)}.json`);
  }

  if (adding) {
    return (
      <>
        <button onClick={() => setAdding(false)}>← Volver a la lista</button>
        <h1 style={{ marginTop: 12, fontSize: '1.4rem' }}>Añadir encuentro</h1>
        <p className="muted">
          Para encuentros que no están en el dataset (p. ej. los de exámenes EKF/WKF de otros años). Se marca
          automáticamente como 🎓 Former Exam y, al guardar, podrás asignarle el vídeo.
        </p>

        <label>Campeonato</label>
        <div className="row">
          <input type="text" placeholder="p. ej. EKF Senior Championships - Gaziantep" value={nComp} onChange={(e) => setNComp(e.target.value)} />
          <input type="text" inputMode="numeric" placeholder="Año" value={nYear} onChange={(e) => setNYear(e.target.value)} style={{ flex: '0 0 26%' }} />
        </div>

        <label>Categoría</label>
        <select value={nCat} onChange={(e) => setNCat(e.target.value)}>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label style={{ color: 'var(--aka)' }}>AKA (arriba del bracket)</label>
        <div className="row">
          <input type="text" placeholder="APELLIDOS NOMBRE" value={nAkaName} onChange={(e) => setNAkaName(e.target.value)} />
          <input type="text" placeholder="ESP" maxLength={3} value={nAkaCc} onChange={(e) => setNAkaCc(e.target.value.toUpperCase())} style={{ flex: '0 0 22%' }} />
        </div>
        <input type="text" placeholder="Kata de AKA (opcional)" value={nKataA} onChange={(e) => setNKataA(e.target.value)} style={{ marginTop: 8 }} />

        <label style={{ color: 'var(--ao)' }}>AO (abajo del bracket)</label>
        <div className="row">
          <input type="text" placeholder="APELLIDOS NOMBRE" value={nAoName} onChange={(e) => setNAoName(e.target.value)} />
          <input type="text" placeholder="ITA" maxLength={3} value={nAoCc} onChange={(e) => setNAoCc(e.target.value.toUpperCase())} style={{ flex: '0 0 22%' }} />
        </div>
        <input type="text" placeholder="Kata de AO (opcional)" value={nKataO} onChange={(e) => setNKataO(e.target.value)} style={{ marginTop: 8 }} />

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Ronda</label>
            <select value={nRound} onChange={(e) => setNRound(e.target.value)}>
              <option value="FINAL">Final</option>
              <option value="BRONZE_1">Bronce 1</option>
              <option value="BRONZE_2">Bronce 2</option>
              <option value="OTHER">Otra ronda</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Ganador oficial</label>
            <div className="row">
              <button className={`chip${nWinner === 'AKA' ? ' sel' : ''}`} onClick={() => setNWinner('AKA')}>🔴 AKA</button>
              <button className={`chip${nWinner === 'AO' ? ' sel' : ''}`} onClick={() => setNWinner('AO')} style={nWinner === 'AO' ? { background: 'var(--ao)' } : undefined}>🔵 AO</button>
            </div>
          </div>
        </div>

        <label>Puntuaciones oficiales (opcional)</label>
        <div className="row">
          <input type="text" inputMode="decimal" placeholder="Total AKA" value={nTotA} onChange={(e) => setNTotA(e.target.value)} />
          <input type="text" inputMode="decimal" placeholder="Total AO" value={nTotO} onChange={(e) => setNTotO(e.target.value)} />
          <select value={nJudges} onChange={(e) => setNJudges(e.target.value)} style={{ flex: '0 0 30%' }}>
            <option value="5">5 jueces</option>
            <option value="7">7 jueces</option>
            <option value="3">3 (70/30)</option>
          </select>
        </div>

        <button className="btn-primary" onClick={saveNew}>GUARDAR Y ASIGNAR VÍDEO</button>
        {msg && <div className="card" role="status">{msg}</div>}
      </>
    );
  }

  if (perf) {
    const comp = data.compById.get(perf.competitionId);
    const cat = data.categoryById.get(perf.categoryId);
    const aka = data.athleteById.get(perf.akaAthleteId);
    const ao = data.athleteById.get(perf.aoAthleteId);
    const start = parseTime(startTxt);
    const end = parseTime(endTxt);
    const candidates = comp?.candidateVideos ?? [];
    return (
      <>
        <button onClick={() => setSelectedId(null)}>← Volver a la lista</button>
        <h1 style={{ marginTop: 12, fontSize: '1.4rem' }}>{comp?.name}</h1>
        <div className="card perf-item">
          <div className="meta">{cat?.name} · {roundLabel(perf.roundType)}</div>
          <div className="who">
            🔴 {athleteName(aka)} <span className="muted">({aka?.countryCode})</span> vs 🔵 {athleteName(ao)}{' '}
            <span className="muted">({ao?.countryCode})</span>
          </div>
          <div className="meta">Katas: {perf.kataAka ?? '—'} / {perf.kataAo ?? '—'} · Ganador oficial: {perf.officialWinner}</div>
          <div className="meta">
            {perf.officialScoreAka != null
              ? <span className="badge ready">Puntuaciones: {perf.officialScoreAka} – {perf.officialScoreAo}</span>
              : perf.judgeVotes
                ? <span className="badge nodata">Votos {perf.judgeVotes.aka}–{perf.judgeVotes.ao} · sin totales en SportData</span>
                : <span className="badge missing">⚠️ Sin puntuaciones oficiales</span>}
          </div>
          {perf.sportDataUrl && <a href={perf.sportDataUrl} target="_blank" rel="noreferrer">Ver en SportData</a>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={perf.formerExam ?? false}
              onChange={(e) => db.performances.update(perf.id, { formerExam: e.target.checked || undefined })}
              style={{ width: 'auto', margin: 0 }}
            />
            🎓 Former Exam EKF/WKF (se guarda al instante; entrenable aparte, incluso sin vídeo)
          </label>
        </div>

        {candidates.length > 0 && (
          <>
            <label>Vídeos candidatos (canal WKF · Live)</label>
            <select value={videoId && candidates.some((c) => c.id === videoId) ? videoId : ''} onChange={(e) => e.target.value && applyUrl(e.target.value)}>
              <option value="">— Elegir emisión del campeonato —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </>
        )}
        <a
          href={`https://www.youtube.com/@WKFKarateWorldChamps/search?query=${encodeURIComponent(
            `${comp?.name?.replace(/^(WKF|Karate1|Karate One)\s*/i, '').split('-').pop()?.trim() ?? ''}`,
          )}`}
          target="_blank"
          rel="noreferrer"
        >
          <button className="btn-secondary">🔎 Buscar emisiones en el canal WKF</button>
        </a>

        <label>URL de YouTube</label>
        <div className="row">
          <input type="url" placeholder="https://www.youtube.com/watch?v=…" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          <button onClick={() => applyUrl()}>Cargar</button>
        </div>

        {videoId && (
          <>
            <div className="player-wrap" style={{ marginTop: 12 }}>
              <YouTubePlayer ref={playerRef} videoId={videoId} autoplay={false} onError={() => setMsg('⚠️ Este vídeo no permite reproducción embebida.')} />
            </div>
            <p className="muted">
              ⚠️ Marca el FIN <b>antes</b> de que el marcador muestre las puntuaciones, para no ver spoilers al entrenar.
            </p>
            <div className="row">
              <button className="btn-secondary" onClick={() => mark(setStartTxt)}>🚩 MARCAR INICIO</button>
              <button className="btn-secondary" onClick={() => mark(setEndTxt)}>🏁 MARCAR FIN</button>
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Inicio</label>
                <input type="text" placeholder="01:23:14" value={startTxt} onChange={(e) => setStartTxt(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Fin</label>
                <input type="text" placeholder="01:28:02" value={endTxt} onChange={(e) => setEndTxt(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Duración</label>
                <input type="text" readOnly value={start != null && end != null && end > start ? fmtTime(end - start) : '—'} />
              </div>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ margin: '0 0 6px' }}>Tiempos por atleta (opcional · entrena AKA y AO por separado + modo estudio)</label>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="btn-secondary" style={{ margin: 0, color: 'var(--aka)' }} onClick={() => mark(setAkaIni)}>🚩 AKA</button>
                <button className="btn-secondary" style={{ margin: 0, color: 'var(--aka)' }} onClick={() => mark(setAkaFin, true)}>🏁 AKA</button>
                <button className="btn-secondary" style={{ margin: 0, color: 'var(--ao)' }} onClick={() => mark(setAoIni)}>🚩 AO</button>
                <button className="btn-secondary" style={{ margin: 0, color: 'var(--ao)' }} onClick={() => mark(setAoFin, true)}>🏁 AO</button>
              </div>
              <div className="row">
                <input type="text" placeholder="Inicio AKA" value={akaIni} onChange={(e) => setAkaIni(e.target.value)} />
                <input type="text" placeholder="Fin AKA" value={akaFin} onChange={(e) => setAkaFin(e.target.value)} />
                <input type="text" placeholder="Inicio AO" value={aoIni} onChange={(e) => setAoIni(e.target.value)} />
                <input type="text" placeholder="Fin AO" value={aoFin} onChange={(e) => setAoFin(e.target.value)} />
              </div>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={ajustado} onChange={(e) => setAjustado(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                ⚖️ Resultado ajustado (se avisará tras decidir: no dudes de ti)
              </label>
              <label style={{ margin: '12px 0 6px' }}>Nota (opcional, se muestra tras decidir)</label>
              <input
                type="text"
                placeholder="p. ej. Los miembros de la comisión votaron a AKA"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>
            {perf.officialScoreAka == null && (
              <div className="card" style={{ marginTop: 12 }}>
                <label style={{ margin: '0 0 6px' }}>Puntuaciones oficiales (si se ven en el vídeo)</label>
                <div className="row">
                  <input type="text" inputMode="decimal" placeholder="Total AKA" value={offAka} onChange={(e) => setOffAka(e.target.value)} />
                  <input type="text" inputMode="decimal" placeholder="Total AO" value={offAo} onChange={(e) => setOffAo(e.target.value)} />
                  <select value={offJudges} onChange={(e) => setOffJudges(e.target.value)} style={{ flex: '0 0 30%' }}>
                    <option value="5">5 jueces</option>
                    <option value="7">7 jueces</option>
                    <option value="3">3 (70/30)</option>
                  </select>
                </div>
              </div>
            )}
            <button className="btn-primary" onClick={save}>GUARDAR</button>
          </>
        )}
        {msg && <div className="card" role="status">{msg}</div>}
      </>
    );
  }

  return (
    <>
      <h1>Catalogar vídeos</h1>
      <p className="muted">Asigna vídeo y tiempos a cada encuentro. Al terminar, exporta el catálogo.</p>
      <button className="btn-primary" onClick={() => { setMsg(''); setAdding(true); }}>
        ➕ AÑADIR ENCUENTRO
      </button>
      <div className="row">
        <button className="btn-secondary" onClick={exportCatalog} disabled={doneCount === 0}>
          ⬇️ Exportar catálogo ({doneCount})
        </button>
        <button className="btn-secondary" onClick={() => setShowDone((s) => !s)}>
          {showDone ? 'Ocultar listas' : 'Ver listas'}
        </button>
      </div>
      <p className="muted center">
        {pendingCount} pendientes · {doneCount} listas · 🎞 {doneCount - readyNoLocal} con vídeo local
        {readyNoLocal > 0 && <> · <b style={{ color: '#b56000' }}>⬇ {readyNoLocal} por descargar</b></>}
      </p>

      {groups.map(({ comp, perfs, pending }) => {
        if (!comp) return null;
        const visible = perfs.filter((p) => (showDone ? true : p.status !== 'READY'));
        if (!visible.length) return null;
        return (
          <div key={comp.id}>
            <div className="comp-header">
              <span className="name">{comp.name}</span>
              <span className="year">{comp.year} · {pending} pdte.</span>
            </div>
            {visible.map((p) => {
              const cat = data.categoryById.get(p.categoryId);
              const aka = data.athleteById.get(p.akaAthleteId);
              const ao = data.athleteById.get(p.aoAthleteId);
              const ready = p.status === 'READY';
              return (
                <div className="card perf-item" key={p.id}>
                  <div className="meta">
                    {cat?.name} · <span className="badge round">{roundLabel(p.roundType)}</span>{' '}
                    {ready
                      ? <span className="badge ready">🟢 {fmtTime(p.startSeconds)} → {fmtTime(p.endSeconds)}</span>
                      : p.videoId
                        ? <span className="badge nodata">🎥 Vídeo asignado, faltan tiempos</span>
                        : <span className="badge nodata">⚪ Sin vídeo</span>}{' '}
                    {ready && (p.akaStartSeconds != null && p.aoStartSeconds != null
                      ? <span className="badge ready">🎬 AKA/AO</span>
                      : <span className="badge nodata">⏱ Sin tiempos AKA/AO</span>)}{' '}
                    {ready && (hasLocal(p)
                      ? <span className="badge ready">🎞 Local</span>
                      : <span className="badge" style={{ background: 'rgba(255,149,0,0.14)', color: '#b56000' }}>⬇ Por descargar</span>)}
                  </div>
                  <div className="who">
                    🔴 {athleteName(aka)} <span className="muted">({aka?.countryCode})</span> vs 🔵 {athleteName(ao)}{' '}
                    <span className="muted">({ao?.countryCode})</span>
                  </div>
                  <button onClick={() => open(p.id)}>{ready ? 'Editar' : 'CATALOGAR'}</button>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
