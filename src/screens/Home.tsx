import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../logic/useCatalog';
import { accuracy, currentStreak, pendingErrors } from '../logic/stats';
import { TI } from '../components/TileIcons';

export default function Home() {
  const nav = useNavigate();
  const { performances, attempts, attemptsByPerf } = useCatalog();

  const ready = performances.filter((p) => p.status === 'READY');
  const firstAttempts = attempts.filter((a) => a.isFirstAttempt);
  const errors = pendingErrors(performances, attemptsByPerf);
  const acc = accuracy(firstAttempts);

  return (
    <div className="screen-fill">
      <div className="mod-topbar">
        <h1 style={{ margin: 0 }}>Kata</h1>
        <button className="switch-btn" onClick={() => nav('/')}>‹ Módulos</button>
      </div>

      <div className="home-grid">
        <div className="stat-tile">
          <span className="ic" style={{ color: '#ff9500' }}>{TI.flame}</span>
          <div className="v">{currentStreak(attempts)}</div>
          <div className="l">Tu racha</div>
        </div>
        <div className="stat-tile">
          <span className="ic" style={{ color: '#007aff' }}>{TI.target}</span>
          <div className={`v${acc == null ? ' na' : ''}`}>{acc == null ? '—' : `${acc}%`}</div>
          <div className="l">Precisión 1er intento</div>
        </div>
        <div className="stat-tile">
          <span className="ic" style={{ color: '#34c759' }}>{TI.clapper}</span>
          <div className="v">{ready.length}</div>
          <div className="l">Actuaciones listas</div>
        </div>
        <div className="stat-tile">
          <span className="ic" style={{ color: '#ff3b30' }}>{TI.alert}</span>
          <div className={`v${errors.length === 0 ? ' na' : ''}`}>{errors.length}</div>
          <div className="l">Errores pendientes</div>
        </div>
      </div>

      <button className="btn-primary" onClick={() => nav('/kata/entrenar')}>
        ENTRENAR
      </button>
      <button className="btn-secondary" onClick={() => nav('/kata/errores')} disabled={errors.length === 0}>
        Repasar errores {errors.length > 0 ? `(${errors.length})` : ''}
      </button>

      {ready.length === 0 && (
        <div className="card muted">Aún no hay encuentros listos. Catalógalos desde Biblioteca en el ordenador.</div>
      )}
    </div>
  );
}
