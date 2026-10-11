// Añade al dataset los encuentros de medalla (final + bronces) de campeonatos nuevos (formato SportData 2026,
// votos por mayoría). Entrada: JSON { "<vernr>:<catid>": { f: [aka, ao], b: [[aka, ao], ...] } } donde cada
// participante es [nombre, cc, club, nºkata, kata, votos], extraído en Chrome de `mitschriftcatxml`.
// Uso: node scripts/add-medal-events.mjs <medallas.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dsPath = join(here, '..', 'public', 'data', 'dataset.json');
const ds = JSON.parse(readFileSync(dsPath, 'utf8'));
const dump = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// metadatos de cada campeonato (fechas y tipo vistos en SportData)
const EVENTS = {
  1187: { id: 'karate-one-series-a-salzburg-2026', name: 'Karate One Series A - Salzburg 2026', competitionType: 'SERIES_A', tier: 3, dateStart: '2026-10-02', tree: 'POOLWINNER_TREE' },
  1211: { id: 'ufak-cadet-junior-senior-championships-2026-algiers', name: 'UFAK Cadet, Junior & Senior Championships 2026 - Algiers', competitionType: 'CONTINENTAL_CHAMPIONSHIP', continent: 'AFRICA', tier: 1, dateStart: '2026-09-06', tree: 'ELIMINATION' },
  1204: { id: 'the-24th-asian-cadet-junior-u21-championship-2026-amman-jordan', name: 'The 24th Asian Cadet Junior & U21 Championship 2026 - Amman, Jordan', competitionType: 'CONTINENTAL_CHAMPIONSHIP', continent: 'ASIA', tier: 1, dateStart: '2026-09-08', tree: 'POOLWINNER_TREE' },
  1185: { id: '32nd-mediterranean-championships-2026-alexandria', name: '32nd Mediterranean Championships - 2026 - Alexandria', competitionType: 'OTHER', tier: 3, dateStart: '2026-06-17', tree: 'ELIMINATION' },
};
const CATS = { 36: 'senior-female-kata', 37: 'senior-male-kata', 48: 'senior-female-team-kata', 49: 'senior-male-team-kata', 22: 'u21-female-kata', 23: 'u21-male-kata' };

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

const athletes = new Map(ds.athletes.map((a) => [a.id, a]));
// nombre de país por código, sacado de los atletas individuales que ya hay
const countryOf = new Map();
for (const a of ds.athletes) if (!a.id.startsWith('team-') && a.countryCode && a.country && a.country.length > 3) {
  if (!countryOf.has(a.countryCode)) countryOf.set(a.countryCode, a.country);
}

function athleteId([name, cc, club], team) {
  const id = team ? `team-${slug(name)}-${cc.toLowerCase()}` : `${slug(name)}-${cc.toLowerCase()}`;
  if (!athletes.has(id)) {
    athletes.set(id, {
      id,
      displayName: name,
      country: team ? title(club || name) : countryOf.get(cc) ?? title(club || cc),
      countryCode: cc,
    });
  }
  return id;
}

const comps = new Map(ds.competitions.map((c) => [c.id, c]));
const perfs = new Map(ds.performances.map((p) => [p.id, p]));
let added = 0;
const report = [];

for (const [key, data] of Object.entries(dump)) {
  const [vernr, catid] = key.split(':').map(Number);
  const ev = EVENTS[vernr];
  const categoryId = CATS[catid];
  if (!ev || !categoryId) { report.push(`omitido ${key}`); continue; }
  const team = catid === 48 || catid === 49;
  if (!comps.has(ev.id)) {
    comps.set(ev.id, {
      id: ev.id,
      name: ev.name,
      year: +ev.dateStart.slice(0, 4),
      dateStart: ev.dateStart,
      competitionType: ev.competitionType,
      ...(ev.continent ? { continent: ev.continent } : {}),
      tier: ev.tier,
      sportDataEventId: vernr,
      sportDataUrl: `https://www.sportdata.org/wkf/set-online/veranstaltung_info_main.php?active_menu=calendar&vernr=${vernr}`,
      source: 'SportData SET Online (extraído 2026-10-11)',
    });
  }
  const bouts = [];
  if (data.f) bouts.push(['FINAL', ev.tree, data.f]);
  (data.b || []).forEach((b, i) => bouts.push([`BRONZE_${i + 1}`, 'REPECHAGE', b]));
  for (const [roundType, phaseFormat, [aka, ao]] of bouts) {
    const id = `${ev.id}_${categoryId}_${roundType.toLowerCase()}`;
    const va = +aka[5], vo = +ao[5];
    const winner = va > vo ? 'AKA' : 'AO';
    const judges = va + vo;
    const p = {
      id,
      competitionId: ev.id,
      categoryId,
      roundType,
      phaseFormat,
      akaAthleteId: athleteId(aka, team),
      aoAthleteId: athleteId(ao, team),
      ...(aka[4] ? { kataAka: aka[4], ...(aka[3] ? { kataAkaNumber: aka[3] } : {}) } : {}),
      ...(ao[4] ? { kataAo: ao[4], ...(ao[3] ? { kataAoNumber: ao[3] } : {}) } : {}),
      officialWinner: winner,
      officialResultType: winner === 'AKA' ? 'AKA_WINS' : 'AO_WINS',
      status: 'VIDEO_MISSING',
      sportDataUrl: `https://www.sportdata.org/wkf/set-online/veranstaltung_info_main.php?active_menu=calendar&vernr=${vernr}&ver_info_action=catauslist`,
      judgeVotes: { aka: va, ao: vo },
      notes: `Sistema 2026: ganador por mayoría de votos de ${judges} jueces.${aka[4] && ao[4] ? '' : ' SportData no publica el kata de este combate.'}`,
    };
    if (!perfs.has(id)) added++;
    perfs.set(id, { ...p, ...(perfs.get(id)?.videoId ? pickVideo(perfs.get(id)) : {}) });
    report.push(`${id.replace(ev.id + '_', `${vernr} `)}: ${aka[0]} ${aka[4] || '—'} ${va} vs ${ao[0]} ${ao[4] || '—'} ${vo}`);
  }
}

/** Si el encuentro ya existía con vídeo catalogado, se conserva. */
function pickVideo(p) {
  const keys = ['videoId', 'startSeconds', 'endSeconds', 'akaStartSeconds', 'akaEndSeconds', 'aoStartSeconds', 'aoEndSeconds', 'aoVideoId', 'status', 'closeResult', 'userNote', 'formerExam'];
  return Object.fromEntries(keys.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
}

ds.competitions = [...comps.values()];
ds.athletes = [...athletes.values()];
ds.performances = [...perfs.values()];
ds.generatedAt = new Date().toISOString();
writeFileSync(dsPath, JSON.stringify(ds, null, 2) + '\n');
console.log(report.join('\n'));
console.log(`\nencuentros nuevos: ${added} · total: ${ds.performances.length} · competiciones: ${ds.competitions.length}`);
