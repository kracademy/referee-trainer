import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { athleteName } from '../logic/names';
import { useCatalog } from '../logic/useCatalog';
import { analyzePerformance, markedForReview, pendingErrors } from '../logic/stats';
import TrainingSession from '../components/TrainingSession';
import ReviewToggle from '../components/ReviewToggle';
import { roundLabel } from '../logic/format';
import type { Performance } from '../db/types';

type Tab = 'fallados' | 'marcados';

/** Repaso: encuentros fallados (hasta aprenderlos) y encuentros marcados a mano para volver a verlos. */
export default function ErrorsScreen() {
  const data = useCatalog();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'marcados' ? 'marcados' : 'fallados';
  const [queue, setQueue] = useState<Performance[] | null>(null);

  if (queue) {
    return <TrainingSession queue={queue} data={data} onExit={() => setQueue(null)} />;
  }

  const errors = pendingErrors(data.performances, data.attemptsByPerf).filter((p) => p.status === 'READY');
  const marked = markedForReview(data.performances);
  const list = tab === 'fallados' ? errors : marked;
  const trainable = list.filter((p) => p.status === 'READY' || p.formerExam);

  return (
    <>
      <h1>Repaso</h1>
      <div className="seg">
        <button className={`chip${tab === 'fallados' ? ' sel' : ''}`} onClick={() => setParams({ tab: 'fallados' })}>
          Fallados ({errors.length})
        </button>
        <button className={`chip${tab === 'marcados' ? ' sel' : ''}`} onClick={() => setParams({ tab: 'marcados' })}>
          Marcados ({marked.length})
        </button>
      </div>

      {tab === 'fallados' && list.length === 0 && <div className="card muted">No tienes errores pendientes.</div>}
      {tab === 'marcados' && list.length === 0 && (
        <div className="card muted">
          Aún no has marcado ningún encuentro. Al ver el resultado de una actuación, pulsa "Añadir a repaso" para guardarla aquí.
        </div>
      )}
      {trainable.length > 1 && (
        <button className="btn-primary" onClick={() => setQueue(trainable)}>
          REPASAR TODOS ({trainable.length})
        </button>
      )}

      {list.map((p) => {
        const comp = data.compById.get(p.competitionId);
        const cat = data.categoryById.get(p.categoryId);
        const aka = data.athleteById.get(p.akaAthleteId);
        const ao = data.athleteById.get(p.aoAthleteId);
        const t = analyzePerformance(data.attemptsByPerf.get(p.id) ?? []);
        const fails = t.attempts.filter((a) => !a.isCorrectWinner).length;
        const real = p.officialWinner === 'AKA' ? aka : ao;
        const first = t.firstAttempt;
        const yourPick = first ? (first.selectedWinner === 'AKA' ? aka : ao) : undefined;
        const canTrain = p.status === 'READY' || p.formerExam;
        return (
          <div className="card perf-item" key={p.id}>
            <div className="meta">
              {comp?.name} ({comp?.year}) · {cat?.name} · {roundLabel(p.roundType)}
            </div>
            <div className="who">
              🔴 {athleteName(aka)} <span className="muted">({aka?.countryCode})</span> vs 🔵 {athleteName(ao)}{' '}
              <span className="muted">({ao?.countryCode})</span>
            </div>
            <div className="meta">
              Real: 🏆 {athleteName(real)} ({real?.countryCode})
              {p.judgeVotes ? ` · ${p.judgeVotes.aka}–${p.judgeVotes.ao}` : ''}
              {p.closeResult ? ' · ⚖️ ajustado' : ''}
            </div>
            <div className="meta">
              {t.attempts.length === 0 ? (
                'Sin intentos todavía'
              ) : (
                <>
                  {t.attempts.length} intento{t.attempts.length !== 1 ? 's' : ''} · {fails} fallo{fails !== 1 ? 's' : ''}
                  {first && <> · 1º: {first.isCorrectWinner ? '✅' : `❌ ${athleteName(yourPick)}`}</>}
                  {t.learned && ' · aprendido'}
                </>
              )}
            </div>
            {tab === 'marcados' && p.reviewNote && <div>📝 {p.reviewNote}</div>}
            {tab === 'marcados' && !canTrain && <div className="meta">Sin vídeo</div>}
            <div className="row">
              {canTrain && (
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setQueue([p])}>
                  {tab === 'fallados' ? 'REVISAR' : 'VER'}
                </button>
              )}
              <div style={{ flex: 1 }}>
                <ReviewToggle perf={p} compact />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
