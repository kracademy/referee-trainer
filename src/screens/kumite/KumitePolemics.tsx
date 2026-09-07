import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { KumiteClip } from '../../db/types';
import { KUMITE_CALL_LABELS, KUMITE_SITUATION_LABELS } from '../../db/types';
import YouTubePlayer from '../../components/YouTubePlayer';
import { fmtTime } from '../../logic/format';

export default function KumitePolemics() {
  const clips = useLiveQuery(() => db.kumiteClips.filter((c) => c.polemic === true).toArray(), []) ?? [];
  const [open, setOpen] = useState<KumiteClip | null>(null);

  if (open) {
    return (
      <>
        <h1 style={{ fontSize: '1.4rem' }}>🔥 {open.title || 'Situación polémica'}</h1>
        <div className="player-wrap">
          <YouTubePlayer
            videoId={open.videoId}
            startSeconds={open.startSeconds}
            endSeconds={open.revealEndSeconds ?? open.endSeconds}
            controls={true}
          />
        </div>
        <div className="card perf-item" style={{ marginTop: 12 }}>
          <div className="meta">
            {open.situations.map((s) => (
              <span key={s} className="badge round" style={{ marginRight: 4 }}>Polémica + {KUMITE_SITUATION_LABELS[s]}</span>
            ))}
          </div>
          <div className="who">
            Decisión real: {open.decisionSide !== 'NONE' ? `${open.decisionSide} · ` : ''}{KUMITE_CALL_LABELS[open.decisionCall]}
            {open.decisionDetail ? ` — ${open.decisionDetail}` : ''}
          </div>
          {open.polemicNote && <p style={{ marginBottom: 0 }}>🔥 <b>Por qué es polémica:</b> {open.polemicNote}</p>}
          {open.explanation && <p style={{ marginBottom: 0 }}>💡 {open.explanation}</p>}
          {open.competitionName && <div className="meta">{open.competitionName}</div>}
        </div>
        <button className="btn-primary" onClick={() => setOpen(null)}>← VOLVER</button>
      </>
    );
  }

  return (
    <>
      <h1>Situaciones polémicas</h1>
      <p className="muted">Decisiones que generaron debate, con su explicación. No entran en el entrenamiento normal.</p>
      <h2>{clips.length} situaciones</h2>
      {clips.map((c) => (
        <div className="card perf-item" key={c.id} onClick={() => setOpen(c)} style={{ cursor: 'pointer' }}>
          <div className="who">{c.title || KUMITE_CALL_LABELS[c.decisionCall]}</div>
          <div className="meta">
            {c.situations.map((s) => (
              <span key={s} className="badge missing" style={{ marginRight: 4 }}>Polémica + {KUMITE_SITUATION_LABELS[s]}</span>
            ))}
          </div>
          <div className="meta">
            {c.decisionSide !== 'NONE' ? `${c.decisionSide} · ` : ''}{KUMITE_CALL_LABELS[c.decisionCall]} · {fmtTime(c.startSeconds)}
            {c.competitionName ? ` · ${c.competitionName}` : ''}
          </div>
        </div>
      ))}
    </>
  );
}
