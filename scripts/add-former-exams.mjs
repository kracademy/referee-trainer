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
const EXAM_LABELS = ['EKF 25', 'WKF 25-1', 'WKF 25-2', 'EKF 26', 'WKF 26-1', 'WKF 26 Fujairah', 'WKF 26 Bielsko-Biała'];
// `apps[i] === 0` = salió en ese examen pero no sabemos en qué posición

/**
 * Cada fila del documento. `apps` = posición en cada examen (índice = EXAM_LABELS).
 * `aka`/`ao`: { name, cc?, kata?, video?, t? }  ·  `winner`: 'AKA' | 'AO'
 * `cat`: categoría (?: por confirmar) · `note`: contexto/observaciones · `close`: resultado ajustado (⚖️)
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
  // ── Examen WKF Fujairah 2026 (curso de árbitros, oct 2026). Orden de las preguntas desconocido. ──
  {
    apps: [null, null, null, null, null, 0],
    aka: { name: 'ESPAÑA (MORALES OZUNA, RODRIGUEZ ENCABO, ROY RUBIO)', cc: 'ESP' },
    ao: { name: 'EQUIPO FINALISTA (PREMIER LEAGUE RABAT)' },
    winner: 'AKA', cat: 'senior-female-team-kata',
    note: "AKA: equipo femenino de España con Gema Morales, Lidia Rodríguez y Raquel Roy (no era el del Mediterráneo). Desde 2024 SportData no lista los componentes de los equipos, así que no se puede confirmar el campeonato. Combates de España femenino con vídeo en la app anteriores al examen (feb 2026), todos con Anan: final Series A Larnaca 2024 (41.9), final EKF Zadar 2024 (42.8 vs Italia), bronce Mundial por equipos Pamplona 2024 (43.4 vs Italia), final EKF Yerevan 2025 (43.4 vs Portugal). AO: equipo de la final femenina de la Premier League de Rabat, por confirmar (las Premier League de Rabat 2023, 2025 y 2026 no tienen kata por equipos en SportData).",
  },
  {
    apps: [null, null, null, null, null, 0],
    aka: { name: 'TAILY HELVETIA', cc: 'FRA', kata: 'Unsu' },
    ao: { name: "D'ONOFRIO TERRYANA", cc: 'ITA', kata: 'Papuren' },
    winner: 'AO', cat: 'senior-female-kata',
    note: "Premier League Rabat 2025 (30 may 2025), liguilla del Pool 1 femenino (con Xenou y Lo Sum Man), emisión WKF del viernes, tatami 1. Taily Unsu 38.5 vs D'Onofrio Papuren 40.1. Otros cruces anteriores al examen: final EKF Yerevan 2025 y octavos del Mundial El Cairo 2025.",
  },
  {
    apps: [null, null, null, null, null, 0, 10],
    aka: { name: 'HUNG HO WAI HOWARD', cc: 'HKG', kata: 'Suparinpei', video: '75DGz9cXyqs', t: 3768 },
    ao: { name: 'NISHIYAMA KAKERU', cc: 'JPN', kata: 'Seisan', video: '75DGz9cXyqs', t: 3768 },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Karate1 Premier League Fukuoka 2023, emisión WKF día 2, tatami 4 (los dos en el mismo vídeo). Hoja del examen de Bielsko-Biała: AKA 8.0, AO 8.5. El PDF pone "H. Hung (HKG)": se asume Hung Ho Wai Howard.',
  },
  {
    apps: [null, null, null, null, null, 0, 9],
    aka: { name: 'ESPAÑA (EQUIPO MASCULINO)', cc: 'ESP', kata: 'Paiku', video: 'q1zuEuT29sE', t: 25 },
    ao: { name: 'BURKINA FASO (EQUIPO MASCULINO)', cc: 'BUR', kata: 'Anan', video: '76kXHBF4SdM', t: 337 },
    winner: 'AKA', cat: 'senior-male-team-kata',
    clip: { start: 25, end: 347, akaStart: 25, akaEnd: 347, aoStart: 337, aoEnd: 594 },
    note: 'Montaje con dos vídeos: AKA es el equipo masculino de España del 31º Campeonato Mediterráneo (Guadalajara 2025), Paiku. AO es el equipo masculino de Burkina Faso del Campeonato de África (UFAK) Casablanca 2023, Anan.',
  },
  {
    apps: [null, null, null, null, null, 0],
    aka: { name: 'KIYUNA RYO (JOVEN)', cc: 'JPN' },
    ao: { name: 'KIYUNA RYO (MAYOR)', cc: 'JPN' },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Encuentro inventado para el examen: Kiyuna de joven contra Kiyuna en una etapa posterior. Sin vídeo, solo para recordarlo.',
  },
  // ── Examen WKF Bielsko-Biała 2026 (11 oct 2026). Además repitieron el 9 (_21) y el 10 (_20). ──
  {
    apps: [null, null, null, null, null, null, 1],
    aka: { name: 'LUECK AIDAN RANDALL', cc: 'GER', kata: 'Anan Dai', video: '34ZRnW1Mnhw', t: 13 },
    ao: { name: 'ZIAD YOUCEF', cc: 'ALG', kata: 'Gojushiho Sho', video: '_cgKSHA9pKk', t: 154 },
    winner: 'AO', cat: 'u21-male-kata',
    note: 'Montaje con los dos bronces U21 masculino del Mundial Cadete, Junior y U21 de Venecia (Jesolo) 2024. En la realidad Lueck perdió con Elmowafi y Ziad con Ishikawa.',
  },
  {
    apps: [null, null, null, null, null, null, 2],
    aka: { name: 'ISHIKAWA TAIGA', cc: 'JPN', kata: 'Unsu', video: '_cgKSHA9pKk', t: 5 },
    ao: { name: 'ELMOWAFI ABDELRAHMAN', cc: 'EGY', kata: 'Kanku Sho', video: '34ZRnW1Mnhw', t: 279 },
    winner: 'AKA', cat: 'u21-male-kata',
    note: 'Montaje con los dos bronces U21 masculino del Mundial Cadete, Junior y U21 de Venecia (Jesolo) 2024 (los dos ganaron su bronce).',
  },
  {
    apps: [null, null, null, null, null, null, 3],
    aka: { name: 'COLOMBIA (EQUIPO FEMENINO)', cc: 'COL', kata: 'Gankaku', video: 'xl4xnmkY9NA' },
    ao: { name: 'FRANCIA (EQUIPO FEMENINO)', cc: 'FRA', kata: 'Gojushiho Sho', video: 'G8Y76Wwhb8k', t: 155 },
    winner: 'AO', cat: 'senior-female-team-kata',
    note: 'Karate World Cup Pamplona 2024. AKA: Colombia en la fase final (pérdida de equilibrio en Gankaku). AO: Francia en la fase de grupos (día 1, tatami 4). El PDF duda entre Gojushiho Sho (minuto 2:35) y Gojushiho Dai (22:56) del mismo vídeo.',
  },
  {
    apps: [null, null, null, null, null, null, 4],
    aka: { name: 'OHATA KOTARO', cc: 'JPN', kata: 'Papuren', video: 'DRTtqFtEfXI' },
    ao: { name: 'TORRES GUTIERREZ ARIEL', cc: 'USA', kata: 'Anan', video: 'a5Jpst_0JIM', t: 201 },
    winner: 'AKA', close: true, cat: 'senior-male-kata',
    note: 'Montaje de la Premier League Rabat 2025: AKA de la semifinal Ohata–Nishiyama, AO de los cuartos Abe–Torres. En la hoja salen marcados los dos como ganador: AKA puesto de forma provisional.',
  },
  {
    apps: [null, null, null, null, null, null, 5],
    aka: { name: 'IWAMOTO EMIRI', cc: 'JPN', kata: 'Anan', video: 'Kju_dQdMeuk', t: 1673 },
    ao: { name: 'MOTA NICOLE', cc: 'BRA', kata: 'Suparinpei', video: 'Kju_dQdMeuk', t: 1673 },
    winner: 'AKA', close: true, cat: 'senior-female-kata',
    note: 'Karate1 Premier League Fukuoka 2023, emisión WKF día 1, tatami 2. En la hoja salen marcados los dos como ganador: AKA puesto de forma provisional.',
  },
  {
    apps: [null, null, null, null, null, null, 6],
    aka: { name: 'TAILY HELVETIA', cc: 'FRA', kata: 'Suparinpei', video: 'sbqsd0tA6yk', t: 3 },
    ao: { name: "D'ONOFRIO TERRYANA", cc: 'ITA', kata: 'Suparinpei', video: 'sbqsd0tA6yk', t: 3 },
    winner: 'AO', cat: 'senior-female-kata',
    note: 'Final del 31º Campeonato Mediterráneo (Guadalajara 2025): Taily 24.4, D\'Onofrio 25.3.',
  },
  {
    apps: [null, null, null, null, null, null, 7],
    aka: { name: 'BARDOS ADAM', cc: 'HUN', kata: 'Suparinpei', video: 'tIZWs1ysRc0', t: 875 },
    ao: { name: 'NETO ARTUR', cc: 'POR', kata: 'Chatanyara Kushanku', video: 'tIZWs1ysRc0', t: 1610 },
    winner: 'AO', close: true, cat: 'senior-male-kata',
    note: 'Montaje de la Premier League Istanbul 2026 (emisión WKF del sábado, tatami 2). Hoja del examen: AKA 7.66, AO 7.75, con los dos marcados como ganador.',
  },
  {
    apps: [null, null, null, null, null, null, 8],
    aka: { name: 'ELGHOBASHY MOSTAFA', cc: 'EGY', kata: 'Gojushiho Sho', video: 'tIZWs1ysRc0', t: 3922 },
    ao: { name: 'IKEDA RYUSEI', cc: 'JPN', kata: 'Anan', video: 'tIZWs1ysRc0', t: 1142 },
    winner: 'AO', cat: 'senior-male-kata',
    note: 'Montaje de la Premier League Istanbul 2026 (emisión WKF del sábado, tatami 2): AO sale antes que AKA en el vídeo.',
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
const FORCE = process.argv.includes('--force');
ROWS.forEach((row, i) => {
  const n = String(i + 1).padStart(2, '0');
  const id = `${COMP_ID}_${n}`;
  // los encuentros que ya existen conservan lo catalogado (vídeo, tiempos, notas del usuario); --force para regenerarlos
  if (perfs.has(id) && !FORCE) return;
  const akaId = mkAthlete(row.aka);
  const aoId = mkAthlete(row.ao);
  const examAppearances = row.apps
    .map((order, idx) => (order === 0 ? { exam: EXAM_LABELS[idx] } : order ? { exam: EXAM_LABELS[idx], order } : null))
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
    ...(row.close ? { closeResult: true } : {}),
    notes: row.note,
    status: 'MISSING_DATA',
  };

  // vídeo principal = el de AKA; si AO viene de otro vídeo, se guarda aparte
  if (row.aka.video) {
    perf.videoId = row.aka.video;
    if (row.aka.t != null) perf.startSeconds = row.aka.t;
    if (row.ao.video && row.ao.video !== row.aka.video) perf.aoVideoId = row.ao.video;
    // tiempos por atleta cuando el documento da un instante distinto para cada uno (sin instante de AKA = desde el principio)
    if (row.ao.t != null && (perf.aoVideoId || row.ao.t !== row.aka.t)) {
      perf.startSeconds = row.aka.t ?? 0;
      perf.akaStartSeconds = row.aka.t ?? 0;
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
