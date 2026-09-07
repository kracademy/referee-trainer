import { useMemo, useState } from 'react';
import { useCatalog } from '../logic/useCatalog';
import { DEFAULT_FILTERS, filterPerformances, orderQueue, type TrainFilters } from '../logic/selection';
import TrainingSession from '../components/TrainingSession';
import type { Performance } from '../db/types';

export default function Train() {
  const data = useCatalog();
  const [filters, setFilters] = useState<TrainFilters>(DEFAULT_FILTERS);
  const [queue, setQueue] = useState<Performance[] | null>(null);

  const ctx = useMemo(
    () => ({
      compTypeById: new Map(data.competitions.map((c) => [c.id, c.competitionType as string])),
      compYearById: new Map(data.competitions.map((c) => [c.id, c.year])),
      genderByCategoryId: new Map(data.categories.map((c) => [c.id, c.gender as string])),
      ageByCategoryId: new Map(data.categories.map((c) => [c.id, (c.ageGroup ?? 'SENIOR') as string])),
      formatByCategoryId: new Map(data.categories.map((c) => [c.id, (c.format ?? 'INDIVIDUAL') as string])),
      attemptsByPerf: data.attemptsByPerf,
    }),
    [data.competitions, data.categories, data.attemptsByPerf],
  );

  const eligible = useMemo(() => filterPerformances(data.performances, filters, ctx), [data.performances, filters, ctx]);
  const years = useMemo(() => [...new Set(data.competitions.map((c) => c.year))].sort().reverse(), [data.competitions]);

  if (queue) {
    return <TrainingSession queue={queue} data={data} onExit={() => setQueue(null)} />;
  }

  const set = (k: keyof TrainFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="screen-fill train">
      <h1>Entrenar</h1>

      <label>Competición</label>
      <select value={filters.competitionType} onChange={set('competitionType')}>
        <option value="ALL">Todas</option>
        <option value="WORLD_CHAMPIONSHIP">World Championships</option>
        <option value="CONTINENTAL_CHAMPIONSHIP">Continental Championships</option>
        <option value="PREMIER_LEAGUE">Premier League</option>
        <option value="SERIES_A">Series A</option>
        <option value="WORLD_CUP">World Cup / Equipos</option>
        <option value="FORMER_EXAM">🎓 Former Exams EKF/WKF</option>
      </select>

      <div className="row">
        <div style={{ flex: 1 }}>
          <label>Año</label>
          <select value={filters.year} onChange={set('year')}>
            <option value="ALL">Todos</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Sexo</label>
          <select value={filters.gender} onChange={set('gender')}>
            <option value="ALL">Ambos</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div style={{ flex: 1 }}>
          <label>Modalidad</label>
          <select value={filters.format} onChange={set('format')}>
            <option value="ALL">Todas</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="TEAM">Equipos</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Edad</label>
          <select value={filters.age} onChange={set('age')}>
            <option value="ALL">Todas</option>
            <option value="SENIOR">Senior</option>
            <option value="U21">U21</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div style={{ flex: 1 }}>
          <label>Ronda</label>
          <select value={filters.round} onChange={set('round')}>
            <option value="ALL">Medallas</option>
            <option value="FINAL">Finales</option>
            <option value="BRONZE">Bronces</option>
            <option value="OTHER">Otras rondas</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Estado</label>
          <select value={filters.status} onChange={set('status')}>
            <option value="ALL">Todas</option>
            <option value="NEVER">Nunca realizadas</option>
            <option value="FAILED">Falladas</option>
            <option value="CORRECT">Acertadas</option>
          </select>
        </div>
      </div>

      <label>Modo</label>
      <select value={filters.mode} onChange={set('mode')}>
        <option value="RANDOM">Aleatorio</option>
        <option value="LEAST_PRACTICED">Menos practicadas</option>
        <option value="RECENT_FAILS">Falladas recientemente</option>
        <option value="OLDEST">Más antiguas</option>
      </select>

      <div className="grow" />
      <button
        className="btn-primary"
        disabled={eligible.length === 0}
        onClick={() => setQueue(orderQueue(eligible, filters, ctx, []))}
      >
        EMPEZAR ({eligible.length})
      </button>
      {eligible.length === 0 && (
        <p className="muted center">No hay actuaciones listas con estos filtros. Cataloga vídeos primero.</p>
      )}
    </div>
  );
}
