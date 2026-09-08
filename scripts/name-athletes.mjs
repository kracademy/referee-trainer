// Rellena firstName/lastName de los atletas individuales a partir del displayName de SportData
// ("APELLIDOS NOMBRE"). Regla: nombre = última palabra; si la penúltima es un nombre de pila
// conocido, el nombre son las dos últimas (DAMIAN HUGO, DIANA VALENTINA, EMRE VEFA...).
// Correcciones manuales en scripts/athlete-names.json ({ id: { firstName, lastName } }).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dsPath = join(here, '..', 'public', 'data', 'dataset.json');
const ovPath = join(here, 'athlete-names.json');
const ds = JSON.parse(readFileSync(dsPath, 'utf8'));
const overrides = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, 'utf8')) : {};

const GIVEN = new Set(`MARIA JOSE JUAN ANA LUIS DIANA DAMIAN CARLOS ANTONIO MIGUEL DAVID HERNAN INGRID STEPHANY SAIDA MAYRA MARIANO
RODRIGO ALEXANDRE IRENE ANDREA PAULA LAURA SARA MARTA ELENA SOFIA CRISTINA PEDRO PABLO DANIEL ALBERTO FRANCISCO JAVIER JORGE MANUEL
FERNANDO ANGEL RAFAEL SERGIO VICTOR ALVARO HUGO GABRIEL SAMUEL ADRIAN MARCOS ISABEL LUCIA CARMEN ROSA JULIA VALERIA VALENTINA CAMILA
MARIANA NATALIA ANDRES SANTIAGO JOAQUIN MATIAS NICOLAS FELIPE JULIAN TOMAS LUCAS IGNACIO EMILIO OSCAR RUBEN MARIO RAUL IVAN JESUS RAMON
RICARDO ROBERTO EDUARDO ENRIQUE GUILLERMO ALEJANDRO ALEJANDRA CINTHIA VALENTIN JOAO JOSÉ GONCALO GONÇALO TIAGO BRUNO RUI NUNO
EMRE DAMLA AHMET MEHMET MUSTAFA ALI ENES DILARA ELIF ZEYNEP MERVE BUSE KAAN BERK EGE CAN ONUR BURAK HASAN HUSEYIN IBRAHIM YUSUF OMER
MUHAMMED MUHAMMAD FATMA AYSE EDA SELIN MOHAMED MOHAMMED AHMED MAHMOUD OMAR YOUSSEF AYA NOUR HANA JANA ABDEL ABDUL JEAN MARIE PIERRE ANNE
ARIF SAMI EMIN LEIDY SYIFA AIDAN JEREMY LAYLA ANISA ALEXANDRU SAYED ZEYAD KARIM KEYDA CHUN SUM DUC NGOC TRUONG SREY`.split(/\s+/));
const SURNAME_FIRST = new Set(['TUR','EGY','INA','MAS','PHI','VIE','CAM','HKG','CHN','TPE','KOR','MAC','SGP','ROU','KUW','KSA','UAE','JOR','QAT','BRN']);
const PARTICLES = new Set(['DE', 'LA', 'DEL', 'DA', 'DAS', 'DOS', 'DO', 'DI', 'VAN', 'VON', 'EL', 'AL', 'LE', 'BIN', 'BINTI']);
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cap = (w) => w.split(/(-|')/).map((p) => (p === '-' || p === "'" ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join('');
const titleWord = (w, i) => (i > 0 && PARTICLES.has(strip(w).toUpperCase()) ? w.toLowerCase() : cap(w));
const title = (words) => words.map(titleWord).join(' ');

// atletas que compiten en categorías individuales
const indiv = new Set();
for (const p of ds.performances) if (!/team|equipo/i.test(p.categoryId)) { indiv.add(p.akaAthleteId); indiv.add(p.aoAthleteId); }

let done = 0, skipped = 0, manual = 0;
const review = [];
for (const a of ds.athletes) {
  if (overrides[a.id]) { Object.assign(a, overrides[a.id]); manual++; continue; }
  if (!indiv.has(a.id)) continue;
  const raw = a.displayName.replace(/^_/, '').replace(/\d+/g, '').trim();
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2 || /[()]/.test(raw) || !a.countryCode || a.countryCode === '—') { skipped++; continue; }
  let nGiven = 1;
  if (words.length >= 3 && GIVEN.has(strip(words[words.length - 2]).toUpperCase())) nGiven = 2;
  // países donde SportData pone APELLIDO + nombre(s) compuestos (Turquía, Egipto, Indonesia, Vietnam, Hong Kong...)
  if (words.length === 3 && SURNAME_FIRST.has(a.countryCode)) nGiven = 2;
  const given = words.slice(-nGiven), family = words.slice(0, -nGiven);
  a.firstName = title(given);
  a.lastName = title(family);
  done++;
  if (words.length >= 3) review.push(a);
}
writeFileSync(dsPath, JSON.stringify(ds, null, 2) + '\n');
console.log(`nombres asignados: ${done} · manuales: ${manual} · omitidos: ${skipped}`);
if (process.argv.includes('--review')) {
  const ready = new Set();
  ds.performances.filter((p) => p.status === 'READY' || p.formerExam).forEach((p) => { ready.add(p.akaAthleteId); ready.add(p.aoAthleteId); });
  console.log('\nRevisar (3+ palabras, en encuentros listos):');
  review.filter((a) => ready.has(a.id)).forEach((a) => console.log(`  ${a.countryCode} | ${a.displayName}  ->  ${a.firstName} ${a.lastName}`));
  console.log('\nRevisar (3+ palabras, resto):');
  review.filter((a) => !ready.has(a.id)).forEach((a) => console.log(`  ${a.countryCode} | ${a.displayName}  ->  ${a.firstName} ${a.lastName}`));
}
