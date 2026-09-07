import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { TI } from '../../components/TileIcons';

export default function KumiteHome() {
  const nav = useNavigate();
  const clips = useLiveQuery(() => db.kumiteClips.toArray(), []) ?? [];
  const attempts = useLiveQuery(() => db.kumiteAttempts.toArray(), []) ?? [];

  const trainable = clips.filter((c) => !c.polemic);
  const polemics = clips.length - trainable.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const bouts = new Set(clips.map((c) => c.videoId)).size;

  return (
    <div className="screen-fill">
      <div className="mod-topbar">
        <h1 style={{ margin: 0 }}>Kumite</h1>
        <button className="switch-btn" onClick={() => nav('/')}>‹ Módulos</button>
      </div>

      <div className="home-grid">
        <div className="stat-tile">
          <span className="ic" style={{ color: '#007aff' }}>{TI.film}</span>
          <div className="v">{trainable.length}</div>
          <div className="l">Clips para entrenar</div>
        </div>
        <div className="stat-tile">
          <span className="ic" style={{ color: '#34c759' }}>{TI.target}</span>
          <div className={`v${attempts.length === 0 ? ' na' : ''}`}>
            {attempts.length === 0 ? '—' : `${Math.round((correct / attempts.length) * 100)}%`}
          </div>
          <div className="l">Aciertos ({attempts.length})</div>
        </div>
        <div className="stat-tile">
          <span className="ic" style={{ color: '#ff9500' }}>{TI.scale}</span>
          <div className={`v${polemics === 0 ? ' na' : ''}`}>{polemics}</div>
          <div className="l">Polémicas</div>
        </div>
        <div className="stat-tile">
          <span className="ic" style={{ color: '#ff3b30' }}>{TI.duo}</span>
          <div className={`v${bouts === 0 ? ' na' : ''}`}>{bouts}</div>
          <div className="l">Combates</div>
        </div>
      </div>

      <button className="btn-primary" onClick={() => nav('/kumite/entrenar')}>
        ENTRENAR
      </button>
      <button className="btn-secondary" onClick={() => nav('/kumite/polemicas')} disabled={polemics === 0}>
        Situaciones polémicas {polemics > 0 ? `(${polemics})` : ''}
      </button>

      {clips.length === 0 && (
        <div className="card muted">Aún no hay clips. Catalógalos desde Biblioteca en el ordenador.</div>
      )}
    </div>
  );
}
