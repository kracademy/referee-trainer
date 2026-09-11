import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import type { Performance } from '../db/types';
import { TI } from './TileIcons';

/** Marca/desmarca una actuación para la lista de repaso, con nota opcional. */
export default function ReviewToggle({ perf, compact }: { perf: Performance; compact?: boolean }) {
  const live = useLiveQuery(() => db.performances.get(perf.id), [perf.id]);
  const on = live?.review ?? perf.review ?? false;
  const [note, setNote] = useState(live?.reviewNote ?? perf.reviewNote ?? '');
  useEffect(() => { setNote(live?.reviewNote ?? ''); }, [live?.reviewNote, perf.id]);

  async function toggle() {
    if (on) await db.performances.update(perf.id, { review: false });
    else await db.performances.update(perf.id, { review: true, reviewAt: new Date().toISOString() });
  }
  async function saveNote() {
    const v = note.trim();
    if (v !== (live?.reviewNote ?? '')) await db.performances.update(perf.id, { reviewNote: v || undefined });
  }

  return (
    <div>
      <button className={`review-btn${on ? ' on' : ''}`} onClick={toggle}>
        {TI.bookmark}
        {on ? 'En la lista de repaso' : 'Añadir a repaso'}
      </button>
      {on && !compact && (
        <input
          className="review-note"
          placeholder="Nota (opcional): muy igualado, discrepo de los jueces..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      )}
    </div>
  );
}
