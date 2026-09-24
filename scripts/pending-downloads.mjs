// Lista los encuentros con vídeo cuyo clip aún no está en la carpeta `videos`
// y escribe video/pendientes-descarga.md y .csv (nombre de archivo, enlace con minuto, corte).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..'); // …/Kracademy Kata Trainer
const ds = JSON.parse(readFileSync(join(here, '..', 'public', 'data', 'dataset.json'), 'utf8'));
const have = new Set(readdirSync(join(root, 'videos')).filter((f) => /\.(mp4|m4v|mov|webm)$/i.test(f)).map((f) => f.replace(/\.[^.]+$/, '')));
const comps = Object.fromEntries(ds.competitions.map((c) => [c.id, c]));
const ath = Object.fromEntries(ds.athletes.map((a) => [a.id, a]));
const nm = (a) => (a ? (a.firstName ? `${a.firstName} ${a.lastName ?? ''}`.trim() : a.displayName) : '?');
const hms = (s) => { s = Math.max(0, s | 0); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v, i) => (i ? String(v).padStart(2, '0') : v)).join(':'); };

const miss = ds.performances.filter((p) => p.videoId && p.startSeconds != null && p.endSeconds != null && !have.has(p.id) && !have.has(p.videoId));
let md = `# Vídeos pendientes de descargar (${new Date().toISOString().slice(0, 10)})\n\nCorte = del inicio al fin indicado. Guardar en la carpeta \`videos\` con el nombre exacto.\n`;
let csv = 'archivo;url;inicio;fin;encuentro\n';
const byComp = {};
for (const p of miss) (byComp[p.competitionId] ??= []).push(p);
for (const [cid, ps] of Object.entries(byComp)) {
  md += `\n## ${comps[cid]?.name ?? cid}\n\n| Archivo | Vídeo | Inicio | Fin | Encuentro |\n|---|---|---|---|---|\n`;
  console.log(`\n## ${comps[cid]?.name ?? cid}`);
  for (const p of ps.sort((a, b) => a.videoId.localeCompare(b.videoId) || a.startSeconds - b.startSeconds)) {
    const who = `${nm(ath[p.akaAthleteId])} vs ${nm(ath[p.aoAthleteId])}`;
    const url = `https://www.youtube.com/watch?v=${p.videoId}&t=${p.startSeconds}s`;
    md += `| ${p.id}.mp4 | [${p.videoId}](${url}) | ${hms(p.startSeconds)} | ${hms(p.endSeconds)} | ${who} |\n`;
    csv += [`${p.id}.mp4`, url, hms(p.startSeconds), hms(p.endSeconds), who].join(';') + '\n';
    console.log(`- ${p.videoId} | ${p.id}.mp4 | ${hms(p.startSeconds)} -> ${hms(p.endSeconds)} | ${who}`);
  }
}
writeFileSync(join(root, 'video', 'pendientes-descarga.md'), md);
writeFileSync(join(root, 'video', 'pendientes-descarga.csv'), '﻿' + csv);
console.log(`\npendientes: ${miss.length}`);
