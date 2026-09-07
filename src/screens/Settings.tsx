import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { downloadJson, exportBackup, importBackup, type BackupFile } from '../logic/backup';
import { syncDataset } from '../data/dataset';
import { deleteLocalVideo, importVideoFile, listLocalVideos, type LocalVideoInfo } from '../logic/localVideos';

const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

export default function Settings() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<LocalVideoInfo[]>([]);
  const [showList, setShowList] = useState(false);
  /** Progreso de importación: bytes copiados / totales, archivo actual y omitidos por duplicado. */
  const [progress, setProgress] = useState<{ done: number; total: number; index: number; count: number } | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    listLocalVideos().then(setVideos).catch(() => setVideos([]));
  }, []);

  async function doImportVideos(list: File[]) {
    try {
      await navigator.storage?.persist?.();
      // nombres válidos del dataset: id de encuentro (clip) o id de YouTube (vídeo completo)
      const perfs = await db.performances.toArray();
      const validBases = new Set<string>();
      for (const p of perfs) {
        if (p.videoId) { validBases.add(p.id); validBases.add(p.videoId); }
        if (p.aoVideoId) validBases.add(p.aoVideoId);
      }
      // duplicados: mismo nombre y mismo tamaño que uno ya importado → se omite
      const existing = new Map((await listLocalVideos()).map((v) => [v.name, v.size]));
      const toImport = list.filter((f) => existing.get(f.name) !== f.size);
      const omitidos = list.length - toImport.length;
      const total = toImport.reduce((a, f) => a + f.size, 0);
      let done = 0;
      const sinCorrespondencia: string[] = [];
      const fallidos: string[] = [];
      let importados = 0;
      for (let i = 0; i < toImport.length; i++) {
        const f = toImport[i];
        setProgress({ done, total, index: i + 1, count: toImport.length });
        try {
          await importVideoFile(f, (pct) => setProgress({ done: done + (f.size * pct) / 100, total, index: i + 1, count: toImport.length }));
          importados++;
        } catch (err) {
          fallidos.push(`${f.name} (${err instanceof Error ? err.message : err})`);
        }
        done += f.size;
        const base = f.name.replace(/\.(mp4|m4v|mov|webm)$/i, '');
        if (!validBases.has(base)) sinCorrespondencia.push(f.name);
      }
      setProgress(null);
      // cuántos encuentros quedan enlazados a un vídeo local
      const nombres = new Set((await listLocalVideos()).map((v) => v.name.replace(/\.(mp4|m4v|mov|webm)$/i, '')));
      const enlazados = perfs.filter((p) => p.videoId && (nombres.has(p.id) || nombres.has(p.videoId))).length;
      let m = `✅ ${importados} vídeo${importados !== 1 ? 's' : ''} nuevo${importados !== 1 ? 's' : ''} · ${enlazados} encuentros enlazados en total.`;
      if (omitidos) m += ` ${omitidos} ya estaba${omitidos !== 1 ? 'n' : ''} (omitido${omitidos !== 1 ? 's' : ''}).`;
      if (fallidos.length) m += ` ❌ ${fallidos.length} con error: ${fallidos.slice(0, 3).join('; ')}${fallidos.length > 3 ? '…' : ''}`;
      if (sinCorrespondencia.length) {
        m += ` ⚠️ ${sinCorrespondencia.length} sin correspondencia (el nombre no coincide con ningún encuentro): ${sinCorrespondencia.slice(0, 5).join(', ')}${sinCorrespondencia.length > 5 ? '…' : ''}`;
      }
      setMsg(m);
      setVideos(await listLocalVideos());
    } catch (e) {
      setProgress(null);
      setMsg(`Error al importar vídeo: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function doExport() {
    const data = await exportBackup();
    downloadJson(data, `kata-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg(`Copia exportada (${data.attempts.length} intentos).`);
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as BackupFile;
      await importBackup(data);
      setMsg('Copia restaurada.');
    } catch (e) {
      setMsg(`Error al importar: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function resetAttempts() {
    if (!confirm('¿Borrar TODOS tus intentos y estadísticas? Esta acción no se puede deshacer.')) return;
    await db.attempts.clear();
    setMsg('Intentos borrados.');
  }

  return (
    <>
      <h1>Ajustes</h1>

      <h2>Copia de seguridad</h2>
      <div className="card">
        <p className="muted">Tus intentos y estadísticas se guardan solo en este dispositivo.</p>
        <button className="btn-primary" onClick={doExport}>Exportar copia de seguridad</button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Restaurar copia de seguridad</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
      </div>

      <h2>Vídeos locales (sin anuncios)</h2>
      <div className="card">
        <p className="muted">
          Los vídeos importados se reproducen sin anuncios ni conexión y se enlazan solos a cada encuentro por su
          nombre. Los ya importados se omiten.
        </p>
        <button className="btn-primary" onClick={() => videoRef.current?.click()} disabled={!!progress}>
          Importar vídeos
        </button>
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            // copiar la lista ANTES de vaciar el input: la FileList es "viva" y se vacía con él
            const list = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (list.length) doImportVideos(list);
          }}
        />
        {progress && (
          <div style={{ margin: '4px 0 12px' }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <div className="progressbar" style={{ height: 14 }}>
                <div style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, transition: 'width 0.2s' }} />
              </div>
              <span className="muted" style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%
              </span>
            </div>
            <p className="muted center" style={{ margin: '6px 0 0' }}>
              Importando vídeo {progress.index} de {progress.count} · {fmtSize(progress.done)} de {fmtSize(progress.total)} · no cierres la app
            </p>
          </div>
        )}
        {videos.length > 0 && (
          <>
            <button className="btn-secondary" style={{ margin: '4px 0 8px' }} onClick={() => setShowList((x) => !x)}>
              {videos.length} vídeo{videos.length !== 1 ? 's' : ''} · {fmtSize(videos.reduce((s, v) => s + v.size, 0))} {showList ? '▴' : '▾'}
            </button>
            {showList && videos.map((v) => (
              <div key={v.name} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name} <span className="muted">({fmtSize(v.size)})</span>
                </span>
                <button
                  style={{ flex: '0 0 auto', padding: '6px 10px' }}
                  onClick={async () => { await deleteLocalVideo(v.name); setVideos(await listLocalVideos()); }}
                >
                  🗑
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <h2>Datos</h2>
      <div className="card">
        <button className="btn-secondary" onClick={async () => { await syncDataset(); setMsg('Catálogo actualizado.'); }}>
          Actualizar catálogo
        </button>
        <p className="muted">
          Almacenamiento persistente: {persisted == null ? 'desconocido' : persisted ? 'activado' : 'no activado'}
        </p>
      </div>

      <h2>Zona de peligro</h2>
      <div className="card">
        <button className="btn-secondary" style={{ borderColor: '#8f2a22', color: '#ef9a93' }} onClick={resetAttempts}>
          Borrar todos mis intentos
        </button>
      </div>

      {msg && <div className="card" role="status">{msg}</div>}
      <p className="muted center">Kracademy Referee Trainer</p>
    </>
  );
}
