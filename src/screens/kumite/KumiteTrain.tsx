import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { KumiteClip, KumiteSituation } from '../../db/types';
import { KUMITE_SITUATION_LABELS } from '../../db/types';
import KumiteSession from '../../components/KumiteSession';

const SITUATIONS = Object.keys(KUMITE_SITUATION_LABELS) as KumiteSituation[];

export default function KumiteTrain() {
  const clips = useLiveQuery(() => db.kumiteClips.toArray(), []) ?? [];
  const [situation, setSituation] = useState('ALL');
  const [mode, setMode] = useState<'RANDOM' | 'BOUT'>('RANDOM');
  const [queue, setQueue] = useState<KumiteClip[] | null>(null);

  // los clips polémicos van a su propio apartado, no al entrenamiento normal
  const trainable = useMemo(() => clips.filter((c) => !c.polemic), [clips]);
  const filtered = useMemo(
    () => trainable.filter((c) => situation === 'ALL' || c.situations.includes(situation as KumiteSituation)),
    [trainable, situation],
  );

  function start() {
    const q = [...filtered];
    if (mode === 'BOUT') {
      // combate entero: en orden cronológico dentro de cada vídeo
      q.sort((a, b) => a.videoId.localeCompare(b.videoId) || a.startSeconds - b.startSeconds);
    } else {
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
    }
    setQueue(q);
  }

  if (queue) return <KumiteSession queue={queue} onExit={() => setQueue(null)} />;

  return (
    <div className="screen-fill train">
      <h1>Entrenar</h1>

      <label>Situación a practicar</label>
      <select value={situation} onChange={(e) => setSituation(e.target.value)}>
        <option value="ALL">Todas las situaciones</option>
        {SITUATIONS.map((s) => (
          <option key={s} value={s}>{KUMITE_SITUATION_LABELS[s]}</option>
        ))}
      </select>

      <label>Modo</label>
      <select value={mode} onChange={(e) => setMode(e.target.value as 'RANDOM' | 'BOUT')}>
        <option value="RANDOM">Clips aleatorios</option>
        <option value="BOUT">Combate entero (clips en orden)</option>
      </select>

      <div className="grow" />
      <button className="btn-primary" onClick={start} disabled={filtered.length === 0}>
        ENTRENAR ({filtered.length})
      </button>

      {clips.length === 0 && (
        <div className="card muted">Aún no hay clips. Catalógalos desde Biblioteca en el ordenador.</div>
      )}
    </div>
  );
}
