// Añade al dataset los encuentros de exámenes EKF/WKF (Former Exams) aportados por el usuario.
// Fuente: Former_Exams.docx (tabla de apariciones por examen + vídeos + katas + ganador).
// Uso: node scripts/add-former-exams.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const datasetPath = join(here, '..', 'public', 'data', 'dataset.json');
const ds = JSON.parse(readFileSync(datasetPath, 'utf8'));

const COMP_ID = 'former-exams-ekf-wkf';
const EXAM_LABELS = ['EKF 25', 'WKF 25-1', 'WKF 25-2', 'EKF 26', 'WKF 26-1'];

/**
 * Cada fila del documento. `apps` = posición en cada examen (índice = EXAM_LABELS).
 * `aka`/`ao`: { name, cc?, kata?, video?, t? }  ·  `winner`: 'AKA' | 'AO'
 * `cat`: categoría (?: por confirmar) · `note`: contexto/observaciones
 */
const ROWS = [
  {
    apps: [null, 1, 1, 1, null],
    aka: { name: 'MARTIN YAIZA', cc: 'ESP', kata: 'Chatanyara Kushanku', video: 'H-U7ojTyKBA' },
    ao: { name: 'SCORDO SANDY', cc: 'FRA', kata: 'Unsu', video: 'H-U7ojTyKBA' },
    winner: 'AO', cat: 'senior-female-kata',
    note: 'Final del Campeonato de Europa 2012. Vídeo antiguo (playlist): puede no estar disponible.',
  },
  {
    apps: [6, 6, 2, 2, null],
    aka: { name: 'MADRID (EQUIPO)', cc: 'ESP', kata: 'Anan', video: 'ozp_rmJ4PWQ', t: 7303 },
    ao: { name: 'ESPAÑA (EQUIPO)', cc: 'ESP', kata: 'Anan', video: 'ozp_rmJ4PWQ', t: 7303 },
    winner: 'AO', cat: 'senior-female-team-kata',
    note: 'Karate1 Pamplona · FINALS (canal WKF). Equipos: sexo de la categoría por confirmar.',
  },
  {
    apps: [1, 8, 3, 4, null],
    aka: { name: 'MORALES GEMA', cc: 'ESP', kata: 'Kushanku', video: 'b2GHjcrtvsw', t: 46 },
    ao: { name: 'MOTA NICOLE', cc: 'BRA', kata: 'Chatanyara Kushanku', video: 'b2GHjcrtvsw', t: 46 },
    winner: 'AKA', cat: 'senior-female-kata',
    note: 'Final femenina · Karate 1 Series A Pamplona 2022. El enlace original está caído: falta un vídeo que funcione.',
  },
  {
    apps: [null, null, 4, 3, null],
    aka: { name: 'JAPÓN', cc: 'JPN', kata: 'Anan Dai' },
    ao: { name: 'MACEDONIA', cc: 'MKD', kata: 'Gojushiho Sho' },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Sin vídeo en el documento: se entrena de memoria. Atletas y categoría por confirmar.',
  },
  {
    apps: [2, 2, 5, 5, null],
    aka: { name: 'MOTO RYUJI', cc: 'JPN', kata: 'Gojushiho Sho', video: 'uqBhx0K3avY', t: 679 },
    ao: { name: 'MARTIN RAUL', cc: 'ESP', kata: 'Ohan Dai', video: 'uqBhx0K3avY', t: 886 },
    winner: 'AKA', cat: 'senior-male-kata',
    clip: { start: 679, end: 1037, akaStart: 679, akaEnd: 842, aoStart: 886, aoEnd: 1037 },
    note: 'Karate 1 Series A Pamplona 2022.',
  },
  {
    apps: [null, 5, 6, 6, null],
    aka: { name: 'BRASIL', cc: 'BRA', kata: 'Papuren' },
    ao: { name: 'NAMIBIA', cc: 'NAM', kata: 'Gojushiho Sho' },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'Candidato (SportData): Mundial Senior Madrid 2018, kata masculino ronda 1, NAKAPANDI MICHAEL PANDULENI (NAM) vs SOUZA SANTOS WILLIAMES (BRA), 5-0 Brasil. Único cruce Brasil–Namibia en kata senior que consta en SportData; katas sin confirmar. Vídeo: retransmisión WKF del Mundial de Madrid 2018.',
  },
  {
    apps: [null, null, 8, 9, null],
    aka: { name: 'ATLETA A', kata: 'Gankaku' },
    ao: { name: 'ATLETA B', kata: 'Gojushiho Sho' },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'Sin vídeo ni nombres en el documento: solo katas y ganador. Por completar.',
  },
  {
    apps: [null, 10, 10, 10, null],
    aka: { name: 'KIYUNA RYO', cc: 'JPN', kata: 'Sepai', video: 'uF4C1O-YOIU' },
    ao: { name: 'SHIMBABA ISSEI', cc: 'JPN', kata: 'Sepai', video: 'UGT4YtJN0pM' },
    winner: 'AKA', cat: 'senior-male-kata',
    note: '48th All Japan Karate Championships 2020: dos actuaciones de vídeos distintos (AO tiene su propio vídeo).',
  },
  {
    apps: [null, 3, null, 7, null],
    aka: { name: 'TOZAKI GAKUJI', cc: 'USA', kata: 'Anan', video: 'Fbdc79xwiHE' },
    ao: { name: 'POR CONFIRMAR', kata: 'Gankaku' },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'AKA: Tozaki en la PKF 2024 (el vídeo enlazado). La actuación de AO era de OTRO encuentro: un Gankaku con desequilibrio medio — atleta y vídeo por confirmar.',
  },
  {
    apps: [null, 4, null, 8, null],
    aka: { name: 'CADETE A (VENECIA 2024)', kata: 'Gankaku', video: 'ulm0OLmGkMY', t: 834 },
    ao: { name: 'CADETE B (VENECIA 2024)', kata: 'Unsu', video: 'ulm0OLmGkMY', t: 834 },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'WKF Cadet, Junior & U21 World Championships 2024 (Venecia) · bronces cadete, tatami 3. Atletas y categoría real (cadete) por confirmar.',
  },
  {
    apps: [3, null, null, null, null],
    aka: { name: 'YANGUEZ VICENTE', cc: 'ESP', kata: 'Sansai', video: '6I8h4CVHjTo', t: 17100 },
    ao: { name: 'AHMADOV ELDAR', cc: 'AZE', kata: 'Kanku Sho', video: '6I8h4CVHjTo', t: 17100 },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'Final Para-Karate · Campeonato de Europa Guadalajara 2023 (medal bouts del domingo). A efectos del examen gana AKA: Vicente puntuó mejor en el kata, aunque el resultado global fue para AO.',
  },
  {
    apps: [4, null, null, null, null],
    aka: { name: 'MOTO', cc: 'JPN', kata: 'Gankaku', video: 'XdMuWde5pLk' },
    ao: { name: 'UEMURA', cc: 'JPN', kata: 'Kururunfa', video: 'XdMuWde5pLk' },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'Karate1 Leipzig 2017 · bronce. AO no hizo el saludo. Nombres completos por confirmar.',
    clip: { start: 7, end: 292, akaStart: 7, akaEnd: 153, aoStart: 160, aoEnd: 292 },
  },
  {
    apps: [5, null, null, null, null],
    aka: { name: 'SHIMBABA ISSEI', cc: 'JPN', kata: 'Suparinpei', video: 'DM_SntM0zrc' },
    ao: { name: 'QUINTERO DAMIAN', cc: 'ESP', kata: 'Chatanyara Kushanku', video: 'DM_SntM0zrc' },
    winner: 'AKA', cat: 'senior-male-kata',
    note: 'Karate1 Premier League Berlin 2018 (15-sep-2018), semifinal masculina. El combate se repitió por irregularidad de procedimiento (misma sala/jueces que en rondas previas); Shimbaba ganó 3-2 las dos veces. Vídeo original de YouTube no disponible: buscar la retransmisión del WKF de Berlin 2018.',
  },
  {
    apps: [7, null, null, null, null],
    aka: { name: "D'ONOFRIO TERRYANA", cc: 'ITA', kata: 'Suparinpei', video: '_QZxXzNEI4o', t: 1439 },
    ao: { name: 'GARCIA LOZANO PAOLA', cc: 'ESP', kata: 'Chatanyara Kushanku', video: '_QZxXzNEI4o', t: 786 },
    winner: 'AO', cat: 'senior-female-kata',
    note: 'World Championships · bronces (sesión sábado mañana): dos actuaciones distintas del mismo directo emparejadas para el examen.',
  },
  {
    apps: [8, null, null, null, null],
    aka: { name: 'KHAMIS', cc: 'EGY', kata: 'Unsu', video: 'EfTN5YQmETs', t: 40 },
    ao: { name: 'KIRI', cc: 'JPN', kata: 'Suparinpei', video: 'EfTN5YQmETs', t: 40 },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Karate1 Larnaca · FINALS. Nombres completos por confirmar.',
  },
  {
    apps: [9, null, null, null, null],
    aka: { name: 'ATLETA A', kata: 'Oyadomari No Passai' },
    ao: { name: 'ATLETA B', kata: 'Ohan Dai' },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Sin vídeo ni nombres: solo katas y ganador. Por completar.',
  },
  {
    apps: [10, null, null, null, null],
    aka: { name: 'ESTADOS UNIDOS', cc: 'USA', kata: 'Anan Dai' },
    ao: { name: 'JAPÓN', cc: 'JPN', kata: 'Anan Dai' },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Sin vídeo. Atletas concretos por confirmar.',
  },
];

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// competición contenedora
const comps = new Map(ds.competitions.map((c) => [c.id, c]));
comps.set(COMP_ID, {
  id: COMP_ID,
  name: 'Former Exams EKF/WKF',
  year: 2026,
  dateStart: '2026-12-31', // primero en la lista de Catalogar
  competitionType: 'OTHER',
  tier: 1,
  source: 'Exámenes EKF/WKF recopilados por el usuario',
  notes: 'Encuentros que han salido en exámenes de arbitraje (EKF 25, WKF 25-1, WKF 25-2, EKF 26).',
});
ds.competitions = [...comps.values()];

const athletes = new Map(ds.athletes.map((a) => [a.id, a]));
const perfs = new Map(ds.performances.map((p) => [p.id, p]));

const mkAthlete = ({ name, cc }) => {
  const id = `exam-${slug(name)}${cc ? `-${slug(cc)}` : ''}`;
  athletes.set(id, {
    id,
    displayName: name,
    country: cc ?? '—',
    countryCode: cc ?? '—',
    notes: cc ? undefined : 'País por confirmar',
  });
  return id;
};

let added = 0;
ROWS.forEach((row, i) => {
  const n = String(i + 1).padStart(2, '0');
  const id = `${COMP_ID}_${n}`;
  const akaId = mkAthlete(row.aka);
  const aoId = mkAthlete(row.ao);
  const examAppearances = row.apps
    .map((order, idx) => (order ? { exam: EXAM_LABELS[idx], order } : null))
    .filter(Boolean);

  const perf = {
    id,
    competitionId: COMP_ID,
    categoryId: row.cat,
    roundType: 'OTHER',
    akaAthleteId: akaId,
    aoAthleteId: aoId,
    ...(row.aka.kata ? { kataAka: row.aka.kata } : {}),
    ...(row.ao.kata ? { kataAo: row.ao.kata } : {}),
    officialWinner: row.winner,
    officialResultType: row.winner === 'AKA' ? 'AKA_WINS' : 'AO_WINS',
    formerExam: true,
    examAppearances,
    notes: row.note,
    status: 'MISSING_DATA',
  };

  // vídeo principal = el de AKA; si AO viene de otro vídeo, se guarda aparte
  if (row.aka.video) {
    perf.videoId = row.aka.video;
    if (row.aka.t != null) perf.startSeconds = row.aka.t;
    if (row.ao.video && row.ao.video !== row.aka.video) perf.aoVideoId = row.ao.video;
    // tiempos por atleta cuando el documento da un instante distinto para cada uno
    if (row.aka.t != null && row.ao.t != null && row.ao.t !== row.aka.t) {
      perf.akaStartSeconds = row.aka.t;
      perf.aoStartSeconds = row.ao.t;
    }
  }
  // clip completo confirmado por el usuario (inicio/fin del bout + sub-clips)
  if (row.clip) {
    perf.startSeconds = row.clip.start;
    perf.endSeconds = row.clip.end;
    if (row.clip.akaStart != null) { perf.akaStartSeconds = row.clip.akaStart; perf.akaEndSeconds = row.clip.akaEnd; }
    if (row.clip.aoStart != null) { perf.aoStartSeconds = row.clip.aoStart; perf.aoEndSeconds = row.clip.aoEnd; }
  }
  perf.status = perf.videoId ? (perf.endSeconds != null ? 'READY' : 'VIDEO_CATALOGUED') : 'VIDEO_MISSING';

  if (!perfs.has(id)) added++;
  perfs.set(id, perf);
});

ds.performances = [...perfs.values()];
// limpiar atletas exam-* que ya no referencia ninguna actuación (renombrados en correcciones)
const referenced = new Set(ds.performances.flatMap((p) => [p.akaAthleteId, p.aoAthleteId]));
ds.athletes = [...athletes.values()].filter((a) => !a.id.startsWith('exam-') || referenced.has(a.id));
ds.generatedAt = new Date().toISOString();
writeFileSync(datasetPath, JSON.stringify(ds, null, 2));

const exam = ds.performances.filter((p) => p.competitionId === COMP_ID);
console.log(`Former Exams añadidos: ${added} (total ${exam.length})`);
console.log(`  con vídeo: ${exam.filter((p) => p.videoId).length} · sin vídeo (memoria): ${exam.filter((p) => !p.videoId).length}`);
console.log(`  con vídeo propio de AO: ${exam.filter((p) => p.aoVideoId).length}`);
console.log(`Total performances dataset: ${ds.performances.length}`);
