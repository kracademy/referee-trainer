export function fmtTime(totalSeconds: number | undefined): string {
  if (totalSeconds == null || isNaN(totalSeconds)) return '--:--';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Acepta "1:23:14", "83:14", "5014" o "5014.5" y devuelve segundos. */
export function parseTime(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const parts = t.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => isNaN(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Segundo de inicio de un enlace de YouTube (?t=754, &t=12m34s, ?start=754). */
export function extractYouTubeStart(url: string): number | undefined {
  const m = url.match(/[?&#](?:t|start)=([\dhms]+)/i);
  if (!m) return undefined;
  const v = m[1].toLowerCase();
  if (/^\d+s?$/.test(v)) return parseInt(v, 10);
  const h = v.match(/(\d+)h/)?.[1], mi = v.match(/(\d+)m/)?.[1], s = v.match(/(\d+)s/)?.[1];
  const total = (+(h ?? 0)) * 3600 + (+(mi ?? 0)) * 60 + (+(s ?? 0));
  return total || undefined;
}

export function extractYouTubeId(url: string): string | undefined {
  const t = url.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m =
    t.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) ??
    t.match(/[?&]v=([\w-]{11})/);
  return m?.[1];
}

export function roundLabel(roundType: string): string {
  switch (roundType) {
    case 'FINAL': return 'Final';
    case 'BRONZE_1': return 'Bronce 1';
    case 'BRONZE_2': return 'Bronce 2';
    default: return 'Otra ronda';
  }
}

export function competitionTypeLabel(t: string): string {
  switch (t) {
    case 'WORLD_CHAMPIONSHIP': return 'World Championships';
    case 'CONTINENTAL_CHAMPIONSHIP': return 'Continental Championships';
    case 'PREMIER_LEAGUE': return 'Premier League';
    case 'SERIES_A': return 'Series A';
    default: return 'Otra';
  }
}
