// Comprueba la coherencia de los sub-clips AKA/AO del dataset.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ds = JSON.parse(readFileSync(join(here, '..', 'public', 'data', 'dataset.json'), 'utf8'));

let ok = 0;
let pendientes = 0;
const bad = [];
for (const p of ds.performances) {
  if (p.akaStartSeconds == null && p.aoStartSeconds == null) continue;
  const issues = [];
  // solo inicios marcados (fin pendiente de catalogar): no es un error
  if (p.akaEndSeconds == null && p.aoEndSeconds == null && p.akaStartSeconds != null && p.aoStartSeconds != null) {
    pendientes++;
    continue;
  }
  if (p.akaStartSeconds == null || p.aoStartSeconds == null) issues.push('solo un atleta con sub-clip');
  if (p.akaStartSeconds != null && !(p.akaStartSeconds < p.akaEndSeconds)) issues.push('AKA fin<=inicio');
  if (p.aoStartSeconds != null && !(p.aoStartSeconds < p.aoEndSeconds)) issues.push('AO fin<=inicio');
  // los sub-clips no deben solapar (en exámenes AO puede ir ANTES que AKA, o venir de otro vídeo)
  if (p.aoVideoId == null && p.akaEndSeconds != null && p.aoStartSeconds != null && p.aoEndSeconds != null) {
    const overlap = Math.min(p.akaEndSeconds, p.aoEndSeconds) - Math.max(p.akaStartSeconds, p.aoStartSeconds);
    if (overlap > 0) issues.push('AKA y AO solapan');
  }
  if (p.startSeconds != null && p.akaStartSeconds != null && p.akaStartSeconds < p.startSeconds - 1) issues.push('AKA antes del clip');
  if (p.aoVideoId == null && p.endSeconds != null && p.aoEndSeconds != null && p.aoEndSeconds > p.endSeconds + 1) issues.push('AO despues del clip');
  const durA = p.akaEndSeconds - p.akaStartSeconds, durO = p.aoEndSeconds - p.aoStartSeconds;
  if (durA < 60 || durA > 420) issues.push(`duracion AKA rara (${durA}s)`);
  if (durO < 60 || durO > 420) issues.push(`duracion AO rara (${durO}s)`);
  if (issues.length) bad.push(`${p.id}: ${issues.join(', ')}`);
  else ok++;
}
console.log(`sub-clips OK: ${ok}, con problemas: ${bad.length}, pendientes de fin: ${pendientes}`);
bad.forEach((s) => console.log(' ! ', s));
const close = ds.performances.filter((p) => p.closeResult).length;
const notes = ds.performances.filter((p) => p.userNote).length;
console.log(`closeResult manuales: ${close}, notas de usuario: ${notes}`);
